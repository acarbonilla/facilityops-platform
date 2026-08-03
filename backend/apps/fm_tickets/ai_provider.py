"""Pluggable AI provider adapters for FM ticket image analysis.

FO-084 introduced the placeholder + get_ai_provider() hook.
FO-085 adds configuration-driven Gemini Vision behind the same boundary.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from django.conf import settings

from .ai.errors import AIAnalysisError, AIErrorCode
from .ai.schema_recommendation_v1 import SCHEMA_NAME, SCHEMA_VERSION


@dataclass(frozen=True)
class AIProviderResult:
    model_name: str
    model_version: str
    result_json: dict
    provider: str = "placeholder"
    prompt_version: str = ""
    schema_version: str = ""
    input_image_count: int = 0
    input_byte_count: int = 0
    metadata: dict = field(default_factory=dict)


class AIImageAnalysisProvider:
    """Duck-typed provider contract used by the processing service."""

    def analyze(self, *, ticket, attachments, correlation_id: str = "") -> AIProviderResult:
        raise NotImplementedError


class PlaceholderAIProvider(AIImageAnalysisProvider):
    """Deterministic local/test provider; no external network calls."""

    PROVIDER_NAME = "placeholder"
    MODEL_NAME = "placeholder"
    MODEL_VERSION = "v0"

    def analyze(self, *, ticket, attachments, correlation_id: str = "") -> AIProviderResult:
        from .ai.image_input import prepare_analysis_images

        try:
            prepared = prepare_analysis_images(ticket=ticket, attachments=attachments)
        except AIAnalysisError:
            # Placeholder still completes with empty observation set when no images.
            prepared = []

        image_results = []
        for image in prepared:
            image_results.append(
                {
                    "attachment_id": image.attachment_id,
                    "image_index": image.image_index,
                    "image_quality": {"usable": True, "issues": []},
                    "observations": [
                        {
                            "observation": "Placeholder observation only; Gemini not enabled.",
                            "evidence": "No live vision provider was invoked.",
                            "region": "",
                            "confidence": 0.0,
                        }
                    ],
                    "visible_assets": [],
                    "visible_hazards": [],
                    "cannot_determine": ["Live visual analysis is disabled in placeholder mode"],
                }
            )

        if not image_results:
            image_results = [
                {
                    "attachment_id": "00000000-0000-0000-0000-000000000000",
                    "image_index": 1,
                    "image_quality": {
                        "usable": False,
                        "issues": ["too_distant"],
                    },
                    "observations": [],
                    "visible_assets": [],
                    "visible_hazards": [],
                    "cannot_determine": ["No valid images were available"],
                }
            ]

        result_json = {
            "schema_version": SCHEMA_VERSION,
            "schema_name": SCHEMA_NAME,
            "analysis_summary": (
                "Placeholder AI analysis completed. "
                "Real Gemini vision observations are deferred until the gemini provider is enabled."
            ),
            "image_results": image_results,
            "cross_image_findings": [],
            "overall_image_quality": "limited",
            "findings": [
                {
                    "title": "Unknown",
                    "description": (
                        "Placeholder provider did not inspect images. "
                        "No operational finding should be acted on."
                    ),
                    "confidence": 0,
                }
            ],
            "recommended_category": "Unknown",
            "recommended_priority": "Low",
            "severity": "Minor",
            "overall_confidence": 0,
            "reasoning": (
                "Placeholder mode is advisory scaffolding only. "
                "Enable Gemini to produce evidence-based recommendations."
            ),
            "requires_human_review": True,
            "limitations": [
                "Placeholder provider does not perform visual inspection.",
                "A photograph cannot confirm the internal root cause.",
            ],
            "meta": {
                "provider": self.PROVIDER_NAME,
                "model": self.MODEL_NAME,
                "prompt_name": "placeholder",
                "prompt_version": self.MODEL_VERSION,
                "schema_name": SCHEMA_NAME,
                "schema_version": SCHEMA_VERSION,
                "ai_generated": True,
                "requires_human_review": True,
                "advisory_only": True,
                "correlation_id": correlation_id or "",
            },
        }
        return AIProviderResult(
            model_name=self.MODEL_NAME,
            model_version=self.MODEL_VERSION,
            result_json=result_json,
            provider=self.PROVIDER_NAME,
            prompt_version=self.MODEL_VERSION,
            schema_version=SCHEMA_VERSION,
            input_image_count=len(prepared),
            input_byte_count=sum(image.size_bytes for image in prepared),
        )


def get_ai_provider() -> AIImageAnalysisProvider:
    """Resolve provider from settings. Controllers must not call Gemini directly."""
    selected = (getattr(settings, "FACILITYOPS_AI_PROVIDER", "placeholder") or "placeholder").lower()
    if selected in {"gemini", "gemini_vision"}:
        if not getattr(settings, "FACILITYOPS_GEMINI_ENABLED", False):
            raise AIAnalysisError(AIErrorCode.PROVIDER_NOT_CONFIGURED)
        from .ai.gemini_provider import GeminiVisionProvider

        return GeminiVisionProvider()
    return PlaceholderAIProvider()
