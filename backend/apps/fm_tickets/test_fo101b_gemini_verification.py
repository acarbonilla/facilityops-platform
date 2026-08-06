"""FO-101B Gemini runtime verification and provider metadata tests."""

from unittest.mock import patch

from django.test import TestCase, override_settings

from apps.fm_tickets.ai.errors import AIAnalysisError, AIErrorCode
from apps.fm_tickets.ai_provider import (
    PlaceholderAIProvider,
    get_ai_provider,
)


FLAG_PATH = "apps.fm_tickets.ai_administration_service.is_feature_enabled"


@override_settings(
    FACILITYOPS_AI_PROVIDER="placeholder",
    FACILITYOPS_GEMINI_ENABLED=False,
    GEMINI_API_KEY="",
)
class Fo101bProviderSelectionTests(TestCase):
    @patch(FLAG_PATH, return_value=True)
    def test_placeholder_when_provider_not_gemini(self, _flag):
        provider = get_ai_provider()
        self.assertIsInstance(provider, PlaceholderAIProvider)

    @override_settings(
        FACILITYOPS_AI_PROVIDER="gemini",
        FACILITYOPS_GEMINI_ENABLED=False,
        GEMINI_API_KEY="dummy",
        FACILITYOPS_GEMINI_MODEL="gemini-2.5-flash",
    )
    @patch(FLAG_PATH, return_value=True)
    def test_gemini_disabled_raises(self, _flag):
        with self.assertRaises(AIAnalysisError) as ctx:
            get_ai_provider()
        self.assertEqual(ctx.exception.code, AIErrorCode.PROVIDER_NOT_CONFIGURED)

    @override_settings(
        FACILITYOPS_AI_PROVIDER="gemini",
        FACILITYOPS_GEMINI_ENABLED=True,
        GEMINI_API_KEY="dummy-key",
        FACILITYOPS_GEMINI_MODEL="gemini-2.5-flash",
    )
    @patch(FLAG_PATH, return_value=True)
    def test_gemini_selected_when_enabled(self, _flag):
        provider = get_ai_provider()
        self.assertEqual(getattr(provider, "PROVIDER_NAME", ""), "gemini")

    @patch(FLAG_PATH, return_value=False)
    def test_image_analysis_flag_blocks_provider(self, _flag):
        with self.assertRaises(AIAnalysisError) as ctx:
            get_ai_provider()
        self.assertEqual(ctx.exception.code, AIErrorCode.PROVIDER_NOT_CONFIGURED)


