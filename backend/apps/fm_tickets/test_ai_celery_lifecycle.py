"""Additional FO-085A Celery lifecycle coverage (mocked provider; no live Gemini)."""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.access_control.models import Role, UserRole
from apps.attachments.models import Attachment
from apps.attachments.ownership import AttachmentOwnerType, AttachmentVisibility
from apps.attachments.services import create_attachment
from apps.fm_tickets.ai.errors import AIAnalysisError, AIErrorCode
from apps.fm_tickets.ai.gemini_provider import GeminiVisionProvider
from apps.fm_tickets.ai_processing_service import (
    RetryableAIProcessing,
    process_ticket_ai_analysis,
)
from apps.fm_tickets.ai_provider import AIProviderResult
from apps.fm_tickets.models import AITicketAnalysis, FmTicket
from apps.fm_tickets.tasks import process_fm_ticket_ai_analysis
from apps.master_data.models import Building, Organization, Tenant

User = get_user_model()

JPEG_BYTES = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xd9"
)


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
    FACILITYOPS_AI_PROVIDER="placeholder",
    FACILITYOPS_AI_MAX_ATTEMPTS=3,
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
)
class AICeleryLifecycleTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant = Tenant.objects.create(name="FO085A Tenant", code="fo085a")
        cls.org = Organization.objects.create(
            tenant=cls.tenant, name="FO085A Org", code="fo085a-org"
        )
        cls.building = Building.objects.create(
            tenant=cls.tenant,
            organization=cls.org,
            name="Building",
            code="fo085a-bldg",
        )
        cls.user = User.objects.create_user(
            email="fo085a@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.org,
        )
        UserRole.objects.create(
            user=cls.user,
            role=Role.objects.get(code="facility_manager"),
        )

    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        storage_override = override_settings(
            ATTACHMENT_STORAGE_ROOT=str(Path(self._tmpdir.name) / "attachments"),
        )
        storage_override.enable()
        self.addCleanup(storage_override.disable)

        self.ticket = FmTicket.objects.create(
            tenant=self.tenant,
            organization=self.org,
            building=self.building,
            requester=self.user,
            title="Leak",
            description="Visible water",
            ticket_number="FO085A-001",
        )
        self.attachment = create_attachment(
            actor=self.user,
            uploaded_file=SimpleUploadedFile(
                "stain.jpg", JPEG_BYTES, content_type="image/jpeg"
            ),
            declared_content_type="image/jpeg",
            category=Attachment.Category.IMAGE_EVIDENCE,
            owner_type=AttachmentOwnerType.FM_TICKET,
            owner_id=self.ticket.id,
            visibility=AttachmentVisibility.INTERNAL_ONLY,
        )

    def _queue(self):
        with patch(
            "apps.fm_tickets.tasks.process_fm_ticket_ai_analysis.delay"
        ) as delay_mock:
            delay_mock.return_value.id = "lifecycle-task"
            from apps.fm_tickets.ai_queue_service import queue_ticket_image_analysis

            return queue_ticket_image_analysis(
                actor=self.user,
                ticket_id=self.ticket.id,
                attachment_ids=[self.attachment.id],
            )

    def test_eager_mode_success(self):
        analysis = self._queue()
        result = process_ticket_ai_analysis(str(analysis.id), attempt=1)
        analysis.refresh_from_db()
        self.assertTrue(result["ok"])
        self.assertEqual(analysis.status, AITicketAnalysis.Status.COMPLETED)
        self.assertNotEqual(analysis.status, AITicketAnalysis.Status.PROCESSING)

    def test_transient_failure_then_success(self):
        analysis = self._queue()
        valid_payload = {
            "schema_version": "1.0",
            "analysis_summary": "Visible staining near a fixture.",
            "image_results": [
                {
                    "attachment_id": str(self.attachment.id),
                    "image_index": 1,
                    "image_quality": {"usable": True, "issues": []},
                    "observations": [
                        {
                            "observation": "Water stain on ceiling tile",
                            "evidence": "Discoloration visible in frame",
                            "region": "upper center",
                            "confidence": 0.7,
                        }
                    ],
                    "visible_assets": [],
                    "visible_hazards": [],
                    "cannot_determine": [],
                }
            ],
            "cross_image_findings": [],
            "overall_image_quality": "adequate",
            "requires_human_review": False,
            "limitations": ["A photograph cannot confirm the internal root cause"],
        }
        provider = MagicMock()
        provider.analyze.side_effect = [
            AIAnalysisError(AIErrorCode.PROVIDER_UNAVAILABLE, retryable=True),
            AIProviderResult(
                model_name="gemini-2.0-flash",
                model_version="v1",
                result_json=valid_payload,
                provider="gemini",
                prompt_version="v1",
                schema_version="1.0",
            ),
        ]
        with patch(
            "apps.fm_tickets.ai_processing_service.get_ai_provider",
            return_value=provider,
        ):
            with self.assertRaises(RetryableAIProcessing):
                process_ticket_ai_analysis(str(analysis.id), attempt=1)
            result = process_ticket_ai_analysis(str(analysis.id), attempt=2)

        analysis.refresh_from_db()
        self.assertTrue(result["ok"])
        self.assertEqual(analysis.status, AITicketAnalysis.Status.COMPLETED)
        self.assertNotEqual(analysis.status, AITicketAnalysis.Status.PROCESSING)

    def test_retry_exhaustion_marks_failed(self):
        analysis = self._queue()
        with patch(
            "apps.fm_tickets.ai_processing_service.get_ai_provider",
            side_effect=AIAnalysisError(AIErrorCode.PROVIDER_TIMEOUT, retryable=True),
        ):
            with self.assertRaises(RetryableAIProcessing):
                process_ticket_ai_analysis(str(analysis.id), attempt=1)
            with self.assertRaises(RetryableAIProcessing):
                process_ticket_ai_analysis(str(analysis.id), attempt=2)
            result = process_ticket_ai_analysis(str(analysis.id), attempt=3)

        analysis.refresh_from_db()
        self.assertFalse(result["ok"])
        self.assertEqual(analysis.status, AITicketAnalysis.Status.FAILED)
        self.assertEqual(analysis.error_code, AIErrorCode.PROVIDER_TIMEOUT)
        self.assertFalse(analysis.retryable)

    def test_provider_auth_failure_marks_failed(self):
        analysis = self._queue()
        with patch(
            "apps.fm_tickets.ai_processing_service.get_ai_provider",
            side_effect=AIAnalysisError(AIErrorCode.PROVIDER_AUTH_FAILED),
        ):
            result = process_ticket_ai_analysis(str(analysis.id), attempt=1)

        analysis.refresh_from_db()
        self.assertFalse(result["ok"])
        self.assertEqual(analysis.status, AITicketAnalysis.Status.FAILED)
        self.assertEqual(analysis.error_code, AIErrorCode.PROVIDER_AUTH_FAILED)
        self.assertNotEqual(analysis.status, AITicketAnalysis.Status.PROCESSING)
        self.assertNotIn("api key", analysis.error_message.lower())

    def test_malformed_structured_response_fails_safely(self):
        analysis = self._queue()
        bad_provider = MagicMock()
        bad_provider.analyze.return_value = AIProviderResult(
            model_name="gemini-2.0-flash",
            model_version="v1",
            result_json={
                "schema_version": "1.0",
                "analysis_summary": "bad",
                # missing required image_results → schema validation failure
            },
            provider="gemini",
            prompt_version="v1",
            schema_version="1.0",
        )
        with patch(
            "apps.fm_tickets.ai_processing_service.get_ai_provider",
            return_value=bad_provider,
        ):
            result = process_ticket_ai_analysis(str(analysis.id), attempt=1)

        analysis.refresh_from_db()
        self.assertFalse(result["ok"])
        self.assertEqual(analysis.status, AITicketAnalysis.Status.FAILED)
        self.assertEqual(analysis.error_code, AIErrorCode.SCHEMA_VALIDATION_FAILED)
        self.assertNotIn("Traceback", analysis.error_message)
        self.assertNotIn("api key", analysis.error_message.lower())

    def test_duplicate_task_and_completed_idempotency(self):
        analysis = self._queue()
        first = process_ticket_ai_analysis(str(analysis.id), attempt=1)
        second = process_ticket_ai_analysis(str(analysis.id), attempt=1)
        third = process_fm_ticket_ai_analysis.run(str(analysis.id))
        analysis.refresh_from_db()
        self.assertTrue(first["ok"])
        self.assertTrue(second.get("skipped"))
        self.assertTrue(third.get("skipped") or third.get("ok"))
        self.assertEqual(analysis.status, AITicketAnalysis.Status.COMPLETED)

    @override_settings(
        FACILITYOPS_AI_PROVIDER="gemini",
        FACILITYOPS_GEMINI_ENABLED=True,
        GEMINI_API_KEY="test-key",
        FACILITYOPS_GEMINI_MODEL="gemini-2.0-flash",
    )
    def test_gemini_invalid_json_normalized(self):
        mock_response = MagicMock()
        mock_response.parsed = None
        mock_response.text = "{not-json"
        mock_response.candidates = []
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        provider = GeminiVisionProvider(client=mock_client)
        with self.assertRaises(AIAnalysisError) as ctx:
            provider.analyze(
                ticket=self.ticket,
                attachments=[self.attachment],
                correlation_id="x",
            )
        self.assertEqual(ctx.exception.code, AIErrorCode.INVALID_PROVIDER_RESPONSE)
