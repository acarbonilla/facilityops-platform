"""FO-085 Gemini Vision provider and structured analysis tests (mocked; no live calls)."""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from pydantic import ValidationError as PydanticValidationError

from apps.access_control.models import Role, UserRole
from apps.attachments.models import Attachment
from apps.attachments.ownership import AttachmentOwnerType, AttachmentVisibility
from apps.attachments.services import create_attachment
from apps.fm_tickets.ai.errors import AIAnalysisError, AIErrorCode
from apps.fm_tickets.ai.gemini_provider import GeminiVisionProvider, _normalize_gemini_exception
from apps.fm_tickets.ai.image_input import prepare_analysis_images
from apps.fm_tickets.ai.schema_v1 import validate_facility_image_analysis
from apps.fm_tickets.ai_processing_service import (
    RetryableAIProcessing,
    process_ticket_ai_analysis,
)
from apps.fm_tickets.ai_provider import PlaceholderAIProvider, get_ai_provider
from apps.fm_tickets.models import AITicketAnalysis, FmTicket
from apps.master_data.models import Building, Organization, Tenant

User = get_user_model()

JPEG_BYTES = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xd9"
)


def _valid_payload(attachment_id: str) -> dict:
    return {
        "schema_version": "1.0",
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
                "cannot_determine": ["internal source of leak"],
            }
        ],
        "cross_image_findings": [],
        "overall_image_quality": "adequate",
        "requires_human_review": False,
        "limitations": ["A photograph cannot confirm the internal root cause"],
    }


