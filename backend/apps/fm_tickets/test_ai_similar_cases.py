"""FO-091 AI Knowledge Base / Similar Cases tests."""

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
from apps.fm_tickets.ai_similar_case_service import (
    build_ai_similar_cases,
    compute_similarity,
    extract_keywords,
    get_similarity_weights,
)
from apps.fm_tickets.models import AITicketAnalysis, FmTicket
from apps.inspection.models import Inspection
from apps.maintenance.models import MaintenanceWorkOrder
from apps.master_data.models import Asset, AssetType, Building, Organization, Tenant

User = get_user_model()


def _recommendation_json(*, category="HVAC", priority="High", confidence=80):
    return {
        "schema_version": "1.0",
        "schema_name": "FacilityRecommendationV1",
        "analysis_summary": "Visible facility condition.",
        "image_results": [],
        "cross_image_findings": [],
        "overall_image_quality": "adequate",
        "findings": [
            {
                "title": "Cooling leakage",
                "description": "Observable condensate leakage near unit.",
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
)
class AISimilarCaseTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="Tenant A", code="fo091-a")
        cls.tenant_b = Tenant.objects.create(name="Tenant B", code="fo091-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="Org A", code="fo091-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="Org B", code="fo091-org-b"
        )
        cls.building_a = Building.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            name="Building A",
            code="fo091-bldg-a",
        )
        cls.building_b = Building.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            name="Building B",
            code="fo091-bldg-b",
        )
        cls.asset_type = AssetType.objects.create(
            tenant=cls.tenant_a, name="HVAC Unit", code="fo091-type-hvac"
        )
        cls.asset_a = Asset.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            asset_type=cls.asset_type,
            name="Rooftop HVAC",
            code="fo091-hvac-1",
        )

        cls.manager = User.objects.create_user(
            email="fo091-manager@example.com",
            password="pass",
            tenant=cls.tenant_a,
        )
        cls.employee = User.objects.create_user(
            email="fo091-employee@example.com",
            password="pass",
            tenant=cls.tenant_a,
        )
        cls.manager_b = User.objects.create_user(
            email="fo091-manager-b@example.com",
            password="pass",
            tenant=cls.tenant_b,
        )
        cls.unauthorized = User.objects.create_user(
            email="fo091-unauthorized@example.com",
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

        now = timezone.now()

        cls.current_ticket = FmTicket.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            asset=cls.asset_a,
            requester=cls.manager,
            title="HVAC cooling leakage near rooftop",
            description="Condensate leakage observed around HVAC unit.",
            ticket_number="FO091-CUR-001",
            category=FmTicket.Category.HVAC,
            priority=FmTicket.Priority.HIGH,
            status=FmTicket.Status.OPEN,
        )
        cls.similar_ticket = FmTicket.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            asset=cls.asset_a,
            requester=cls.manager,
            title="HVAC leakage from cooling unit",
            description="Similar condensate leakage repaired on rooftop HVAC.",
            ticket_number="FO091-SIM-001",
            category=FmTicket.Category.HVAC,
            priority=FmTicket.Priority.HIGH,
            status=FmTicket.Status.CLOSED,
        )
        cls.weak_ticket = FmTicket.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            requester=cls.manager,
            title="Lobby lighting replacement",
            description="Replace burned fluorescent lamps in lobby.",
            ticket_number="FO091-WEAK-001",
            category=FmTicket.Category.ELECTRICAL,
            priority=FmTicket.Priority.LOW,
            status=FmTicket.Status.RESOLVED,
        )
        cls.other_tenant_ticket = FmTicket.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            building=cls.building_b,
            requester=cls.manager_b,
            title="HVAC cooling leakage near rooftop",
            description="Condensate leakage observed around HVAC unit.",
            ticket_number="FO091-B-001",
            category=FmTicket.Category.HVAC,
            priority=FmTicket.Priority.HIGH,
            status=FmTicket.Status.CLOSED,
        )
        cls.deleted_ticket = FmTicket.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            asset=cls.asset_a,
            requester=cls.manager,
            title="HVAC cooling leakage deleted",
            description="Should be ignored because soft deleted.",
            ticket_number="FO091-DEL-001",
            category=FmTicket.Category.HVAC,
            priority=FmTicket.Priority.HIGH,
            status=FmTicket.Status.CLOSED,
            is_deleted=True,
            deleted_at=now,
        )

        cls.current_analysis = AITicketAnalysis.objects.create(
            tenant=cls.tenant_a,
            ticket=cls.current_ticket,
            status=AITicketAnalysis.Status.COMPLETED,
            queued_at=now - timedelta(minutes=10),
            started_at=now - timedelta(minutes=9),
            completed_at=now - timedelta(minutes=8),
            provider="gemini",
            model_name="gemini-2.0-flash",
            schema_version="1.0",
            result_json=_recommendation_json(),
            requested_by=cls.manager,
        )
        cls.similar_analysis = AITicketAnalysis.objects.create(
            tenant=cls.tenant_a,
            ticket=cls.similar_ticket,
            status=AITicketAnalysis.Status.COMPLETED,
            queued_at=now - timedelta(days=5, minutes=10),
            started_at=now - timedelta(days=5, minutes=9),
            completed_at=now - timedelta(days=5, minutes=8),
            provider="gemini",
            model_name="gemini-2.0-flash",
            schema_version="1.0",
            result_json=_recommendation_json(),
            decision=AITicketAnalysis.Decision.ACCEPTED,
            decision_recommended_category="HVAC",
            decision_recommended_priority="High",
            final_category="hvac",
            final_priority="high",
            decision_at=now - timedelta(days=5),
            decision_by=cls.manager,
            requested_by=cls.manager,
        )

        cls.work_order = MaintenanceWorkOrder.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            asset=cls.asset_a,
            requester=cls.manager,
            title="HVAC cooling leakage repair",
            description="Completed repair for condensate leakage on HVAC.",
            priority=MaintenanceWorkOrder.Priority.HIGH,
            status=MaintenanceWorkOrder.Status.COMPLETED,
        )
        cls.inspection = Inspection.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            title="HVAC area shine inspection",
            inspection_type=Inspection.InspectionType.ROUTINE,
            five_s_category=Inspection.FiveSCategory.SHINE,
            priority=Inspection.Priority.HIGH,
            status=Inspection.Status.COMPLETED,
            remarks="Observed cooling leakage residue near HVAC.",
            inspector=cls.manager,
        )

        for ticket in (
            cls.similar_ticket,
            cls.weak_ticket,
            cls.other_tenant_ticket,
            cls.deleted_ticket,
        ):
            FmTicket.objects.filter(pk=ticket.pk).update(
                updated_at=now - timedelta(days=3)
            )
        MaintenanceWorkOrder.objects.filter(pk=cls.work_order.pk).update(
            updated_at=now - timedelta(days=2)
        )
        Inspection.objects.filter(pk=cls.inspection.pk).update(
            updated_at=now - timedelta(days=2)
        )

    def _params(self, **overrides):
        params = {
            "ticket_id": str(self.current_ticket.id),
            "start_date": (timezone.localdate() - timedelta(days=30)).isoformat(),
            "end_date": timezone.localdate().isoformat(),
            "min_similarity": "40",
        }
        params.update(overrides)
        return params

    def test_keyword_extraction_and_weights(self):
        tokens = extract_keywords("HVAC cooling leakage near rooftop")
        self.assertIn("hvac", tokens)
        self.assertIn("cooling", tokens)
        weights = get_similarity_weights()
        self.assertEqual(weights["category"], 25)
        self.assertEqual(sum(weights.values()), 100)

    def test_similarity_score_and_reasons(self):
        current = {
            "category": "hvac",
            "priority": "high",
            "building_id": self.building_a.id,
            "building_code": self.building_a.code,
            "asset_id": self.asset_a.id,
            "asset_code": self.asset_a.code,
            "keywords": extract_keywords("HVAC cooling leakage"),
            "finding_keywords": extract_keywords("Cooling leakage"),
            "recommended_category": "hvac",
            "recommended_priority": "high",
        }
        candidate = {
            **current,
            "decision": "accepted",
        }
        score, reasons, components = compute_similarity(current, candidate)
        self.assertGreaterEqual(score, 80)
        self.assertTrue(any("Category matched" in reason for reason in reasons))
        self.assertTrue(any("Same asset" in reason for reason in reasons))
        self.assertEqual(components["category"], 25)

    def test_ranking_and_historical_outcome(self):
        payload = build_ai_similar_cases(self.manager, self._params())
        self.assertEqual(payload["current_case"]["reference"], "FO091-CUR-001")
        self.assertGreaterEqual(payload["summary"]["match_count"], 1)
        scores = [item["similarity_score"] for item in payload["similar_cases"]]
        self.assertEqual(scores, sorted(scores, reverse=True))
        top = payload["similar_cases"][0]
        self.assertIn(top["reference"], {"FO091-SIM-001", self.work_order.work_order_number})
        self.assertTrue(top["reasons"])
        self.assertIn("historical_outcome", top)
        self.assertIn("decision_outcome", top["historical_outcome"])

    def test_minimum_score_filter(self):
        payload = build_ai_similar_cases(
            self.manager, self._params(min_similarity="95")
        )
        for item in payload["similar_cases"]:
            self.assertGreaterEqual(item["similarity_score"], 95)

    def test_source_filter_tickets_only(self):
        payload = build_ai_similar_cases(
            self.manager, self._params(source="fm_ticket", min_similarity="30")
        )
        for item in payload["similar_cases"]:
            self.assertEqual(item["source_type"], "fm_ticket")

    def test_no_matches_safe(self):
        payload = build_ai_similar_cases(
            self.manager, self._params(min_similarity="100", category="cleaning")
        )
        self.assertEqual(payload["summary"]["match_count"], 0)
        self.assertEqual(payload["similar_cases"], [])

    def test_tenant_isolation(self):
        payload = build_ai_similar_cases(self.manager, self._params(min_similarity="10"))
        references = {item["reference"] for item in payload["similar_cases"]}
        self.assertNotIn("FO091-B-001", references)
        self.assertNotIn("FO091-DEL-001", references)
        serialized = str(payload).lower()
        self.assertNotIn("fo091-manager@example.com", serialized)
        self.assertNotIn("reasoning", serialized)
        self.assertNotIn("gemini-2.0-flash", serialized)

    def test_api_authorized(self):
        client = APIClient()
        client.force_authenticate(user=self.manager)
        response = client.get(
            reverse("reporting-ai-similar-cases"), self._params()
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("similar_cases", response.data)
        self.assertIn("algorithm", response.data)
        self.assertEqual(response.data["algorithm"]["version"], "rule_v1")

    def test_api_unauthorized(self):
        client = APIClient()
        client.force_authenticate(user=self.unauthorized)
        response = client.get(
            reverse("reporting-ai-similar-cases"), self._params()
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_api_employee_denied(self):
        client = APIClient()
        client.force_authenticate(user=self.employee)
        response = client.get(
            reverse("reporting-ai-similar-cases"), self._params()
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_analysis_id_resolution(self):
        params = self._params(analysis_id=str(self.current_analysis.id))
        params.pop("ticket_id", None)
        payload = build_ai_similar_cases(self.manager, params)
        self.assertEqual(payload["current_case"]["case_id"], str(self.current_ticket.id))

    def test_requires_ticket_or_analysis(self):
        client = APIClient()
        client.force_authenticate(user=self.manager)
        response = client.get(
            reverse("reporting-ai-similar-cases"),
            {
                "start_date": (timezone.localdate() - timedelta(days=30)).isoformat(),
                "end_date": timezone.localdate().isoformat(),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
