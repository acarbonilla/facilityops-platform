"""FO-102 Gemini billing / quota / rate-limit diagnostics and retry tests."""

from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from django.utils import timezone

from apps.fm_tickets.ai.errors import AIErrorCode
from apps.fm_tickets.ai.gemini_diagnostics import (
    classify_gemini_exception,
    retry_countdown_seconds,
)
from apps.fm_tickets.ai_processing_service import process_ticket_ai_analysis
from apps.fm_tickets.ai_queue_service import (
    AITicketAnalysisValidationError,
    retry_ticket_ai_analysis,
)
from apps.fm_tickets.models import AITicketAnalysis, FmTicket


class Fo102GeminiClassificationTests(TestCase):
    def test_invalid_api_key(self):
        exc = Exception("401 API key not valid. Please pass a valid API key.")
        err = classify_gemini_exception(exc, model="gemini-2.5-flash")
        self.assertEqual(err.code, AIErrorCode.INVALID_API_KEY)
        self.assertFalse(err.retryable)
        self.assertIn("admin_message", err.diagnostics)

    def test_billing_disabled(self):
        exc = Exception("429 RESOURCE_EXHAUSTED: Check your billing account")
        err = classify_gemini_exception(exc)
        self.assertEqual(err.code, AIErrorCode.BILLING_DISABLED)
        self.assertFalse(err.retryable)

    def test_quota_exhausted(self):
        exc = Exception("429 RESOURCE_EXHAUSTED: Quota exceeded for project")
        err = classify_gemini_exception(exc)
        self.assertEqual(err.code, AIErrorCode.QUOTA_EXHAUSTED)
        self.assertTrue(err.retryable)

    def test_rate_limit_rpm(self):
        exc = Exception("429 Rate limit: requests per minute exceeded (RPM)")
        err = classify_gemini_exception(exc)
        self.assertEqual(err.code, AIErrorCode.RATE_LIMIT_RPM)
        self.assertTrue(err.retryable)

    def test_timeout_retryable(self):
        exc = Exception("Deadline exceeded / timed out contacting Gemini")
        err = classify_gemini_exception(exc)
        self.assertEqual(err.code, AIErrorCode.NETWORK_TIMEOUT)
        self.assertTrue(err.retryable)

    def test_retry_countdown_schedule(self):
        self.assertEqual(retry_countdown_seconds(1), 60)
        self.assertEqual(retry_countdown_seconds(2), 300)
        self.assertEqual(retry_countdown_seconds(3), 900)
        self.assertEqual(retry_countdown_seconds(4), 1800)
        self.assertEqual(retry_countdown_seconds(9), 1800)


