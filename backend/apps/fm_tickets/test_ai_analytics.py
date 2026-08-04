"""FO-088 AI recommendation analytics tests."""

from __future__ import annotations

from datetime import timedelta
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.access_control.models import Role, UserRole
from apps.fm_tickets.ai_analytics_service import (
    AIRecommendationAnalyticsService,
    build_ai_recommendation_analytics,
)
from apps.fm_tickets.models import AITicketAnalysis, FmTicket
from apps.master_data.models import Building, Organization, Tenant

User = get_user_model()


def _recommendation_json(
    *,
    category="Plumbing",
    priority="Medium",
    severity="Moderate",
    confidence=65,
):
    return {
        "schema_version": "1.0",
        "schema_name": "FacilityRecommendationV1",
        "analysis_summary": "Visible facility condition.",
        "image_results": [
            {
                "attachment_id": str(uuid4()),
                "image_index": 1,
                "image_quality": {"usable": True, "issues": []},
                "observations": [
                    {
                        "observation": "Staining near fixture",
                        "evidence": "Brown staining",
                        "region": "upper-center",
                        "confidence": 0.8,
                    }
                ],
                "visible_assets": [],
                "visible_hazards": [],
                "cannot_determine": [],
            }
        ],
        "cross_image_findings": [],
        "overall_image_quality": "adequate",
        "findings": [
            {
                "title": "Water leak",
                "description": "Observable facility condition.",
                "confidence": confidence,
            }
        ],
        "recommended_category": category,
        "recommended_priority": priority,
        "severity": severity,
        "overall_confidence": confidence,
        "reasoning": "Visible evidence supports the recommendation.",
        "requires_human_review": True,
        "limitations": ["Photo cannot confirm root cause"],
    }


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class AIRecommendationAnalyticsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="Tenant A", code="fo088-a")
        cls.tenant_b = Tenant.objects.create(name="Tenant B", code="fo088-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="Org A", code="fo088-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="Org B", code="fo088-org-b"
        )
        cls.building_a = Building.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            name="Building A",
            code="fo088-bldg-a",
        )
        cls.building_b = Building.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            name="Building B",
            code="fo088-bldg-b",
        )

        cls.manager = User.objects.create_user(
            email="fo088-manager@example.com",
            password="pass",
            tenant=cls.tenant_a,
        )
        cls.employee = User.objects.create_user(
            email="fo088-employee@example.com",
            password="pass",
            tenant=cls.tenant_a,
        )
        cls.manager_b = User.objects.create_user(
            email="fo088-manager-b@example.com",
            password="pass",
            tenant=cls.tenant_b,
        )
        cls.unauthorized = User.objects.create_user(
            email="fo088-unauthorized@example.com",
            password="pass",
            tenant=cls.tenant_a,
        )

        mgr_role = Role.objects.get(code="facility_manager")
        emp_role = Role.objects.get(code="employee")
        UserRole.objects.create(user=cls.manager, role=mgr_role)
        UserRole.objects.create(user=cls.manager_b, role=mgr_role)
        UserRole.objects.create(user=cls.employee, role=emp_role)

        # Explicitly ensure unauthorized has no reporting.view
        bare_role = Role.objects.create(
            name="Bare",
            code=f"bare-{uuid4().hex[:8]}",
            is_active=True,
        )
        UserRole.objects.create(user=cls.unauthorized, role=bare_role)

        cls.ticket_a = FmTicket.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            requester=cls.manager,
            title="Leak A",
            description="desc",
            ticket_number="FO088-A-001",
            category=FmTicket.Category.PLUMBING,
            priority=FmTicket.Priority.MEDIUM,
        )
        cls.ticket_b = FmTicket.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            building=cls.building_b,
            requester=cls.manager_b,
            title="Leak B",
            description="desc",
            ticket_number="FO088-B-001",
            category=FmTicket.Category.ELECTRICAL,
            priority=FmTicket.Priority.HIGH,
        )

        now = timezone.now()
        cls.now = now

        def make_analysis(
            *,
            ticket,
            tenant,
            decision="",
            final_category="",
            final_priority="",
            category="Plumbing",
            priority="Medium",
            confidence=65,
            status=AITicketAnalysis.Status.COMPLETED,
            completed_at=None,
            days_ago=1,
            provider="gemini",
            model_name="gemini-2.0-flash",
        ):
            completed = completed_at or (now - timedelta(days=days_ago))
            analysis = AITicketAnalysis.objects.create(
                tenant=tenant,
                ticket=ticket,
                status=status,
                queued_at=completed - timedelta(minutes=5),
                started_at=completed - timedelta(minutes=4),
                completed_at=(
                    completed if status == AITicketAnalysis.Status.COMPLETED else None
                ),
                provider=provider,
                model_name=model_name,
                schema_version="1.0",
                result_json=(
                    _recommendation_json(
                        category=category,
                        priority=priority,
                        confidence=confidence,
                    )
                    if status == AITicketAnalysis.Status.COMPLETED
                    else {}
                ),
                decision=decision,
                decision_recommended_category=category if decision else "",
                decision_recommended_priority=priority if decision else "",
                final_category=final_category,
                final_priority=final_priority,
                decision_at=completed if decision else None,
                decision_by=cls.manager if decision else None,
                requested_by=cls.manager,
            )
            return analysis

        cls.make_analysis = staticmethod(make_analysis)

        # Tenant A dataset
        make_analysis(
            ticket=cls.ticket_a,
            tenant=cls.tenant_a,
            decision="accepted",
            final_category="plumbing",
            final_priority="medium",
            category="Plumbing",
            priority="Medium",
            confidence=90,
            days_ago=2,
        )
        make_analysis(
            ticket=cls.ticket_a,
            tenant=cls.tenant_a,
            decision="modified",
            final_category="civil",
            final_priority="high",
            category="Plumbing",
            priority="Medium",
            confidence=55,
            days_ago=3,
        )
        make_analysis(
            ticket=cls.ticket_a,
            tenant=cls.tenant_a,
            decision="ignored",
            final_category="",
            final_priority="",
            category="Electrical",
            priority="High",
            confidence=40,
            days_ago=4,
        )
        make_analysis(
            ticket=cls.ticket_a,
            tenant=cls.tenant_a,
            decision="",
            category="HVAC",
            priority="Low",
            confidence=70,
            days_ago=1,
        )
        # Exclusions: failed / processing / no schema
        make_analysis(
            ticket=cls.ticket_a,
            tenant=cls.tenant_a,
            status=AITicketAnalysis.Status.FAILED,
            days_ago=1,
        )
        make_analysis(
            ticket=cls.ticket_a,
            tenant=cls.tenant_a,
            status=AITicketAnalysis.Status.PROCESSING,
            days_ago=1,
        )
        bad = make_analysis(
            ticket=cls.ticket_a,
            tenant=cls.tenant_a,
            days_ago=1,
            confidence=10,
        )
        bad.result_json = {"schema_name": "Other", "overall_confidence": 10}
        bad.save(update_fields=["result_json"])

        # Tenant B should never leak into A
        make_analysis(
            ticket=cls.ticket_b,
            tenant=cls.tenant_b,
            decision="accepted",
            final_category="electrical",
            final_priority="high",
            category="Electrical",
            priority="High",
            confidence=99,
            days_ago=1,
        )

    def test_empty_dataset(self):
        empty_user = User.objects.create_user(
            email="fo088-empty@example.com",
            password="pass",
            tenant=self.tenant_a,
        )
        UserRole.objects.create(
            user=empty_user, role=Role.objects.get(code="facility_manager")
        )
        # Far future period with no data
        payload = build_ai_recommendation_analytics(
            empty_user,
            {
                "start_date": "2099-01-01",
                "end_date": "2099-01-07",
            },
        )
        self.assertEqual(payload["summary"]["recommendation_count"], 0)
        self.assertEqual(payload["summary"]["acceptance_rate"], 0.0)
        self.assertIsNone(payload["summary"]["average_confidence"])

    def test_summary_counts_and_rates(self):
        payload = build_ai_recommendation_analytics(
            self.manager,
            {"period": "last_90_days"},
        )
        summary = payload["summary"]
        self.assertEqual(summary["recommendation_count"], 4)
        self.assertEqual(summary["reviewed_count"], 3)
        self.assertEqual(summary["pending_review_count"], 1)
        self.assertEqual(summary["accepted_count"], 1)
        self.assertEqual(summary["modified_count"], 1)
        self.assertEqual(summary["ignored_count"], 1)
        self.assertEqual(summary["acceptance_rate"], round(1 / 3, 4))
        self.assertEqual(summary["modification_rate"], round(1 / 3, 4))
        self.assertEqual(summary["ignore_rate"], round(1 / 3, 4))

    def test_agreement_excludes_ignored_without_finals(self):
        payload = build_ai_recommendation_analytics(
            self.manager,
            {"period": "last_90_days"},
        )
        summary = payload["summary"]
        # accepted: plumbing==plumbing, medium==medium
        # modified: plumbing!=civil, medium!=high
        # ignored: no finals → excluded from denominators
        self.assertEqual(summary["category_agreement_sample_size"], 2)
        self.assertEqual(summary["category_agreement_rate"], round(1 / 2, 4))
        self.assertEqual(summary["priority_agreement_sample_size"], 2)
        self.assertEqual(summary["priority_agreement_rate"], round(1 / 2, 4))
        self.assertEqual(summary["full_agreement_sample_size"], 2)
        self.assertEqual(summary["full_agreement_rate"], round(1 / 2, 4))

    def test_average_confidence_and_bands(self):
        payload = build_ai_recommendation_analytics(
            self.manager,
            {"period": "last_90_days"},
        )
        # 90, 55, 40, 70 → avg 63.75 → 63.8
        self.assertEqual(payload["summary"]["average_confidence"], 63.8)
        bands = {b["band"]: b for b in payload["confidence_bands"]}
        self.assertEqual(bands["low"]["count"], 1)  # 40
        self.assertEqual(bands["medium"]["count"], 2)  # 55, 70
        self.assertEqual(bands["high"]["count"], 0)
        self.assertEqual(bands["very_high"]["count"], 1)  # 90

        by_decision = {
            row["decision"]: row for row in payload["confidence_by_decision"]
        }
        self.assertEqual(by_decision["accepted"]["average_confidence"], 90.0)
        self.assertEqual(by_decision["modified"]["average_confidence"], 55.0)
        self.assertEqual(by_decision["ignored"]["average_confidence"], 40.0)
        self.assertEqual(by_decision["pending"]["average_confidence"], 70.0)

    def test_override_pairs(self):
        payload = build_ai_recommendation_analytics(
            self.manager,
            {"period": "last_90_days"},
        )
        self.assertEqual(len(payload["category_overrides"]), 1)
        self.assertEqual(payload["category_overrides"][0]["recommended"], "Plumbing")
        self.assertEqual(payload["category_overrides"][0]["final"], "civil")
        self.assertEqual(payload["priority_overrides"][0]["recommended"], "Medium")
        self.assertEqual(payload["priority_overrides"][0]["final"], "high")

    def test_decision_filter_and_date_filter(self):
        payload = build_ai_recommendation_analytics(
            self.manager,
            {"period": "last_90_days", "decision": "accepted"},
        )
        self.assertEqual(payload["summary"]["recommendation_count"], 1)
        self.assertEqual(payload["summary"]["accepted_count"], 1)

        start = (self.now - timedelta(days=2)).date().isoformat()
        end = self.now.date().isoformat()
        payload = build_ai_recommendation_analytics(
            self.manager,
            {"start_date": start, "end_date": end},
        )
        # days_ago 1 and 2 only (accepted + pending); modified=3, ignored=4 excluded
        self.assertEqual(payload["summary"]["recommendation_count"], 2)

    def test_category_filter(self):
        payload = build_ai_recommendation_analytics(
            self.manager,
            {"period": "last_90_days", "category": "hvac"},
        )
        self.assertEqual(payload["summary"]["recommendation_count"], 1)
        self.assertEqual(payload["summary"]["pending_review_count"], 1)

    def test_tenant_isolation(self):
        payload_a = build_ai_recommendation_analytics(
            self.manager, {"period": "last_90_days"}
        )
        payload_b = build_ai_recommendation_analytics(
            self.manager_b, {"period": "last_90_days"}
        )
        self.assertEqual(payload_a["summary"]["recommendation_count"], 4)
        self.assertEqual(payload_b["summary"]["recommendation_count"], 1)
        self.assertEqual(payload_b["summary"]["average_confidence"], 99.0)

    def test_failed_processing_excluded(self):
        payload = build_ai_recommendation_analytics(
            self.manager, {"period": "last_90_days"}
        )
        self.assertEqual(payload["summary"]["recommendation_count"], 4)

    def test_safe_division_and_rounding(self):
        service = AIRecommendationAnalyticsService()
        filters = service.resolve_filters({"period": "last_7_days"})
        empty = service._aggregate(filters, [])
        self.assertEqual(empty["summary"]["acceptance_rate"], 0.0)
        self.assertEqual(empty["summary"]["modification_rate"], 0.0)

    def test_api_authorized(self):
        client = APIClient()
        client.force_authenticate(user=self.manager)
        url = reverse("reporting-ai-insights")
        response = client.get(url, {"period": "last_90_days"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["summary"]["recommendation_count"], 4)
        # Privacy: no requester identities
        body = str(response.data)
        self.assertNotIn(self.manager.email, body)
        self.assertNotIn("fo088-employee", body)

    def test_api_unauthorized(self):
        client = APIClient()
        client.force_authenticate(user=self.unauthorized)
        response = client.get(reverse("reporting-ai-insights"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_api_employee_requester_denied(self):
        client = APIClient()
        client.force_authenticate(user=self.employee)
        response = client.get(reverse("reporting-ai-insights"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_invalid_date_range(self):
        client = APIClient()
        client.force_authenticate(user=self.manager)
        response = client.get(
            reverse("reporting-ai-insights"),
            {"start_date": "2026-06-01", "end_date": "2026-01-01"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
