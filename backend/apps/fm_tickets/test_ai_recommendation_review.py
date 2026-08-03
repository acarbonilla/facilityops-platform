"""FO-087 AI recommendation review (accept / modify / ignore) tests."""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from apps.access_control.models import Role, UserRole
from apps.attachments.models import Attachment
from apps.attachments.ownership import AttachmentOwnerType, AttachmentVisibility
from apps.attachments.services import create_attachment
from apps.fm_tickets.ai_processing_service import process_ticket_ai_analysis
from apps.fm_tickets.ai_recommendation_review import (
    map_ai_category_to_ticket,
    map_ai_priority_to_ticket,
    record_recommendation_decision,
)
from apps.fm_tickets.models import AITicketAnalysis, FmTicket, FmTicketHistory
from apps.fm_tickets.serializers import AITicketAnalysisSerializer
from apps.master_data.models import Building, Organization, Tenant

User = get_user_model()

JPEG_BYTES = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xd9"
)


def _recommendation_payload(attachment_id: str) -> dict:
    return {
        "schema_version": "1.0",
        "schema_name": "FacilityRecommendationV1",
        "analysis_summary": "Visible staining near a fixture.",
        "image_results": [
            {
                "attachment_id": attachment_id,
                "image_index": 1,
                "image_quality": {"usable": True, "issues": []},
                "observations": [
                    {
                        "observation": "Dark discoloration near pipe joint",
                        "evidence": "Brown staining on surrounding surface",
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
                "description": "Observable facility condition from image evidence.",
                "confidence": 70,
            }
        ],
        "recommended_category": "Plumbing",
        "recommended_priority": "Medium",
        "severity": "Moderate",
        "overall_confidence": 65,
        "reasoning": "Visible water stains indicate a plumbing issue.",
        "requires_human_review": True,
        "limitations": ["A photograph cannot confirm the internal root cause"],
    }


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
    FACILITYOPS_AI_PROVIDER="placeholder",
    FACILITYOPS_GEMINI_ENABLED=False,
)
class AIRecommendationReviewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant = Tenant.objects.create(name="FO087 Tenant", code="fo087")
        cls.org = Organization.objects.create(
            tenant=cls.tenant, name="FO087 Org", code="fo087-org"
        )
        cls.building = Building.objects.create(
            tenant=cls.tenant,
            organization=cls.org,
            name="Building",
            code="fo087-bldg",
        )
        cls.user = User.objects.create_user(
            email="fo087@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.org,
        )
        UserRole.objects.create(
            user=cls.user,
            role=Role.objects.get(code="facility_manager"),
        )
        cls.other_tenant = Tenant.objects.create(name="Other", code="fo087-other")
        cls.other_org = Organization.objects.create(
            tenant=cls.other_tenant, name="Other Org", code="fo087-other-org"
        )
        cls.other_user = User.objects.create_user(
            email="fo087-other@example.com",
            password="Password123!",
            tenant=cls.other_tenant,
            organization=cls.other_org,
        )
        UserRole.objects.create(
            user=cls.other_user,
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
            ticket_number="FO087-001",
            category=FmTicket.Category.OTHER,
            priority=FmTicket.Priority.MEDIUM,
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
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def _completed_analysis(self):
        with patch(
            "apps.fm_tickets.tasks.process_fm_ticket_ai_analysis.delay"
        ) as delay_mock:
            delay_mock.return_value.id = "fo087-task"
            from apps.fm_tickets.ai_queue_service import queue_ticket_image_analysis

            analysis = queue_ticket_image_analysis(
                actor=self.user,
                ticket_id=self.ticket.id,
                attachment_ids=[self.attachment.id],
            )
        analysis.status = AITicketAnalysis.Status.COMPLETED
        analysis.result_json = _recommendation_payload(str(self.attachment.id))
        analysis.save(update_fields=["status", "result_json", "updated_at"])
        return analysis

    def test_mapping_helpers(self):
        self.assertEqual(map_ai_category_to_ticket("Plumbing"), "plumbing")
        self.assertEqual(map_ai_category_to_ticket("Housekeeping"), "cleaning")
        self.assertEqual(map_ai_priority_to_ticket("Critical"), "urgent")
        self.assertEqual(map_ai_priority_to_ticket("Medium"), "medium")

    def test_accept_recommendation_records_history_without_ticket_mutation(self):
        analysis = self._completed_analysis()
        result = record_recommendation_decision(
            actor=self.user,
            ticket_id=self.ticket.id,
            analysis_id=analysis.id,
            decision=AITicketAnalysis.Decision.ACCEPTED,
        )
        self.ticket.refresh_from_db()
        self.assertEqual(result.decision, "accepted")
        self.assertEqual(result.final_category, "plumbing")
        self.assertEqual(result.final_priority, "medium")
        self.assertEqual(result.decision_recommended_category, "Plumbing")
        self.assertEqual(self.ticket.category, FmTicket.Category.OTHER)
        self.assertEqual(self.ticket.priority, FmTicket.Priority.MEDIUM)
        self.assertTrue(
            FmTicketHistory.objects.filter(
                ticket=self.ticket, action="ai_recommendation_accepted"
            ).exists()
        )

    def test_modify_recommendation(self):
        analysis = self._completed_analysis()
        result = record_recommendation_decision(
            actor=self.user,
            ticket_id=self.ticket.id,
            analysis_id=analysis.id,
            decision=AITicketAnalysis.Decision.MODIFIED,
            final_category=FmTicket.Category.CIVIL,
            final_priority=FmTicket.Priority.HIGH,
        )
        self.assertEqual(result.decision, "modified")
        self.assertEqual(result.final_category, "civil")
        self.assertEqual(result.final_priority, "high")
        self.assertEqual(result.decision_recommended_category, "Plumbing")

    def test_ignore_recommendation(self):
        analysis = self._completed_analysis()
        result = record_recommendation_decision(
            actor=self.user,
            ticket_id=self.ticket.id,
            analysis_id=analysis.id,
            decision=AITicketAnalysis.Decision.IGNORED,
        )
        self.assertEqual(result.decision, "ignored")
        self.assertEqual(result.final_category, "")
        self.assertEqual(result.final_priority, "")
        # Original AI payload preserved.
        self.assertEqual(result.result_json["recommended_category"], "Plumbing")

    def test_serializer_exposes_decision_fields(self):
        analysis = self._completed_analysis()
        record_recommendation_decision(
            actor=self.user,
            ticket_id=self.ticket.id,
            analysis_id=analysis.id,
            decision=AITicketAnalysis.Decision.ACCEPTED,
        )
        analysis.refresh_from_db()
        data = AITicketAnalysisSerializer(analysis).data
        self.assertTrue(data["accepted"])
        self.assertFalse(data["modified"])
        self.assertFalse(data["ignored"])
        self.assertEqual(data["decision"], "accepted")
        self.assertEqual(data["final_category"], "plumbing")
        self.assertEqual(data["final_priority"], "medium")
        self.assertIsNotNone(data["decision_timestamp"])
        self.assertEqual(data["decision_user"]["email"], self.user.email)
        self.assertNotIn("api_key", str(data).lower())

    def test_api_accept_endpoint(self):
        analysis = self._completed_analysis()
        response = self.client.post(
            f"/api/fm-tickets/tickets/{self.ticket.id}/ai-analyses/"
            f"{analysis.id}/decision/",
            {"decision": "accepted"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["accepted"])
        self.assertEqual(response.data["final_category"], "plumbing")

    def test_cross_tenant_decision_returns_404(self):
        analysis = self._completed_analysis()
        other_client = APIClient()
        other_client.force_authenticate(self.other_user)
        response = other_client.post(
            f"/api/fm-tickets/tickets/{self.ticket.id}/ai-analyses/"
            f"{analysis.id}/decision/",
            {"decision": "ignored"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_placeholder_process_then_accept_does_not_mutate_ticket(self):
        with patch(
            "apps.fm_tickets.tasks.process_fm_ticket_ai_analysis.delay"
        ) as delay_mock:
            delay_mock.return_value.id = "fo087-task2"
            from apps.fm_tickets.ai_queue_service import queue_ticket_image_analysis

            analysis = queue_ticket_image_analysis(
                actor=self.user,
                ticket_id=self.ticket.id,
                attachment_ids=[self.attachment.id],
            )
        process_ticket_ai_analysis(str(analysis.id), attempt=1)
        analysis.refresh_from_db()
        self.assertEqual(analysis.status, AITicketAnalysis.Status.COMPLETED)
        record_recommendation_decision(
            actor=self.user,
            ticket_id=self.ticket.id,
            analysis_id=analysis.id,
            decision=AITicketAnalysis.Decision.ACCEPTED,
        )
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.category, FmTicket.Category.OTHER)
        self.assertEqual(self.ticket.priority, FmTicket.Priority.MEDIUM)