def _valid_recommendation_payload(attachment_id: str) -> dict:
    payload = _valid_payload(attachment_id)
    payload.update(
        {
            "schema_name": "FacilityRecommendationV1",
            "findings": [
                {
                    "title": "Water leak",
                    "description": "Visible staining and moisture near the fixture.",
                    "confidence": 82,
                }
            ],
            "recommended_category": "Plumbing",
            "recommended_priority": "Medium",
            "severity": "Moderate",
            "overall_confidence": 78,
            "reasoning": (
                "Visible water stains indicate a plumbing issue. "
                "Damage appears localized. Medium priority is recommended."
            ),
        }
    )
    return payload


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
    FACILITYOPS_AI_PROVIDER="placeholder",
    FACILITYOPS_GEMINI_ENABLED=False,
)
class GeminiVisionFoundationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant = Tenant.objects.create(name="FO085 Tenant", code="fo085")
        cls.org = Organization.objects.create(
            tenant=cls.tenant, name="FO085 Org", code="fo085-org"
        )
        cls.building = Building.objects.create(
            tenant=cls.tenant,
            organization=cls.org,
            name="Building",
            code="fo085-bldg",
        )
        cls.user = User.objects.create_user(
            email="fo085@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.org,
        )
        UserRole.objects.create(
            user=cls.user,
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
            title="Ceiling stain",
            description="Brown mark near AC",
            category=FmTicket.Category.HVAC,
            ticket_number="FO085-001",
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

    def test_get_ai_provider_defaults_to_placeholder(self):
        provider = get_ai_provider()
        self.assertIsInstance(provider, PlaceholderAIProvider)

    @override_settings(
        FACILITYOPS_AI_PROVIDER="gemini",
        FACILITYOPS_GEMINI_ENABLED=True,
        GEMINI_API_KEY="test-key",
        FACILITYOPS_GEMINI_MODEL="gemini-2.0-flash",
    )
    def test_get_ai_provider_selects_gemini_when_configured(self):
        provider = get_ai_provider()
        self.assertIsInstance(provider, GeminiVisionProvider)

    @override_settings(
        FACILITYOPS_AI_PROVIDER="gemini",
        FACILITYOPS_GEMINI_ENABLED=False,
        GEMINI_API_KEY="test-key",
    )
    def test_gemini_selected_but_disabled_fails(self):
        with self.assertRaises(AIAnalysisError) as ctx:
            get_ai_provider()
        self.assertEqual(ctx.exception.code, AIErrorCode.PROVIDER_NOT_CONFIGURED)

    def test_schema_accepts_valid_payload_and_forces_human_review(self):
        validated = validate_facility_image_analysis(
            _valid_payload(str(self.attachment.id))
        )
        self.assertTrue(validated.requires_human_review)

    def test_schema_rejects_bad_confidence_and_unknown_enum(self):
        payload = _valid_payload(str(self.attachment.id))
        payload["image_results"][0]["observations"][0]["confidence"] = 1.5
        with self.assertRaises(PydanticValidationError):
            validate_facility_image_analysis(payload)

        payload = _valid_payload(str(self.attachment.id))
        payload["overall_image_quality"] = "excellent"
        with self.assertRaises(PydanticValidationError):
            validate_facility_image_analysis(payload)

    def test_prepare_images_rejects_cross_tenant_owner(self):
        other_tenant = Tenant.objects.create(name="Other", code="fo085-other")
        self.attachment.tenant = other_tenant
        self.attachment.save(update_fields=["tenant"])
        with self.assertRaises(AIAnalysisError) as ctx:
            prepare_analysis_images(
                ticket=self.ticket,
                attachments=[self.attachment],
            )
        self.assertEqual(ctx.exception.code, AIErrorCode.NO_VALID_IMAGES)

    def test_prepare_images_excludes_deleted(self):
        self.attachment.is_deleted = True
        self.attachment.save(update_fields=["is_deleted"])
        with self.assertRaises(AIAnalysisError) as ctx:
            prepare_analysis_images(
                ticket=self.ticket,
                attachments=[self.attachment],
            )
        self.assertEqual(ctx.exception.code, AIErrorCode.NO_VALID_IMAGES)

    @override_settings(
        FACILITYOPS_AI_PROVIDER="gemini",
        FACILITYOPS_GEMINI_ENABLED=True,
        GEMINI_API_KEY="test-key",
        FACILITYOPS_GEMINI_MODEL="gemini-2.0-flash",
    )
    def test_gemini_provider_uses_authorized_images_only(self):
        payload = _valid_recommendation_payload(str(self.attachment.id))
        mock_response = MagicMock()
        mock_response.parsed = payload
        mock_response.text = ""
        mock_response.candidates = []

        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response

        provider = GeminiVisionProvider(client=mock_client)
        result = provider.analyze(
            ticket=self.ticket,
            attachments=[self.attachment],
            correlation_id="corr-1",
        )
        self.assertEqual(result.provider, "gemini")
        self.assertEqual(result.result_json["schema_version"], "1.0")
        self.assertEqual(result.result_json["schema_name"], "FacilityRecommendationV1")
        self.assertTrue(result.result_json["requires_human_review"])
        self.assertEqual(result.result_json["recommended_category"], "Plumbing")
        self.assertEqual(result.prompt_version, "v1")
        call_kwargs = mock_client.models.generate_content.call_args.kwargs
        # Prompt + one image part
        self.assertEqual(len(call_kwargs["contents"]), 2)

    def test_normalize_timeout_and_rate_limit(self):
        self.assertEqual(
            _normalize_gemini_exception(TimeoutError("deadline exceeded")).code,
            AIErrorCode.PROVIDER_TIMEOUT,
        )
        rate = _normalize_gemini_exception(Exception("rate limit exceeded"))
        self.assertEqual(rate.code, AIErrorCode.PROVIDER_RATE_LIMITED)
        self.assertTrue(rate.retryable)

    def test_processing_retryable_raises_for_celery(self):
        with patch(
            "apps.fm_tickets.tasks.process_fm_ticket_ai_analysis.delay"
        ) as delay_mock:
            delay_mock.return_value.id = "t1"
            from apps.fm_tickets.ai_queue_service import queue_ticket_image_analysis

            analysis = queue_ticket_image_analysis(
                actor=self.user,
                ticket_id=self.ticket.id,
                attachment_ids=[self.attachment.id],
            )

        with patch(
            "apps.fm_tickets.ai_processing_service.get_ai_provider",
            side_effect=AIAnalysisError(AIErrorCode.PROVIDER_TIMEOUT, retryable=True),
        ):
            with self.assertRaises(RetryableAIProcessing):
                process_ticket_ai_analysis(str(analysis.id), attempt=1)

        analysis.refresh_from_db()
        self.assertEqual(analysis.status, AITicketAnalysis.Status.PROCESSING)
        self.assertEqual(analysis.error_code, AIErrorCode.PROVIDER_TIMEOUT)

    def test_processing_permanent_failure_marks_failed(self):
        with patch(
            "apps.fm_tickets.tasks.process_fm_ticket_ai_analysis.delay"
        ) as delay_mock:
            delay_mock.return_value.id = "t2"
            from apps.fm_tickets.ai_queue_service import queue_ticket_image_analysis

            analysis = queue_ticket_image_analysis(
                actor=self.user,
                ticket_id=self.ticket.id,
                attachment_ids=[self.attachment.id],
            )

        with patch(
            "apps.fm_tickets.ai_processing_service.get_ai_provider",
            side_effect=AIAnalysisError(AIErrorCode.PROVIDER_AUTH_FAILED),
        ):
            result = process_ticket_ai_analysis(str(analysis.id), attempt=1)

        analysis.refresh_from_db()
        self.assertFalse(result["ok"])
        self.assertEqual(analysis.status, AITicketAnalysis.Status.FAILED)
        self.assertEqual(analysis.error_code, AIErrorCode.PROVIDER_AUTH_FAILED)
        self.assertNotIn("api key", analysis.error_message.lower())

    def test_completed_analysis_is_idempotent(self):
        with patch(
            "apps.fm_tickets.tasks.process_fm_ticket_ai_analysis.delay"
        ) as delay_mock:
            delay_mock.return_value.id = "t3"
            from apps.fm_tickets.ai_queue_service import queue_ticket_image_analysis

            analysis = queue_ticket_image_analysis(
                actor=self.user,
                ticket_id=self.ticket.id,
                attachment_ids=[self.attachment.id],
            )
        first = process_ticket_ai_analysis(str(analysis.id), attempt=1)
        second = process_ticket_ai_analysis(str(analysis.id), attempt=2)
        self.assertTrue(first["ok"])
        self.assertTrue(second.get("skipped"))
