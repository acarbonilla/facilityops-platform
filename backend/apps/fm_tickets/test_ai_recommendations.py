"""FO-086 advisory recommendation schema, API, and processing tests."""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from pydantic import ValidationError as PydanticValidationError
from rest_framework.test import APIClient

from apps.access_control.models import Role, UserRole
from apps.attachments.models import Attachment
from apps.attachments.ownership import AttachmentOwnerType, AttachmentVisibility
from apps.attachments.services import create_attachment
from apps.fm_tickets.ai.schema_recommendation_v1 import (
    validate_facility_recommendation,
)
from apps.fm_tickets.ai_processing_service import process_ticket_ai_analysis
from apps.fm_tickets.ai_provider import AIProviderResult, PlaceholderAIProvider
from apps.fm_tickets.models import AITicketAnalysis, FmTicket
from apps.fm_tickets.serializers import AITicketAnalysisSerializer
from apps.master_data.models import Building, Organization, Tenant

User = get_user_model()

JPEG_BYTES = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xd9"
)


def _recommendation_payload(attachment_id: str, *, finding_title="Water leak") -> dict:
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
                "title": finding_title,
                "description": "Observable facility condition from image evidence.",
                "confidence": 70 if finding_title != "Unknown" else 20,
            }
        ],
        "recommended_category": "Plumbing" if finding_title != "Unknown" else "Unknown",
        "recommended_priority": "Medium" if finding_title != "Unknown" else "Low",
        "severity": "Moderate" if finding_title != "Unknown" else "Minor",
        "overall_confidence": 65 if finding_title != "Unknown" else 15,
        "reasoning": (
            "Visible water stains indicate a plumbing issue. "
            "Damage appears localized. Medium priority is recommended."
            if finding_title != "Unknown"
            else "Insufficient evidence for a specific finding."
        ),
        "requires_human_review": False,
        "limitations": ["A photograph cannot confirm the internal root cause"],
    }


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
    FACILITYOPS_AI_PROVIDER="placeholder",
    FACILITYOPS_GEMINI_ENABLED=False,
)
class AIRecommendationsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant = Tenant.objects.create(name="FO086 Tenant", code="fo086")
        cls.org = Organization.objects.create(
            tenant=cls.tenant, name="FO086 Org", code="fo086-org"
        )
        cls.building = Building.objects.create(
            tenant=cls.tenant,
            organization=cls.org,
            name="Building",
            code="fo086-bldg",
        )
        cls.user = User.objects.create_user(
            email="fo086@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.org,
        )
        UserRole.objects.create(
            user=cls.user,
            role=Role.objects.get(code="facility_manager"),
        )
        cls.other_tenant = Tenant.objects.create(name="Other", code="fo086-other")
        cls.other_org = Organization.objects.create(
            tenant=cls.other_tenant, name="Other Org", code="fo086-other-org"
        )
        cls.other_user = User.objects.create_user(
            email="fo086-other@example.com",
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
            ticket_number="FO086-001",
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

    def _queue(self):
        with patch(
            "apps.fm_tickets.tasks.process_fm_ticket_ai_analysis.delay"
        ) as delay_mock:
            delay_mock.return_value.id = "fo086-task"
            from apps.fm_tickets.ai_queue_service import queue_ticket_image_analysis

            return queue_ticket_image_analysis(
                actor=self.user,
                ticket_id=self.ticket.id,
                attachment_ids=[self.attachment.id],
            )

    def test_schema_single_and_multiple_findings(self):
        single = validate_facility_recommendation(
            _recommendation_payload(str(self.attachment.id))
        )
        self.assertEqual(len(single.findings), 1)
        self.assertTrue(single.requires_human_review)

        payload = _recommendation_payload(str(self.attachment.id))
        payload["findings"] = [
            {
                "title": "Water leak",
                "description": "Active drip",
                "confidence": 80,
            },
            {
                "title": "Ceiling damage",
                "description": "Stained tile",
                "confidence": 60,
            },
        ]
        multi = validate_facility_recommendation(payload)
        self.assertEqual(len(multi.findings), 2)

    def test_schema_unknown_and_low_confidence(self):
        payload = _recommendation_payload(
            str(self.attachment.id),
            finding_title="Unknown",
        )
        validated = validate_facility_recommendation(payload)
        self.assertEqual(validated.findings[0].title.value, "Unknown")
        self.assertLessEqual(validated.overall_confidence, 20)

    def test_schema_rejects_malformed_recommendation(self):
        payload = _recommendation_payload(str(self.attachment.id))
        payload["recommended_priority"] = "Urgent"
        with self.assertRaises(PydanticValidationError):
            validate_facility_recommendation(payload)

        payload = _recommendation_payload(str(self.attachment.id))
        del payload["findings"]
        with self.assertRaises(PydanticValidationError):
            validate_facility_recommendation(payload)

    def test_placeholder_persists_advisory_recommendations(self):
        analysis = self._queue()
        result = process_ticket_ai_analysis(str(analysis.id), attempt=1)
        analysis.refresh_from_db()
        self.ticket.refresh_from_db()
        self.assertTrue(result["ok"])
        self.assertEqual(analysis.result_json["schema_name"], "FacilityRecommendationV1")
        self.assertIn("findings", analysis.result_json)
        self.assertTrue(analysis.result_json["requires_human_review"])
        self.assertEqual(self.ticket.category, FmTicket.Category.OTHER)
        self.assertEqual(self.ticket.priority, FmTicket.Priority.MEDIUM)

    def test_processing_persists_gemini_recommendations(self):
        analysis = self._queue()
        payload = _recommendation_payload(str(self.attachment.id))
        provider = MagicMock()
        provider.analyze.return_value = AIProviderResult(
            model_name="gemini-2.0-flash",
            model_version="v1",
            result_json=payload,
            provider="gemini",
            prompt_version="v1",
            schema_version="1.0",
        )
        with patch(
            "apps.fm_tickets.ai_processing_service.get_ai_provider",
            return_value=provider,
        ):
            result = process_ticket_ai_analysis(str(analysis.id), attempt=1)
        analysis.refresh_from_db()
        self.assertTrue(result["ok"])
        self.assertEqual(analysis.result_json["recommended_category"], "Plumbing")
        self.assertEqual(analysis.result_json["recommended_priority"], "Medium")
        self.assertEqual(analysis.result_json["severity"], "Moderate")
        self.assertEqual(analysis.result_json["overall_confidence"], 65)
        self.assertTrue(analysis.result_json["requires_human_review"])

    def test_serializer_exposes_recommendation_fields(self):
        analysis = self._queue()
        analysis.status = AITicketAnalysis.Status.COMPLETED
        analysis.result_json = _recommendation_payload(str(self.attachment.id))
        analysis.result_json["requires_human_review"] = True
        analysis.save(update_fields=["status", "result_json", "updated_at"])
        data = AITicketAnalysisSerializer(analysis).data
        self.assertEqual(data["recommended_category"], "Plumbing")
        self.assertEqual(data["recommended_priority"], "Medium")
        self.assertEqual(data["severity"], "Moderate")
        self.assertEqual(data["confidence"], 65)
        self.assertTrue(data["requires_human_review"])
        self.assertEqual(len(data["findings"]), 1)
        self.assertNotIn("api_key", str(data).lower())
        self.assertNotIn("system_instruction", str(data).lower())

    def test_cross_tenant_queue_returns_404(self):
        other_client = APIClient()
        other_client.force_authenticate(self.other_user)
        response = other_client.post(
            f"/api/fm-tickets/tickets/{self.ticket.id}/ai-analyses/",
            {"attachment_ids": [str(self.attachment.id)]},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_placeholder_provider_returns_recommendation_shape(self):
        result = PlaceholderAIProvider().analyze(
            ticket=self.ticket,
            attachments=[self.attachment],
        )
        validated = validate_facility_recommendation(
            {
                key: value
                for key, value in result.result_json.items()
                if key != "meta"
            }
        )
        self.assertEqual(validated.recommended_category.value, "Unknown")
        self.assertTrue(validated.requires_human_review)
