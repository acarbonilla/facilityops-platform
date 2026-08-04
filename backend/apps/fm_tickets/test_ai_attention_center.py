"""FO-090 AI Attention Center tests."""

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
from apps.fm_tickets.ai_attention_center_service import (
    build_ai_attention_center,
    compute_overall_urgency,
    get_attention_thresholds,
)
from apps.fm_tickets.models import AITicketAnalysis, FmTicket
from apps.master_data.models import Building, Organization, Tenant

User = get_user_model()


def _recommendation_json(*, category="Plumbing", priority="Medium", confidence=65):
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
    FACILITYOPS_AI_PENDING_REVIEW_COUNT=2,
    FACILITYOPS_AI_HEALTH_NEEDS_REVIEW_MIN=50,
    FACILITYOPS_AI_HEALTH_HEALTHY_MIN=75,
    FACILITYOPS_AI_HIGH_VOLUME_COUNT=100,
    FACILITYOPS_AI_ATTENTION_CRITICAL_MIN=80,
    FACILITYOPS_AI_ATTENTION_HIGH_MIN=60,
    FACILITYOPS_AI_ATTENTION_MEDIUM_MIN=40,
)
class AIAttentionCenterTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="Tenant A", code="fo090-a")
        cls.tenant_b = Tenant.objects.create(name="Tenant B", code="fo090-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="Org A", code="fo090-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="Org B", code="fo090-org-b"
        )
        cls.building_a = Building.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            name="Building A",
            code="fo090-bldg-a",
        )
        cls.building_b = Building.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            name="Building B",
            code="fo090-bldg-b",
        )

        cls.manager = User.objects.create_user(
            email="fo090-manager@example.com",
            password="pass",
            tenant=cls.tenant_a,
        )
        cls.employee = User.objects.create_user(
            email="fo090-employee@example.com",
            password="pass",
            tenant=cls.tenant_a,
        )
        cls.manager_b = User.objects.create_user(
            email="fo090-manager-b@example.com",
            password="pass",
            tenant=cls.tenant_b,
        )
        cls.unauthorized = User.objects.create_user(
            email="fo090-unauthorized@example.com",
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
            ticket_number="FO090-A-001",
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
            ticket_number="FO090-B-001",
            category=FmTicket.Category.ELECTRICAL,
            priority=FmTicket.Priority.HIGH,
        )

        now = timezone.now()

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

        # Current period: pending backlog + overrides
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

        # Previous period: lower acceptance
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

    def test_urgency_calculation_and_weights(self):
        payload = {
            "summary": {
                "recommendation_count": 10,
                "reviewed_count": 8,
                "pending_review_count": 4,
                "modification_rate": 0.5,
                "acceptance_rate": 0.25,
            },
            "health_score": {"score": 40},
            "trend": {
                "override": {"direction": "increasing", "delta": 0.1},
                "acceptance": {"direction": "decreasing", "delta": -0.1},
                "confidence": {"direction": "decreasing", "delta": -12.0},
            },
        }
        urgency = compute_overall_urgency(payload)
        self.assertGreaterEqual(urgency["score"], 0)
        self.assertLessEqual(urgency["score"], 100)
        self.assertAlmostEqual(sum(urgency["weights"].values()), 1.0, places=4)
        self.assertIn(urgency["level"]["code"], {"critical", "high", "medium", "low"})
        self.assertIn("not model accuracy", urgency["interpretation"].lower())

    def test_empty_state_safe(self):
        empty_user = User.objects.create_user(
            email="fo090-empty@example.com",
            password="pass",
            tenant=self.tenant_a,
        )
        UserRole.objects.create(
            user=empty_user, role=Role.objects.get(code="facility_manager")
        )
        payload = build_ai_attention_center(
            empty_user,
            {"start_date": "2099-01-01", "end_date": "2099-01-30"},
        )
        self.assertEqual(payload["summary"]["attention_count"], 0)
        self.assertEqual(payload["attention_items"], [])
        self.assertEqual(payload["urgency_score"]["score"] >= 0, True)

    def test_attention_items_and_priority_ordering(self):
        payload = build_ai_attention_center(
            self.manager, {"period": "last_30_days"}
        )
        codes = {item["code"] for item in payload["attention_items"]}
        self.assertIn("large_pending_review_queue", codes)
        self.assertIn("high_override_rate", codes)
        self.assertIn("repeated_category_corrections", codes)
        scores = [item["urgency_score"] for item in payload["attention_items"]]
        self.assertEqual(scores, sorted(scores, reverse=True))
        self.assertTrue(
            all(
                item["suggested_action"]["actionable"] is False
                for item in payload["attention_items"]
            )
        )

    def test_attention_grouping(self):
        payload = build_ai_attention_center(
            self.manager, {"period": "last_30_days"}
        )
        self.assertTrue(payload["groups"])
        for group in payload["groups"]:
            self.assertEqual(group["count"], len(group["items"]))

    def test_threshold_configuration(self):
        thresholds = get_attention_thresholds()
        self.assertEqual(thresholds["pending_review_count"], 2)
        self.assertEqual(thresholds["level_critical_min"], 80)
        self.assertEqual(thresholds["weight_pending"], 0.25)

    def test_trend_indicators_present(self):
        payload = build_ai_attention_center(
            self.manager, {"period": "last_30_days"}
        )
        for key in ("acceptance", "override", "confidence", "agreement", "volume"):
            self.assertIn(key, payload["trend"])

    def test_tenant_isolation(self):
        payload_a = build_ai_attention_center(
            self.manager, {"period": "last_30_days"}
        )
        payload_b = build_ai_attention_center(
            self.manager_b, {"period": "last_30_days"}
        )
        self.assertGreater(payload_a["summary"]["recommendation_count"], 1)
        self.assertEqual(payload_b["summary"]["recommendation_count"], 1)

    def test_api_authorized(self):
        client = APIClient()
        client.force_authenticate(user=self.manager)
        response = client.get(
            reverse("reporting-ai-attention-center"),
            {"period": "last_30_days"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("urgency_score", response.data)
        self.assertIn("attention_items", response.data)
        body = str(response.data)
        self.assertNotIn(self.manager.email, body)
        self.assertNotIn("fo090-employee", body)
        self.assertNotIn("reasoning", body.lower())

    def test_api_unauthorized(self):
        client = APIClient()
        client.force_authenticate(user=self.unauthorized)
        response = client.get(reverse("reporting-ai-attention-center"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_api_employee_denied(self):
        client = APIClient()
        client.force_authenticate(user=self.employee)
        response = client.get(reverse("reporting-ai-attention-center"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_critical_items_subset(self):
        payload = build_ai_attention_center(
            self.manager, {"period": "last_30_days"}
        )
        for item in payload["critical_items"]:
            self.assertEqual(item["priority"]["code"], "critical")
            self.assertIn(item, payload["attention_items"])
