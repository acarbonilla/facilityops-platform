"""FO-098 Facility Manager review experience focused tests."""

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

from .ai_recommendation_review import record_recommendation_decision
from .classification_readiness import (
    assert_ticket_ready_for_operational_actions,
    get_classification_block_reason,
)
from .models import AITicketAnalysis, FmTicket
from .services import assign_ticket


User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
    MEDIA_ROOT=tempfile.mkdtemp(prefix="fo098-media-"),
)
class Fo098FacilityManagerReviewTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant = Tenant.objects.create(name="FO098 Tenant", code="fo098-t")
        cls.other_tenant = Tenant.objects.create(name="FO098 Other", code="fo098-o")
        cls.organization = Organization.objects.create(
            tenant=cls.tenant,
            name="FO098 Org",
            code="fo098-org",
        )
        cls.building = Building.objects.create(
            tenant=cls.tenant,
            organization=cls.organization,
            name="FO098 Building",
            code="fo098-b",
        )
        employee_role = Role.objects.get(code="employee")
        fm_role = Role.objects.get(code="facility_manager")
        tech_role = Role.objects.get(code="technician")

        cls.employee = User.objects.create_user(
            email="fo098-employee@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.organization,
        )
        UserRole.objects.create(user=cls.employee, role=employee_role)

        cls.fm = User.objects.create_user(
            email="fo098-fm@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.organization,
        )
        UserRole.objects.create(user=cls.fm, role=fm_role)

        cls.technician = User.objects.create_user(
            email="fo098-tech@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.organization,
        )
        UserRole.objects.create(user=cls.technician, role=tech_role)

        cls.other_fm = User.objects.create_user(
            email="fo098-other-fm@example.com",
            password="Password123!",
            tenant=cls.other_tenant,
        )
        UserRole.objects.create(user=cls.other_fm, role=fm_role)

    def _create_employee_ticket(self):
        self.client.force_authenticate(user=self.employee)
        response = self.client.post(
            reverse("fm-ticket-list"),
            {"title": "FO098 leak concern"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return FmTicket.objects.get(id=response.data["id"])

    def _seed_completed_analysis(self, ticket: FmTicket) -> AITicketAnalysis:
        return AITicketAnalysis.objects.create(
            ticket=ticket,
            tenant=ticket.tenant,
            status=AITicketAnalysis.Status.COMPLETED,
            result_json={
                "findings": [
                    {
                        "title": "Water stain",
                        "description": "Ceiling discoloration",
                        "confidence": 82,
                    }
                ],
                "recommended_category": "Plumbing",
                "recommended_priority": "High",
                "severity": "Moderate",
                "overall_confidence": 80,
                "reasoning": "Visible water damage pattern.",
                "requires_human_review": True,
            },
        )

    def _decision_url(self, ticket_id, analysis_id):
        return (
            f"/api/fm-tickets/tickets/{ticket_id}/ai-analyses/"
            f"{analysis_id}/decision/"
        )

    def test_review_retrieval_exposes_recommendation_fields(self):
        ticket = self._create_employee_ticket()
        analysis = self._seed_completed_analysis(ticket)
        self.client.force_authenticate(user=self.fm)
        response = self.client.get(
            reverse("fm-ticket-ai-analyses", kwargs={"pk": ticket.id})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = response.data["results"][0]
        self.assertEqual(row["id"], str(analysis.id))
        self.assertEqual(row["recommended_category"], "Plumbing")
        self.assertEqual(row["recommended_priority"], "High")
        self.assertEqual(row["severity"], "Moderate")
        self.assertNotIn("raw_provider_response", row)
        self.assertFalse(any(key == "prompt" for key in row.keys()))

    def test_accept_modify_ignore_decisions(self):
        ticket = self._create_employee_ticket()
        self.client.force_authenticate(user=self.fm)

        accept_analysis = self._seed_completed_analysis(ticket)
        accept = self.client.post(
            self._decision_url(ticket.id, accept_analysis.id),
            {"decision": "accepted"},
            format="json",
        )
        self.assertEqual(accept.status_code, status.HTTP_200_OK)
        self.assertEqual(accept.data["decision"], "accepted")
        ticket.refresh_from_db()
        self.assertEqual(ticket.category, FmTicket.Category.UNCLASSIFIED)

        modify_analysis = self._seed_completed_analysis(ticket)
        modify = self.client.post(
            self._decision_url(ticket.id, modify_analysis.id),
            {
                "decision": "modified",
                "final_category": "plumbing",
                "final_priority": "high",
            },
            format="json",
        )
        self.assertEqual(modify.status_code, status.HTTP_200_OK)
        self.assertEqual(modify.data["decision"], "modified")

        ignore_analysis = self._seed_completed_analysis(ticket)
        ignore = self.client.post(
            self._decision_url(ticket.id, ignore_analysis.id),
            {"decision": "ignored"},
            format="json",
        )
        self.assertEqual(ignore.status_code, status.HTTP_200_OK)
        self.assertEqual(ignore.data["decision"], "ignored")

        history = self.client.get(
            reverse("fm-ticket-history", kwargs={"pk": ticket.id})
        )
        self.assertEqual(history.status_code, status.HTTP_200_OK)

    def test_assignment_blocked_until_classification_complete(self):
        ticket = self._create_employee_ticket()
        self.assertEqual(
            get_classification_block_reason(ticket), "unclassified_category"
        )
        with self.assertRaises(ValidationError):
            assert_ticket_ready_for_operational_actions(ticket=ticket)

        with self.assertRaises(ValidationError):
            assign_ticket(
                ticket=ticket,
                assigned_to=self.technician,
                assigned_by=self.fm,
            )

        ticket.category = FmTicket.Category.PLUMBING
        ticket.priority = FmTicket.Priority.HIGH
        ticket.building = self.building
        ticket.save()
        assigned = assign_ticket(
            ticket=ticket,
            assigned_to=self.technician,
            assigned_by=self.fm,
        )
        self.assertEqual(assigned.assignee_id, self.technician.id)

    def test_employee_cannot_decide_recommendation(self):
        ticket = self._create_employee_ticket()
        analysis = self._seed_completed_analysis(ticket)
        self.client.force_authenticate(user=self.employee)
        response = self.client.post(
            self._decision_url(ticket.id, analysis.id),
            {"decision": "accepted"},
            format="json",
        )
        self.assertIn(
            response.status_code,
            {status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND},
        )

    def test_cross_tenant_review_blocked(self):
        ticket = self._create_employee_ticket()
        analysis = self._seed_completed_analysis(ticket)
        self.client.force_authenticate(user=self.other_fm)
        response = self.client.get(
            reverse("fm-ticket-detail", kwargs={"pk": ticket.id})
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        decision = self.client.post(
            self._decision_url(ticket.id, analysis.id),
            {"decision": "accepted"},
            format="json",
        )
        self.assertEqual(decision.status_code, status.HTTP_404_NOT_FOUND)

    def test_record_decision_preserves_audit_without_auto_classify(self):
        ticket = self._create_employee_ticket()
        analysis = self._seed_completed_analysis(ticket)
        record_recommendation_decision(
            actor=self.fm,
            ticket_id=ticket.id,
            analysis_id=analysis.id,
            decision="accepted",
        )
        ticket.refresh_from_db()
        analysis.refresh_from_db()
        self.assertEqual(analysis.decision, "accepted")
        self.assertEqual(ticket.category, FmTicket.Category.UNCLASSIFIED)
        self.assertEqual(ticket.priority, FmTicket.Priority.PENDING_REVIEW)