@override_settings(
    FACILITYOPS_AI_PROVIDER="gemini",
    FACILITYOPS_GEMINI_ENABLED=True,
    GEMINI_API_KEY="dummy-key",
    FACILITYOPS_GEMINI_MODEL="gemini-2.5-flash",
    FACILITYOPS_AI_MAX_ATTEMPTS=1,
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class Fo101bProviderMetadataOnFailureTests(TestCase):
    def test_failed_analysis_stamps_selected_gemini_provider(self):
        from django.contrib.auth import get_user_model
        from django.core.management import call_command
        from django.utils import timezone

        from apps.access_control.models import Role, UserRole
        from apps.master_data.models import Organization, Tenant
        from apps.fm_tickets.ai.errors import AIAnalysisError, AIErrorCode
        from apps.fm_tickets.ai_processing_service import process_ticket_ai_analysis
        from apps.fm_tickets.models import AITicketAnalysis, FmTicket

        call_command("seed_rbac")
        tenant = Tenant.objects.create(name="FO101B", code="fo101b")
        org = Organization.objects.create(tenant=tenant, name="Org", code="fo101b-o")
        User = get_user_model()
        user = User.objects.create_user(
            email="fo101b@example.com",
            password="x",
            tenant=tenant,
            organization=org,
        )
        UserRole.objects.create(user=user, role=Role.objects.get(code="facility_manager"))
        ticket = FmTicket.objects.create(
            tenant=tenant,
            organization=org,
            requester=user,
            title="FO101B meta",
            category=FmTicket.Category.UNCLASSIFIED,
            priority=FmTicket.Priority.PENDING_REVIEW,
        )
        analysis = AITicketAnalysis.objects.create(
            tenant=tenant,
            ticket=ticket,
            status=AITicketAnalysis.Status.QUEUED,
            queued_at=timezone.now(),
            provider="placeholder",
            model_name="placeholder",
            result_json={},
        )

        class FakeGemini:
            PROVIDER_NAME = "gemini"
            MODEL_NAME = "gemini-2.5-flash"

            def analyze(self, **kwargs):
                raise AIAnalysisError(AIErrorCode.PROVIDER_RATE_LIMITED)

        with patch(
            "apps.fm_tickets.ai_processing_service.get_ai_provider",
            return_value=FakeGemini(),
        ):
            result = process_ticket_ai_analysis(str(analysis.id), attempt=1)

        analysis.refresh_from_db()
        ticket.refresh_from_db()
        self.assertEqual(result.get("error_code"), "PROVIDER_RATE_LIMITED")
        self.assertEqual(analysis.status, AITicketAnalysis.Status.FAILED)
        self.assertEqual(analysis.provider, "gemini")
        self.assertEqual(analysis.model_name, "gemini-2.5-flash")
        self.assertEqual(ticket.category, FmTicket.Category.UNCLASSIFIED)
        self.assertEqual(ticket.priority, FmTicket.Priority.PENDING_REVIEW)
        self.assertEqual(ticket.status, FmTicket.Status.OPEN)
        self.assertIsNone(ticket.assignee_id)


class Fo101bGeminiServingSchemaTests(TestCase):
    def test_simplify_preserves_finding_title_property(self):
        from apps.fm_tickets.ai.schema_recommendation_v1 import (
            SCHEMA_NAME,
            SCHEMA_VERSION,
            facility_recommendation_json_schema,
        )

        schema = facility_recommendation_json_schema()
        finding = (schema.get("$defs") or {}).get("RecommendationFinding") or {}
        props = finding.get("properties") or {}
        self.assertIn("title", props)
        self.assertIn("description", props)
        self.assertIn("confidence", props)
        self.assertEqual(
            schema["properties"]["schema_name"],
            {"type": "string", "enum": [SCHEMA_NAME]},
        )
        self.assertEqual(
            schema["properties"]["schema_version"],
            {"type": "string", "enum": [SCHEMA_VERSION]},
        )

    def test_normalize_percent_observation_confidence(self):
        from apps.fm_tickets.ai.gemini_provider import (
            _normalize_gemini_recommendation_payload,
        )
        from apps.fm_tickets.ai.schema_recommendation_v1 import SCHEMA_NAME

        normalized = _normalize_gemini_recommendation_payload(
            {
                "schema_name": "facilities_image_analysis_v1.0",
                "schema_version": "v1",
                "image_results": [
                    {
                        "observations": [{"confidence": 95}],
                        "visible_assets": [{"confidence": 80}],
                        "visible_hazards": [{"confidence": 0.7}],
                    }
                ],
                "cross_image_findings": [{"confidence": 90}],
                "findings": [{"confidence": 95}],
            }
        )
        self.assertEqual(normalized["schema_name"], SCHEMA_NAME)
        self.assertEqual(normalized["schema_version"], "1.0")
        self.assertEqual(
            normalized["image_results"][0]["observations"][0]["confidence"],
            0.95,
        )
        self.assertEqual(
            normalized["image_results"][0]["visible_assets"][0]["confidence"],
            0.8,
        )
        self.assertEqual(
            normalized["image_results"][0]["visible_hazards"][0]["confidence"],
            0.7,
        )
        self.assertEqual(normalized["cross_image_findings"][0]["confidence"], 0.9)
        # FO-086 finding confidence stays 0–100.
        self.assertEqual(normalized["findings"][0]["confidence"], 95)
