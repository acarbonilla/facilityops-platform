"""FO-101 Intelligent Employee Intake QA regression coverage.

Cross-checkpoint smoke for audience-safe AI payloads, classification gates,
notification create side-effects, and reporting naming separation.
"""

import tempfile

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Role, UserRole
from apps.master_data.models import Building, Organization, Tenant
from apps.notifications.models import Notification

from .classification_readiness import assert_ticket_ready_for_operational_actions
from .intake_reporting import annotate_ticket_intake_counts
from .models import AITicketAnalysis, FmTicket
from .services import assign_ticket


User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
    MEDIA_ROOT=tempfile.mkdtemp(prefix="fo101-media-"),
)
class Fo101IntakeQaRegressionTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant = Tenant.objects.create(name="FO101 Tenant", code="fo101-t")
        cls.other_tenant = Tenant.objects.create(name="FO101 Other", code="fo101-o")
        cls.organization = Organization.objects.create(
            tenant=cls.tenant,
            name="FO101 Org",
            code="fo101-org",
        )
        cls.building = Building.objects.create(
            tenant=cls.tenant,
            organization=cls.organization,
            name="FO101 Building",
            code="fo101-b",
        )
        employee_role = Role.objects.get(code="employee")
        fm_role = Role.objects.get(code="facility_manager")

        cls.employee = User.objects.create_user(
            email="fo101-employee@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.organization,
        )
        UserRole.objects.create(user=cls.employee, role=employee_role)

        cls.fm = User.objects.create_user(
            email="fo101-fm@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.organization,
        )
        UserRole.objects.create(user=cls.fm, role=fm_role)

        cls.other_employee = User.objects.create_user(
            email="fo101-other-employee@example.com",
            password="Password123!",
            tenant=cls.other_tenant,
            organization=Organization.objects.create(
                tenant=cls.other_tenant,
                name="FO101 Other Org",
                code="fo101-oo",
            ),
        )
        UserRole.objects.create(user=cls.other_employee, role=employee_role)

    def _create_employee_ticket(self, title="FO101 concern"):
        self.client.force_authenticate(user=self.employee)
        response = self.client.post(
            reverse("fm-ticket-list"),
            {"title": title},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return FmTicket.objects.get(id=response.data["id"])

    def test_employee_ai_analysis_payload_is_audience_safe(self):
        ticket = self._create_employee_ticket()
        analysis = AITicketAnalysis.objects.create(
            ticket=ticket,
            tenant=ticket.tenant,
            status=AITicketAnalysis.Status.COMPLETED,
            provider="gemini",
            model_name="gemini-2.0-flash",
            prompt_version="secret-prompt-v1",
            result_json={
                "findings": [{"title": "Leak", "description": "internal", "confidence": 90}],
                "recommended_category": "Plumbing",
                "recommended_priority": "High",
                "severity": "high",
                "overall_confidence": 88,
                "reasoning": "Internal reasoning must not leak",
            },
            error_message="provider stacktrace",
        )

        self.client.force_authenticate(user=self.employee)
        response = self.client.get(
            reverse("fm-ticket-ai-analyses", kwargs={"pk": ticket.id}),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data["results"][0] if "results" in response.data else response.data[0]
        self.assertEqual(payload["id"], str(analysis.id))
        self.assertEqual(payload["status"], AITicketAnalysis.Status.COMPLETED)
        for forbidden in (
            "provider",
            "model_name",
            "prompt_version",
            "result_json",
            "result",
            "findings",
            "recommended_category",
            "recommended_priority",
            "severity",
            "confidence",
            "reasoning",
            "schema_version",
        ):
            self.assertNotIn(forbidden, payload)
        self.assertNotIn("Internal reasoning", str(payload))
        self.assertNotIn("secret-prompt", str(payload))
        self.assertNotIn("gemini", str(payload).lower())

        detail = self.client.get(
            reverse(
                "fm-ticket-ai-analysis-detail",
                kwargs={"pk": ticket.id, "analysis_id": analysis.id},
            ),
        )
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertNotIn("recommended_category", detail.data)
        self.assertNotIn("reasoning", detail.data)

    def test_facility_manager_still_receives_full_ai_payload(self):
        ticket = self._create_employee_ticket(title="FO101 FM payload")
        AITicketAnalysis.objects.create(
            ticket=ticket,
            tenant=ticket.tenant,
            status=AITicketAnalysis.Status.COMPLETED,
            provider="gemini",
            model_name="gemini-2.0-flash",
            result_json={
                "recommended_category": "Plumbing",
                "recommended_priority": "High",
                "reasoning": "Visible to FM",
            },
        )
        self.client.force_authenticate(user=self.fm)
        response = self.client.get(
            reverse("fm-ticket-ai-analyses", kwargs={"pk": ticket.id}),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data["results"][0] if "results" in response.data else response.data[0]
        self.assertEqual(payload["recommended_category"], "Plumbing")
        self.assertIn("reasoning", payload)

    def test_cross_tenant_employee_cannot_read_ticket_or_ai(self):
        ticket = self._create_employee_ticket(title="FO101 tenant isolation")
        analysis = AITicketAnalysis.objects.create(
            ticket=ticket,
            tenant=ticket.tenant,
            status=AITicketAnalysis.Status.COMPLETED,
            result_json={"recommended_category": "Plumbing"},
        )
        self.client.force_authenticate(user=self.other_employee)
        ticket_response = self.client.get(
            reverse("fm-ticket-detail", kwargs={"pk": ticket.id}),
        )
        self.assertIn(
            ticket_response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )
        ai_response = self.client.get(
            reverse("fm-ticket-ai-analyses", kwargs={"pk": ticket.id}),
        )
        self.assertIn(
            ai_response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )
        detail = self.client.get(
            reverse(
                "fm-ticket-ai-analysis-detail",
                kwargs={"pk": ticket.id, "analysis_id": analysis.id},
            ),
        )
        self.assertIn(
            detail.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
        )

    def test_assignment_blocked_until_classification_complete(self):
        ticket = self._create_employee_ticket(title="FO101 readiness")
        with self.assertRaises(ValidationError):
            assign_ticket(ticket=ticket, assigned_to=self.fm, assigned_by=self.fm)
        with self.assertRaises(ValidationError):
            assert_ticket_ready_for_operational_actions(ticket=ticket)

        ticket.category = FmTicket.Category.PLUMBING
        ticket.priority = FmTicket.Priority.HIGH
        ticket.building = self.building
        ticket.save(update_fields=["category", "priority", "building", "updated_at"])
        assert_ticket_ready_for_operational_actions(ticket=ticket)
        assign_ticket(ticket=ticket, assigned_to=self.fm, assigned_by=self.fm)
        ticket.refresh_from_db()
        self.assertEqual(ticket.assignee_id, self.fm.id)

    def test_create_notifies_without_work_order(self):
        from apps.maintenance.models import MaintenanceWorkOrder

        before_n = Notification.objects.count()
        before_wo = MaintenanceWorkOrder.objects.count()
        self._create_employee_ticket(title="FO101 notify")
        self.assertGreater(Notification.objects.count(), before_n)
        self.assertEqual(MaintenanceWorkOrder.objects.count(), before_wo)

    def test_intake_reporting_counts_distinguish_pending_states(self):
        ticket = self._create_employee_ticket(title="FO101 reporting")
        counts = annotate_ticket_intake_counts(
            FmTicket.objects.filter(tenant=self.tenant, is_deleted=False)
        )
        self.assertGreaterEqual(counts["unclassified_count"], 1)
        self.assertGreaterEqual(counts["pending_classification_count"], 1)
        self.assertGreaterEqual(counts["employee_intake_count"], 1)
        self.assertEqual(ticket.priority, FmTicket.Priority.PENDING_REVIEW)
        self.assertEqual(ticket.category, FmTicket.Category.UNCLASSIFIED)
