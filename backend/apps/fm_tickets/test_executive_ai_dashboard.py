"""FO-092 Executive AI Dashboard tests."""

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
from apps.fm_tickets.executive_ai_dashboard_service import (
    _build_executive_summary,
    _classify_delta,
    build_executive_ai_dashboard,
)
from apps.fm_tickets.models import AITicketAnalysis, FmTicket
from apps.master_data.models import Building, Organization, Tenant

User = get_user_model()


def _recommendation_json(*, category="Plumbing", priority="Medium", confidence=80):
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
class ExecutiveAIDashboardTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="Tenant A", code="fo092-a")
        cls.tenant_b = Tenant.objects.create(name="Tenant B", code="fo092-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="Org A", code="fo092-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="Org B", code="fo092-org-b"
        )
        cls.building_a = Building.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            name="Building A",
            code="fo092-bldg-a",
        )
        cls.building_b = Building.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            name="Building B",
            code="fo092-bldg-b",
        )

        cls.manager = User.objects.create_user(
            email="fo092-manager@example.com",
            password="pass",
            tenant=cls.tenant_a,
        )
        cls.employee = User.objects.create_user(
            email="fo092-employee@example.com",
            password="pass",
            tenant=cls.tenant_a,
        )
        cls.manager_b = User.objects.create_user(
            email="fo092-manager-b@example.com",
            password="pass",
            tenant=cls.tenant_b,
        )
        cls.unauthorized = User.objects.create_user(
            email="fo092-unauthorized@example.com",
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
            ticket_number="FO092-A-001",
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
            ticket_number="FO092-B-001",
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
            confidence=80,
            days_ago=1,
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
                requested_by=cls.manager,
            )

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
            final_category="electrical",
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
            decision="accepted",
            final_category="plumbing",
            final_priority="medium",
            confidence=85,
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
            confidence=88,
            days_ago=2,
        )

    def _params(self, **overrides):
        params = {
            "start_date": (timezone.localdate() - timedelta(days=30)).isoformat(),
            "end_date": timezone.localdate().isoformat(),
        }
        params.update(overrides)
        return params

    def test_classify_delta_stable_and_directions(self):
        self.assertEqual(_classify_delta(0.50, 0.48, tolerance=0.05), "stable")
        self.assertEqual(_classify_delta(0.60, 0.40, tolerance=0.05), "increase")
        self.assertEqual(_classify_delta(0.20, 0.40, tolerance=0.05), "decrease")

    def test_executive_summary_empty_and_states(self):
        empty = _build_executive_summary(
            analytics_summary={"recommendation_count": 0},
            health={"band": "healthy", "score": 80, "label": "Healthy"},
            urgency={"score": 10, "level": {"code": "low"}},
            period_comparison={},
            attention_summary={"critical_count": 0},
        )
        self.assertEqual(empty["status"], "stable")
        self.assertIn("No eligible", empty["headline"])

        healthy = _build_executive_summary(
            analytics_summary={
                "recommendation_count": 10,
                "acceptance_rate": 0.70,
                "modification_rate": 0.10,
                "pending_review_count": 1,
            },
            health={"band": "healthy", "score": 82, "label": "Healthy"},
            urgency={"score": 20, "level": {"code": "low", "label": "Low"}},
            period_comparison={"acceptance_rate": {"direction": "increase"}},
            attention_summary={"critical_count": 0},
        )
        self.assertEqual(healthy["status"], "healthy")

        needs = _build_executive_summary(
            analytics_summary={
                "recommendation_count": 10,
                "acceptance_rate": 0.20,
                "modification_rate": 0.50,
                "pending_review_count": 12,
            },
            health={"band": "attention", "score": 30, "label": "Attention"},
            urgency={"score": 85, "level": {"code": "critical", "label": "Critical"}},
            period_comparison={
                "acceptance_rate": {"direction": "decrease"},
                "modification_rate": {"direction": "increase"},
                "pending_review_count": {"direction": "increase"},
            },
            attention_summary={"critical_count": 2},
        )
        self.assertEqual(needs["status"], "needs_attention")

    def test_dashboard_kpis_and_sections(self):
        payload = build_executive_ai_dashboard(self.manager, self._params())
        summary = payload["summary"]
        self.assertGreaterEqual(summary["completed_analyses"], 4)
        self.assertGreaterEqual(summary["reviewed_count"], 3)
        self.assertGreaterEqual(summary["pending_review_count"], 1)
        self.assertIn("acceptance_rate", summary)
        self.assertIn("override_rate", summary)
        self.assertIn("category_agreement_rate", summary)
        self.assertIn("priority_agreement_rate", summary)
        self.assertIn("operational_health_score", summary)
        self.assertIn("attention_urgency_score", summary)
        self.assertIn(payload["executive_summary"]["status"], {
            "healthy",
            "stable",
            "needs_attention",
        })
        self.assertIn("period_comparison", payload)
        self.assertTrue(isinstance(payload["decision_trend"], list))
        self.assertTrue(isinstance(payload["top_category_overrides"], list))
        self.assertEqual(payload["knowledge_summary"]["status"], "deferred")
        self.assertFalse(payload["knowledge_summary"]["available"])

    def test_empty_period(self):
        payload = build_executive_ai_dashboard(
            self.manager,
            {
                "start_date": (timezone.localdate() + timedelta(days=2)).isoformat(),
                "end_date": (timezone.localdate() + timedelta(days=5)).isoformat(),
            },
        )
        self.assertEqual(payload["summary"]["completed_analyses"], 0)
        self.assertEqual(payload["executive_summary"]["status"], "stable")

    def test_tenant_isolation_and_privacy(self):
        payload = build_executive_ai_dashboard(self.manager, self._params())
        serialized = str(payload).lower()
        self.assertNotIn("fo092-manager@example.com", serialized)
        self.assertNotIn("reasoning", serialized)
        self.assertNotIn("gemini-2.0-flash", serialized)
        # Tenant B volume must not inflate Tenant A counts beyond local fixtures.
        self.assertLessEqual(payload["summary"]["completed_analyses"], 5)

    def test_api_authorized(self):
        client = APIClient()
        client.force_authenticate(user=self.manager)
        response = client.get(
            reverse("reporting-ai-executive-dashboard"), self._params()
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("summary", response.data)
        self.assertIn("executive_summary", response.data)
        self.assertIn("attention_summary", response.data)

    def test_api_unauthorized(self):
        client = APIClient()
        client.force_authenticate(user=self.unauthorized)
        response = client.get(
            reverse("reporting-ai-executive-dashboard"), self._params()
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_api_employee_denied(self):
        client = APIClient()
        client.force_authenticate(user=self.employee)
        response = client.get(
            reverse("reporting-ai-executive-dashboard"), self._params()
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_zero_denominator_safe(self):
        payload = build_executive_ai_dashboard(
            self.manager,
            {
                "start_date": (timezone.localdate() + timedelta(days=10)).isoformat(),
                "end_date": (timezone.localdate() + timedelta(days=12)).isoformat(),
            },
        )
        self.assertEqual(payload["summary"]["acceptance_rate"], 0.0)
        self.assertEqual(payload["summary"]["override_rate"], 0.0)
