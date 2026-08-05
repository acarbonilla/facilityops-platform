"""FO-100 reporting alignment focused tests."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from apps.access_control.models import Role, UserRole
from apps.fm_tickets.ai_analytics_service import AIRecommendationAnalyticsService
from apps.fm_tickets.ai_similar_case_service import compute_similarity
from apps.fm_tickets.intake_reporting import (
    annotate_ticket_intake_counts,
    is_non_operational_final_value,
)
from apps.fm_tickets.models import AITicketAnalysis, FmTicket
from apps.master_data.models import Building, Organization, Tenant
from apps.reporting.services import build_ticket_summary


User = get_user_model()


class Fo100ReportingAlignmentTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant = Tenant.objects.create(name="FO100 Tenant", code="fo100-t")
        cls.organization = Organization.objects.create(
            tenant=cls.tenant,
            name="FO100 Org",
            code="fo100-org",
        )
        cls.building = Building.objects.create(
            tenant=cls.tenant,
            organization=cls.organization,
            name="FO100 Building",
            code="fo100-b",
        )
        cls.fm = User.objects.create_user(
            email="fo100-fm@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.organization,
        )
        UserRole.objects.create(
            user=cls.fm, role=Role.objects.get(code="facility_manager")
        )
        cls.employee = User.objects.create_user(
            email="fo100-employee@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.organization,
        )
        UserRole.objects.create(
            user=cls.employee, role=Role.objects.get(code="employee")
        )

    def test_ticket_summary_exposes_intake_counts(self):
        FmTicket.objects.create(
            tenant=self.tenant,
            organization=self.organization,
            requester=self.employee,
            title="Unclassified concern",
            category=FmTicket.Category.UNCLASSIFIED,
            priority=FmTicket.Priority.PENDING_REVIEW,
            status=FmTicket.Status.OPEN,
            source=FmTicket.Source.WEB,
            building=None,
        )
        FmTicket.objects.create(
            tenant=self.tenant,
            organization=self.organization,
            requester=self.employee,
            title="Classified concern",
            category=FmTicket.Category.PLUMBING,
            priority=FmTicket.Priority.HIGH,
            status=FmTicket.Status.OPEN,
            source=FmTicket.Source.WEB,
            building=self.building,
        )
        summary = build_ticket_summary(
            FmTicket.objects.filter(tenant=self.tenant, is_deleted=False),
            now=timezone.now(),
        )
        self.assertEqual(summary["unclassified_count"], 1)
        self.assertEqual(summary["pending_classification_count"], 1)
        self.assertEqual(summary["missing_building_count"], 1)
        self.assertEqual(summary["classified_count"], 1)
        self.assertGreaterEqual(summary["employee_intake_count"], 1)

    def test_agreement_excludes_intake_placeholder_finals(self):
        self.assertTrue(
            is_non_operational_final_value(
                category=FmTicket.Category.UNCLASSIFIED,
                priority=FmTicket.Priority.HIGH,
            )
        )
        self.assertTrue(
            is_non_operational_final_value(
                category=FmTicket.Category.PLUMBING,
                priority=FmTicket.Priority.PENDING_REVIEW,
            )
        )
        self.assertFalse(
            is_non_operational_final_value(
                category=FmTicket.Category.PLUMBING,
                priority=FmTicket.Priority.HIGH,
            )
        )

        ticket = FmTicket.objects.create(
            tenant=self.tenant,
            organization=self.organization,
            requester=self.employee,
            title="AI pending classification",
            category=FmTicket.Category.UNCLASSIFIED,
            priority=FmTicket.Priority.PENDING_REVIEW,
            status=FmTicket.Status.OPEN,
            source=FmTicket.Source.WEB,
            building=None,
        )
        AITicketAnalysis.objects.create(
            ticket=ticket,
            tenant=self.tenant,
            status=AITicketAnalysis.Status.COMPLETED,
            completed_at=timezone.now(),
            decision=AITicketAnalysis.Decision.MODIFIED,
            final_category=FmTicket.Category.UNCLASSIFIED,
            final_priority=FmTicket.Priority.PENDING_REVIEW,
            result_json={
                "schema_name": "FacilityRecommendationV1",
                "schema_version": "1.0",
                "recommended_category": "Plumbing",
                "recommended_priority": "High",
                "overall_confidence": 80,
                "findings": [],
                "requires_human_review": True,
            },
        )
        payload = AIRecommendationAnalyticsService().build(
            self.fm,
            {
                "start_date": (timezone.now() - timedelta(days=7))
                .date()
                .isoformat(),
                "end_date": timezone.now().date().isoformat(),
            },
        )
        summary = payload["summary"]
        self.assertGreaterEqual(summary["recommendation_count"], 1)
        self.assertEqual(summary["category_agreement_sample_size"], 0)
        self.assertGreaterEqual(
            summary["unclassified_ticket_recommendation_count"], 1
        )
        self.assertGreaterEqual(
            summary["ai_ready_awaiting_classification_count"], 1
        )

    def test_similar_cases_skip_unclassified_category_match(self):
        score, reasons, _ = compute_similarity(
            {
                "category": "unclassified",
                "priority": "pending_review",
                "keywords": ["leak"],
                "building_id": None,
                "asset_id": None,
            },
            {
                "category": "unclassified",
                "priority": "pending_review",
                "keywords": ["leak"],
                "building_id": None,
                "asset_id": None,
            },
        )
        self.assertTrue(all("Category matched" not in reason for reason in reasons))

    def test_annotate_ticket_intake_counts(self):
        FmTicket.objects.create(
            tenant=self.tenant,
            organization=self.organization,
            requester=self.employee,
            title="Intake",
            category=FmTicket.Category.UNCLASSIFIED,
            priority=FmTicket.Priority.PENDING_REVIEW,
            status=FmTicket.Status.OPEN,
            source=FmTicket.Source.WEB,
        )
        counts = annotate_ticket_intake_counts(
            FmTicket.objects.filter(tenant=self.tenant)
        )
        self.assertEqual(counts["classification_incomplete_count"], 1)
