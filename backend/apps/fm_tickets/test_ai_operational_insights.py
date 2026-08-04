"""FO-089 AI operational insights tests."""

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
from apps.fm_tickets.ai_operational_insights_service import (
    compute_operational_health,
    get_insight_thresholds,
    build_ai_operational_insights,
    _classify_trend,
)
from apps.fm_tickets.models import AITicketAnalysis, FmTicket
from apps.master_data.models import Building, Organization, Tenant

User = get_user_model()


def _recommendation_json(
    *,
    category="Plumbing",
    priority="Medium",
    confidence=65,
):
    return {
        "schema_version": "1.0",
        "schema_name": "FacilityRecommendationV1",
        "analysis_summary": "Visible facility condition.",
        "image_results": [],
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
        "severity": "Moderate",
        "overall_confidence": confidence,
        "reasoning": "Visible evidence supports the recommendation.",
        "requires_human_review": True,
        "limitations": ["Photo cannot confirm root cause"],
    }


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
    FACILITYOPS_AI_HIGH_OVERRIDE_RATE=0.30,
    FACILITYOPS_AI_LOW_ACCEPTANCE_RATE=0.40,
    FACILITYOPS_AI_HIGH_ACCEPTANCE_RATE=0.60,
    FACILITYOPS_AI_PENDING_REVIEW_COUNT=2,
    FACILITYOPS_AI_LOW_CONFIDENCE_THRESHOLD=50,
    FACILITYOPS_AI_HIGH_CONFIDENCE_THRESHOLD=80,
    FACILITYOPS_AI_HIGH_VOLUME_COUNT=100,
    FACILITYOPS_AI_LOW_VOLUME_COUNT=1,
    FACILITYOPS_AI_TREND_STABLE_DELTA=0.05,
)
class AIOperationalInsightsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="Tenant A", code="fo089-a")
        cls.tenant_b = Tenant.objects.create(name="Tenant B", code="fo089-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="Org A", code="fo089-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="Org B", code="fo089-org-b"
        )
        cls.building_a = Building.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            name="Building A",
            code="fo089-bldg-a",
        )
        cls.building_b = Building.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            name="Building B",
            code="fo089-bldg-b",
        )

        cls.manager = User.objects.create_user(
            email="fo089-manager@example.com",
            password="pass",
            tenant=cls.tenant_a,
        )
        cls.employee = User.objects.create_user(
            email="fo089-employee@example.com",
            password="pass",
            tenant=cls.tenant_a,
        )
        cls.manager_b = User.objects.create_user(
            email="fo089-manager-b@example.com",
            password="pass",
            tenant=cls.tenant_b,
        )
        cls.unauthorized = User.objects.create_user(
            email="fo089-unauthorized@example.com",
            password="pass",
            tenant=cls.tenant_a,
        )

        mgr_role = Role.objects.get(code="facility_manager")
        emp_role = Role.objects.get(code="employee")
        UserRole.objects.create(user=cls.manager, role=mgr_role)
        UserRole.objects.create(user=cls.manager_b, role=mgr_role)
        UserRole.objects.create(user=cls.employee, role=emp_role)
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
            ticket_number="FO089-A-001",
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
            ticket_number="FO089-B-001",
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
            days_ago=1,
            requested_by=None,
        ):
            completed = now - timedelta(days=days_ago)
            return AITicketAnalysis.objects.create(
                tenant=tenant,
                ticket=ticket,
                status=AITicketAnalysis.Status.COMPLETED,
                queued_at=completed - timedelta(minutes=5),
                started_at=completed - timedelta(minutes=4),
                completed_at=completed,
                provider="gemini",
                model_name="gemini-2.0-flash",
                schema_version="1.0",
                result_json=_recommendation_json(
                    category=category,
                    priority=priority,
                    confidence=confidence,
                ),
                decision=decision,
                decision_recommended_category=category if decision else "",
                decision_recommended_priority=priority if decision else "",
                final_category=final_category,
                final_priority=final_priority,
                decision_at=completed if decision else None,
                decision_by=cls.manager if decision else None,
                requested_by=requested_by or cls.manager,
            )

        cls.make_analysis = staticmethod(make_analysis)

        # Current period (~last 30 days): mix of decisions
        make_analysis(
            ticket=cls.ticket_a,
            tenant=cls.tenant_a,
            decision="accepted",
            final_category="plumbing",
            final_priority="medium",
            confidence=90,
            days_ago=2,
        )
        make_analysis(
            ticket=cls.ticket_a,
            tenant=cls.tenant_a,
            decision="modified",
            final_category="civil",
            final_priority="high",
            confidence=55,
            days_ago=3,
        )
        make_analysis(
            ticket=cls.ticket_a,
            tenant=cls.tenant_a,
            decision="ignored",
            confidence=40,
            days_ago=4,
        )
        make_analysis(
            ticket=cls.ticket_a,
            tenant=cls.tenant_a,
            decision="",
            confidence=70,
            days_ago=1,
        )
        make_analysis(
            ticket=cls.ticket_a,
            tenant=cls.tenant_a,
            decision="",
            confidence=72,
            days_ago=5,
        )

        # Previous period (~31–60 days ago): lower acceptance / agreement
        make_analysis(
            ticket=cls.ticket_a,
            tenant=cls.tenant_a,
            decision="modified",
            final_category="electrical",
            final_priority="urgent",
            category="Plumbing",
            priority="Low",
            confidence=45,
            days_ago=35,
        )
        make_analysis(
            ticket=cls.ticket_a,
            tenant=cls.tenant_a,
            decision="ignored",
            confidence=42,
            days_ago=40,
        )

        # Tenant B isolation row
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
            requested_by=cls.manager_b,
        )

    def test_health_score_formula_and_bands(self):
        summary = {
            "recommendation_count": 4,
            "reviewed_count": 3,
            "pending_review_count": 1,
            "acceptance_rate": 1 / 3,
            "full_agreement_rate": 0.5,
            "full_agreement_sample_size": 2,
            "average_confidence": 63.8,
        }
        health = compute_operational_health(summary)
        # Weights 0.3/0.3/0.2/0.2
        # acceptance 33.33, agreement 50, pending 75, confidence 63.8
        expected = round(
            0.3 * (100 / 3) + 0.3 * 50 + 0.2 * 75 + 0.2 * 63.8
        )
        self.assertEqual(health["score"], expected)
        self.assertIn(health["band"], {"healthy", "needs_review", "attention"})
        self.assertEqual(sum(health["weights"].values()), 1.0)
        self.assertIn("not model accuracy", health["interpretation"].lower())

    def test_health_score_null_safe_empty(self):
        health = compute_operational_health(
            {
                "recommendation_count": 0,
                "reviewed_count": 0,
                "pending_review_count": 0,
                "acceptance_rate": 0.0,
                "full_agreement_rate": 0.0,
                "full_agreement_sample_size": 0,
                "average_confidence": None,
            }
        )
        # All neutral 50 → score 50
        self.assertEqual(health["score"], 50)
        self.assertEqual(health["band"], "needs_review")

    def test_classify_trend_directions(self):
        self.assertEqual(_classify_trend(0.8, 0.5, 0.05), "increasing")
        self.assertEqual(_classify_trend(0.4, 0.6, 0.05), "decreasing")
        self.assertEqual(_classify_trend(0.52, 0.50, 0.05), "stable")
        self.assertEqual(_classify_trend(None, 0.5, 0.05), "stable")

    def test_threshold_configuration(self):
        thresholds = get_insight_thresholds()
        self.assertEqual(thresholds["high_override_rate"], 0.30)
        self.assertEqual(thresholds["pending_review_count"], 2)
        self.assertEqual(thresholds["high_acceptance_rate"], 0.60)

    def test_insights_and_recommendations_generated(self):
        payload = build_ai_operational_insights(
            self.manager, {"period": "last_30_days"}
        )
        codes = {item["code"] for item in payload["insights"]}
        self.assertIn("high_override_rate", codes)
        self.assertIn("recommendations_awaiting_review", codes)
        self.assertIn("frequently_corrected_categories", codes)
        self.assertTrue(payload["recommendations"])
        self.assertTrue(
            all(item["actionable"] is False for item in payload["recommendations"])
        )
        self.assertEqual(payload["health_score"]["score"] >= 0, True)
        self.assertLessEqual(payload["health_score"]["score"], 100)

    def test_trend_comparison_present(self):
        payload = build_ai_operational_insights(
            self.manager, {"period": "last_30_days"}
        )
        for key in ("acceptance", "override", "confidence", "agreement", "volume"):
            self.assertIn(key, payload["trend"])
            self.assertIn(
                payload["trend"][key]["direction"],
                {"increasing", "stable", "decreasing"},
            )
        self.assertIn("current", payload["comparison"])
        self.assertIn("previous", payload["comparison"])
        self.assertGreater(
            payload["comparison"]["current"]["recommendation_count"], 0
        )

    def test_improving_and_declining_detection(self):
        payload = build_ai_operational_insights(
            self.manager, {"period": "last_30_days"}
        )
        # Current acceptance 1/3 vs previous 0/2 → increasing
        self.assertEqual(payload["trend"]["acceptance"]["direction"], "increasing")

    def test_no_data_insight(self):
        empty_user = User.objects.create_user(
            email="fo089-empty@example.com",
            password="pass",
            tenant=self.tenant_a,
        )
        UserRole.objects.create(
            user=empty_user, role=Role.objects.get(code="facility_manager")
        )
        payload = build_ai_operational_insights(
            empty_user,
            {"start_date": "2099-01-01", "end_date": "2099-01-30"},
        )
        self.assertEqual(payload["summary"]["recommendation_count"], 0)
        self.assertEqual(payload["insights"][0]["code"], "no_data")
        self.assertEqual(payload["health_score"]["score"], 50)

    def test_tenant_isolation(self):
        payload_a = build_ai_operational_insights(
            self.manager, {"period": "last_30_days"}
        )
        payload_b = build_ai_operational_insights(
            self.manager_b, {"period": "last_30_days"}
        )
        self.assertGreater(payload_a["summary"]["recommendation_count"], 1)
        self.assertEqual(payload_b["summary"]["recommendation_count"], 1)
        self.assertEqual(payload_b["summary"]["average_confidence"], 99.0)

    def test_api_authorized(self):
        client = APIClient()
        client.force_authenticate(user=self.manager)
        response = client.get(
            reverse("reporting-ai-operational-insights"),
            {"period": "last_30_days"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("health_score", response.data)
        self.assertIn("insights", response.data)
        self.assertIn("recommendations", response.data)
        self.assertIn("trend", response.data)
        body = str(response.data)
        self.assertNotIn(self.manager.email, body)
        self.assertNotIn("fo089-employee", body)
        self.assertNotIn("reasoning", body.lower())

    def test_api_unauthorized(self):
        client = APIClient()
        client.force_authenticate(user=self.unauthorized)
        response = client.get(reverse("reporting-ai-operational-insights"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_api_employee_requester_denied(self):
        client = APIClient()
        client.force_authenticate(user=self.employee)
        response = client.get(reverse("reporting-ai-operational-insights"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_period_comparison_bounds(self):
        payload = build_ai_operational_insights(
            self.manager, {"period": "last_30_days"}
        )
        self.assertTrue(payload["comparison_period"]["start_date"])
        self.assertTrue(payload["comparison_period"]["end_date"])
        self.assertNotEqual(
            payload["period"]["start_date"],
            payload["comparison_period"]["start_date"],
        )

    def test_safe_calculations_and_cards(self):
        payload = build_ai_operational_insights(
            self.manager, {"period": "last_30_days"}
        )
        card_codes = {card["code"] for card in payload["cards"]}
        self.assertIn("health", card_codes)
        self.assertIn("pending_reviews", card_codes)
        self.assertTrue(payload["manager_notes"]["placeholder"])
        self.assertFalse(
            any("password" in str(item).lower() for item in payload["insights"])
        )