@override_settings(
    FACILITYOPS_AI_PROVIDER="gemini",
    FACILITYOPS_GEMINI_ENABLED=True,
    GEMINI_API_KEY="dummy-key",
    FACILITYOPS_GEMINI_MODEL="gemini-2.5-flash",
    FACILITYOPS_AI_MAX_ATTEMPTS=3,
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
    CELERY_TASK_ALWAYS_EAGER=True,
)
class Fo102RetryLifecycleTests(TestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model
        from django.core.management import call_command

        from apps.access_control.models import Role, UserRole
        from apps.master_data.models import Organization, Tenant

        call_command("seed_rbac")
        self.tenant = Tenant.objects.create(name="FO102", code="fo102")
        self.org = Organization.objects.create(
            tenant=self.tenant, name="Org", code="fo102-o"
        )
        User = get_user_model()
        self.user = User.objects.create_user(
            email="fo102@example.com",
            password="x",
            tenant=self.tenant,
            organization=self.org,
        )
        UserRole.objects.create(
            user=self.user, role=Role.objects.get(code="facility_manager")
        )
        self.ticket = FmTicket.objects.create(
            tenant=self.tenant,
            organization=self.org,
            requester=self.user,
            title="FO102 retry",
            category=FmTicket.Category.UNCLASSIFIED,
            priority=FmTicket.Priority.PENDING_REVIEW,
        )

    def _analysis(self, **kwargs):
        defaults = {
            "tenant": self.tenant,
            "ticket": self.ticket,
            "status": AITicketAnalysis.Status.QUEUED,
            "queued_at": timezone.now(),
            "provider": "gemini",
            "model_name": "gemini-2.5-flash",
            "result_json": {},
        }
        defaults.update(kwargs)
        return AITicketAnalysis.objects.create(**defaults)

    @patch("apps.fm_tickets.ai_processing_service._schedule_delayed_retry")
    @patch("apps.fm_tickets.ai_processing_service.get_ai_provider")
    def test_429_schedules_waiting_for_retry(self, get_provider, schedule_retry):
        from apps.fm_tickets.ai.errors import AIAnalysisError

        class Fake:
            PROVIDER_NAME = "gemini"

            def analyze(self, **kwargs):
                raise AIAnalysisError(
                    AIErrorCode.RATE_LIMIT_RPM,
                    retryable=True,
                    diagnostics={"http_status": 429, "error_code": "RATE_LIMIT_RPM"},
                )

        get_provider.return_value = Fake()
        analysis = self._analysis()
        result = process_ticket_ai_analysis(str(analysis.id), attempt=1)
        analysis.refresh_from_db()
        self.assertEqual(result["status"], AITicketAnalysis.Status.WAITING_FOR_RETRY)
        self.assertEqual(analysis.status, AITicketAnalysis.Status.WAITING_FOR_RETRY)
        self.assertEqual(analysis.error_code, AIErrorCode.RATE_LIMIT_RPM)
        self.assertTrue(analysis.retryable)
        self.assertTrue(analysis.provider_diagnostics)
        schedule_retry.assert_called_once()
        self.assertEqual(schedule_retry.call_args.kwargs["next_attempt"], 2)
        self.assertEqual(schedule_retry.call_args.kwargs["countdown"], 60)

    @patch("apps.fm_tickets.ai_processing_service._schedule_delayed_retry")
    @patch("apps.fm_tickets.ai_processing_service.get_ai_provider")
    def test_retry_exhaustion_marks_retry_failed(self, get_provider, schedule_retry):
        from apps.fm_tickets.ai.errors import AIAnalysisError

        class Fake:
            PROVIDER_NAME = "gemini"

            def analyze(self, **kwargs):
                raise AIAnalysisError(AIErrorCode.QUOTA_EXHAUSTED, retryable=True)

        get_provider.return_value = Fake()
        analysis = self._analysis()
        result = process_ticket_ai_analysis(str(analysis.id), attempt=3)
        analysis.refresh_from_db()
        self.assertEqual(result["status"], AITicketAnalysis.Status.RETRY_FAILED)
        self.assertEqual(analysis.status, AITicketAnalysis.Status.RETRY_FAILED)
        self.assertFalse(analysis.retryable)
        schedule_retry.assert_not_called()

    @patch("apps.fm_tickets.ai_processing_service.get_ai_provider")
    def test_billing_disabled_permanently_failed(self, get_provider):
        from apps.fm_tickets.ai.errors import AIAnalysisError

        class Fake:
            PROVIDER_NAME = "gemini"

            def analyze(self, **kwargs):
                raise AIAnalysisError(AIErrorCode.BILLING_DISABLED, retryable=False)

        get_provider.return_value = Fake()
        analysis = self._analysis()
        result = process_ticket_ai_analysis(str(analysis.id), attempt=1)
        analysis.refresh_from_db()
        self.assertEqual(result["status"], AITicketAnalysis.Status.PERMANENTLY_FAILED)
        self.assertEqual(analysis.status, AITicketAnalysis.Status.PERMANENTLY_FAILED)
        self.assertIn("billing", analysis.admin_diagnostic_message.lower())

    @patch("apps.fm_tickets.tasks.process_fm_ticket_ai_analysis")
    def test_manual_retry_requeues_same_row(self, task):
        task.delay = MagicMock(return_value=MagicMock(id="celery-1"))
        analysis = self._analysis(
            status=AITicketAnalysis.Status.PERMANENTLY_FAILED,
            error_code=AIErrorCode.RATE_LIMIT_RPM,
            attempt_count=3,
            completed_at=timezone.now(),
        )
        retried = retry_ticket_ai_analysis(
            actor=self.user,
            ticket_id=self.ticket.id,
            analysis_id=analysis.id,
        )
        self.assertEqual(retried.id, analysis.id)
        self.assertEqual(retried.status, AITicketAnalysis.Status.QUEUED)
        task.delay.assert_called_once()

    @patch("apps.fm_tickets.tasks.process_fm_ticket_ai_analysis")
    def test_manual_retry_blocks_duplicate_active(self, task):
        task.delay = MagicMock(return_value=MagicMock(id="celery-1"))
        failed = self._analysis(
            status=AITicketAnalysis.Status.RETRY_FAILED,
            error_code=AIErrorCode.QUOTA_EXHAUSTED,
            attempt_count=3,
            completed_at=timezone.now(),
        )
        self._analysis(status=AITicketAnalysis.Status.QUEUED)
        with self.assertRaises(AITicketAnalysisValidationError):
            retry_ticket_ai_analysis(
                actor=self.user,
                ticket_id=self.ticket.id,
                analysis_id=failed.id,
            )
        task.delay.assert_not_called()

    @patch("apps.fm_tickets.ai_processing_service._schedule_delayed_retry")
    @patch("apps.fm_tickets.ai_processing_service.get_ai_provider")
    def test_retry_schedules_then_can_continue(self, get_provider, schedule_retry):
        from apps.fm_tickets.ai.errors import AIAnalysisError

        class Fake:
            PROVIDER_NAME = "gemini"

            def analyze(self, **kwargs):
                raise AIAnalysisError(AIErrorCode.PROVIDER_UNAVAILABLE, retryable=True)

        get_provider.return_value = Fake()
        analysis = self._analysis()
        first = process_ticket_ai_analysis(str(analysis.id), attempt=1)
        self.assertEqual(first["status"], AITicketAnalysis.Status.WAITING_FOR_RETRY)
        schedule_retry.assert_called_once()
        analysis.refresh_from_db()
        self.assertEqual(analysis.status, AITicketAnalysis.Status.WAITING_FOR_RETRY)
