"""FO-094 AI Production Monitoring tests."""

from __future__ import annotations

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.access_control.models import Role, UserRole
from apps.fm_tickets.ai.errors import AIErrorCode
from apps.fm_tickets.ai_production_monitoring_service import (
    ERROR_CATEGORY_TIMEOUT,
    HEALTH_HEALTHY,
    HEALTH_WARNING,
    classify_error_code,
    get_monitoring_overview,
)
from apps.fm_tickets.models import AITicketAnalysis, FmTicket
from apps.master_data.models import Building, Organization, Tenant

User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
    FACILITYOPS_AI_PROVIDER="placeholder",
    FACILITYOPS_GEMINI_ENABLED=False,
    FACILITYOPS_AI_MONITOR_FAILURE_RATE_WARNING=0.15,
    FACILITYOPS_AI_MONITOR_FAILURE_RATE_CRITICAL=0.30,
    FACILITYOPS_AI_MONITOR_RETRY_RATE_WARNING=0.20,
    FACILITYOPS_AI_MONITOR_TIMEOUT_RATE_WARNING=0.10,
    FACILITYOPS_AI_MONITOR_QUEUE_BACKLOG_WARNING=10,
    FACILITYOPS_AI_MONITOR_QUEUE_BACKLOG_CRITICAL=50,
)
class AIProductionMonitoringTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant = Tenant.objects.create(name="Tenant A", code="fo094-a")
        cls.org = Organization.objects.create(
            tenant=cls.tenant, name="Org A", code="fo094-org-a"
        )
        cls.building = Building.objects.create(
            tenant=cls.tenant,
            organization=cls.org,
            name="Building A",
            code="fo094-bldg-a",
        )
        cls.admin = User.objects.create_user(
            email="fo094-admin@example.com",
            password="pass",
            tenant=cls.tenant,
        )
        cls.manager = User.objects.create_user(
            email="fo094-manager@example.com",
            password="pass",
            tenant=cls.tenant,
        )
        cls.employee = User.objects.create_user(
            email="fo094-employee@example.com",
            password="pass",
            tenant=cls.tenant,
        )
        UserRole.objects.create(
            user=cls.admin, role=Role.objects.get(code="system_admin")
        )
        UserRole.objects.create(
            user=cls.manager, role=Role.objects.get(code="facility_manager")
        )
        UserRole.objects.create(
            user=cls.employee, role=Role.objects.get(code="employee")
        )
        cls.ticket = FmTicket.objects.create(
            tenant=cls.tenant,
            organization=cls.org,
            building=cls.building,
            requester=cls.admin,
            title="Monitor ticket",
            description="desc",
            ticket_number="FO094-A-001",
            category=FmTicket.Category.PLUMBING,
            priority=FmTicket.Priority.MEDIUM,
        )

    def setUp(self):
        AITicketAnalysis.objects.all().delete()
        self.client = APIClient()
        self.now = timezone.now()

    def _analysis(self, **kwargs):
        defaults = {
            "tenant": self.tenant,
            "ticket": self.ticket,
            "status": AITicketAnalysis.Status.COMPLETED,
            "queued_at": self.now - timedelta(minutes=5),
            "started_at": self.now - timedelta(minutes=4),
            "completed_at": self.now - timedelta(minutes=3),
            "duration_ms": 1200,
            "provider": "placeholder",
            "model_name": "placeholder",
            "attempt_count": 1,
            "retryable": False,
            "requested_by": self.admin,
        }
        defaults.update(kwargs)
        return AITicketAnalysis.objects.create(**defaults)

    def test_classify_error_codes(self):
        self.assertEqual(
            classify_error_code(AIErrorCode.PROVIDER_TIMEOUT),
            ERROR_CATEGORY_TIMEOUT,
        )
        self.assertEqual(classify_error_code("UNKNOWN_CODE"), "other")

    def test_overview_provider_runtime_queue_health(self):
        self._analysis(status=AITicketAnalysis.Status.COMPLETED)
        self._analysis(
            status=AITicketAnalysis.Status.FAILED,
            error_code=AIErrorCode.PROVIDER_TIMEOUT,
            duration_ms=None,
            completed_at=self.now,
        )
        self._analysis(status=AITicketAnalysis.Status.QUEUED, started_at=None)
        self._analysis(
            status=AITicketAnalysis.Status.PROCESSING,
            retryable=True,
            attempt_count=2,
            completed_at=None,
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse("admin-ai-monitoring"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertIn("provider", data)
        self.assertIn("runtime", data)
        self.assertIn("queue", data)
        self.assertIn("health", data)
        self.assertIn("alerts", data)
        self.assertEqual(data["queue"]["queued"], 1)
        self.assertEqual(data["queue"]["retrying"], 1)
        self.assertEqual(data["queue"]["completed"], 1)
        self.assertEqual(data["queue"]["failed"], 1)
        self.assertIn("status_label", data["health"]["overall"])
        self.assertEqual(
            data["error_categories"][ERROR_CATEGORY_TIMEOUT],
            1,
        )
        # Privacy: no ticket text, identities, paths, secrets
        serialized = str(data).lower()
        self.assertNotIn("gemini_api_key", serialized)
        self.assertNotIn("prompt_text", serialized)
        self.assertNotIn("monitor ticket", serialized)
        self.assertNotIn("fo094-admin@example.com", serialized)
        self.assertNotIn("traceback", serialized)

    def test_runtime_and_queue_endpoints(self):
        self._analysis()
        self.client.force_authenticate(user=self.admin)
        runtime = self.client.get(reverse("admin-ai-monitoring-runtime"))
        queue = self.client.get(reverse("admin-ai-monitoring-queue"))
        self.assertEqual(runtime.status_code, status.HTTP_200_OK)
        self.assertEqual(queue.status_code, status.HTTP_200_OK)
        self.assertIn("success_rate", runtime.data["runtime"])
        self.assertIn("average_duration_ms", runtime.data["runtime"])
        self.assertEqual(queue.data["queue"]["completed"], 1)
        self.assertTrue(isinstance(queue.data["recent_activity"], list))

    def test_alerts_high_retry_and_provider_disabled(self):
        # Force many retries relative to total to trip retry-rate warning.
        for _ in range(4):
            self._analysis(attempt_count=3)
        self._analysis(attempt_count=1)

        self.client.force_authenticate(user=self.admin)
        response = self.client.get(reverse("admin-ai-monitoring-alerts"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["remediation"]["automatic"])
        codes = {alert["code"] for alert in response.data["alerts"]}
        self.assertIn("high_retry_rate", codes)
        for alert in response.data["alerts"]:
            self.assertFalse(alert["actionable"])
            self.assertFalse(alert["remediation_automatic"])
            self.assertIn("severity_label", alert)

    def test_health_status_labels_not_color_only(self):
        payload = get_monitoring_overview(self.admin)
        for key in ("overall", "provider", "queue", "worker", "ai"):
            self.assertIn("status", payload["health"][key])
            self.assertIn("status_label", payload["health"][key])
            self.assertTrue(payload["health"][key]["status_label"])

    def test_permission_enforcement(self):
        self.client.force_authenticate(user=self.manager)
        denied_mgr = self.client.get(reverse("admin-ai-monitoring"))
        self.assertEqual(denied_mgr.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.employee)
        denied_emp = self.client.get(reverse("admin-ai-monitoring"))
        self.assertEqual(denied_emp.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=None)
        unauth = self.client.get(reverse("admin-ai-monitoring"))
        self.assertIn(
            unauth.status_code,
            (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN),
        )

    def test_threshold_logic_queue_backlog_warning(self):
        for _ in range(10):
            self._analysis(
                status=AITicketAnalysis.Status.QUEUED,
                started_at=None,
                completed_at=None,
                duration_ms=None,
            )
        payload = get_monitoring_overview(self.admin)
        self.assertEqual(payload["queue"]["queued"], 10)
        self.assertIn(
            payload["health"]["queue"]["status"],
            {HEALTH_WARNING, "critical"},
        )
        codes = {a["code"] for a in payload["alerts"]}
        self.assertIn("queue_backlog", codes)

    def test_recent_activity_marks_retrying(self):
        self._analysis(
            status=AITicketAnalysis.Status.PROCESSING,
            retryable=True,
            attempt_count=2,
            completed_at=None,
        )
        payload = get_monitoring_overview(self.admin)
        statuses = [row["status"] for row in payload["recent_activity"]]
        self.assertIn("retrying", statuses)
