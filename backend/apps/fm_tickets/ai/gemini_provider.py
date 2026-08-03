"""Gemini Vision provider adapter (FO-085 + FO-086 recommendations).

Uses the official google-genai SDK with generate_content + JSON schema.
Image strategy: inline bytes via Part.from_bytes (no Files API for v1).
FO-086 selects fm_ticket_recommendation_v1 + FacilityRecommendationV1 automatically.
"""

from __future__ import annotations

import logging
from typing import Any

from django.conf import settings

from .errors import AIAnalysisError, AIErrorCode
from .image_input import PreparedImage, build_minimal_ticket_context, prepare_analysis_images
from .prompts.fm_ticket_recommendation_v1 import (
    PROMPT_NAME,
    PROMPT_VERSION,
    SYSTEM_INSTRUCTION,
    build_user_prompt,
)
from .schema_recommendation_v1 import (
    SCHEMA_NAME,
    SCHEMA_VERSION,
    facility_recommendation_json_schema,
    validate_facility_recommendation,
)

logger = logging.getLogger(__name__)


class GeminiVisionProvider:
    PROVIDER_NAME = "gemini"

    def __init__(self, *, client=None):
        self._client = client

    def _require_config(self) -> tuple[str, str]:
        api_key = (getattr(settings, "GEMINI_API_KEY", None) or "").strip()
        model = (getattr(settings, "FACILITYOPS_GEMINI_MODEL", None) or "").strip()
        enabled = bool(getattr(settings, "FACILITYOPS_GEMINI_ENABLED", False))
        if not enabled or not api_key or not model:
            raise AIAnalysisError(AIErrorCode.PROVIDER_NOT_CONFIGURED)
        return api_key, model

    def _get_client(self, api_key: str):
        if self._client is not None:
            return self._client
        from google import genai

        return genai.Client(api_key=api_key)

    def analyze(
        self,
        *,
        ticket,
        attachments,
        correlation_id: str = "",
    ):
        from apps.fm_tickets.ai_provider import AIProviderResult

        api_key, model = self._require_config()
        prepared = prepare_analysis_images(ticket=ticket, attachments=attachments)
        ticket_context = build_minimal_ticket_context(
            ticket=ticket,
            prepared_images=prepared,
        )
        for forbidden in (
            "requester_email",
            "email",
            "phone",
            "storage_key",
            "token",
            "api_key",
        ):
            ticket_context.pop(forbidden, None)

        analysis = self._call_gemini(
            model=model,
            api_key=api_key,
            ticket_context=ticket_context,
            prepared=prepared,
            correlation_id=correlation_id,
        )
        validated = validate_facility_recommendation(analysis)
        by_id = {image.attachment_id: image for image in prepared}
        for image_result in validated.image_results:
            if image_result.attachment_id not in by_id:
                raise AIAnalysisError(AIErrorCode.SCHEMA_VALIDATION_FAILED)

        result_payload = validated.model_dump(mode="json")
        result_payload["meta"] = {
            "provider": self.PROVIDER_NAME,
            "model": model,
            "prompt_name": PROMPT_NAME,
            "prompt_version": PROMPT_VERSION,
            "schema_name": SCHEMA_NAME,
            "schema_version": SCHEMA_VERSION,
            "image_count": len(prepared),
            "input_byte_count": sum(image.size_bytes for image in prepared),
            "correlation_id": correlation_id or "",
            "ai_generated": True,
            "requires_human_review": True,
            "advisory_only": True,
        }
        logger.info(
            "ai.gemini_recommendation_ready",
            extra={
                "provider": self.PROVIDER_NAME,
                "model": model,
                "correlation_id": correlation_id,
                "overall_confidence": validated.overall_confidence,
                "recommended_category": validated.recommended_category.value,
                "recommended_priority": validated.recommended_priority.value,
                "finding_count": len(validated.findings),
            },
        )
        return AIProviderResult(
            model_name=model,
            model_version=PROMPT_VERSION,
            result_json=result_payload,
            provider=self.PROVIDER_NAME,
            prompt_version=PROMPT_VERSION,
            schema_version=SCHEMA_VERSION,
            input_image_count=len(prepared),
            input_byte_count=sum(image.size_bytes for image in prepared),
        )

    def _call_gemini(
        self,
        *,
        model: str,
        api_key: str,
        ticket_context: dict,
        prepared: list[PreparedImage],
        correlation_id: str,
    ) -> dict[str, Any]:
        from google.genai import types

        client = self._get_client(api_key)
        timeout = max(5, int(getattr(settings, "FACILITYOPS_GEMINI_TIMEOUT_SECONDS", 60)))
        temperature = float(getattr(settings, "FACILITYOPS_GEMINI_TEMPERATURE", 0.2))

        parts: list[Any] = [
            types.Part.from_text(
                text=build_user_prompt(
                    ticket_context=ticket_context,
                    image_count=len(prepared),
                )
            )
        ]
        for image in prepared:
            parts.append(
                types.Part.from_bytes(data=image.content, mime_type=image.mime_type)
            )

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            temperature=temperature,
            response_mime_type="application/json",
            response_json_schema=facility_recommendation_json_schema(),
            http_options=types.HttpOptions(timeout=timeout * 1000),
        )

        try:
            response = client.models.generate_content(
                model=model,
                contents=parts,
                config=config,
            )
        except Exception as exc:
            raise _normalize_gemini_exception(exc) from exc

        finish_reason = ""
        try:
            if response.candidates:
                finish_reason = str(getattr(response.candidates[0], "finish_reason", "") or "")
        except Exception:
            finish_reason = ""

        if finish_reason and "SAFETY" in finish_reason.upper():
            raise AIAnalysisError(AIErrorCode.SAFETY_BLOCKED)

        payload: dict[str, Any] | None = None
        parsed = getattr(response, "parsed", None)
        if isinstance(parsed, dict):
            payload = parsed
        elif parsed is not None and hasattr(parsed, "model_dump"):
            payload = parsed.model_dump(mode="json")
        else:
            text = getattr(response, "text", None) or ""
            if not text.strip():
                raise AIAnalysisError(AIErrorCode.INVALID_PROVIDER_RESPONSE)
            import json

            try:
                payload = json.loads(text)
            except json.JSONDecodeError as exc:
                raise AIAnalysisError(AIErrorCode.INVALID_PROVIDER_RESPONSE) from exc

        if not isinstance(payload, dict):
            raise AIAnalysisError(AIErrorCode.INVALID_PROVIDER_RESPONSE)

        if getattr(settings, "FACILITYOPS_AI_STORE_RAW_RESPONSE", False):
            payload = {
                **payload,
                "_debug_raw_text_preview": (getattr(response, "text", None) or "")[:2000],
            }

        logger.info(
            "ai.gemini_completed",
            extra={
                "provider": self.PROVIDER_NAME,
                "model": model,
                "correlation_id": correlation_id,
                "image_count": len(prepared),
                "finish_reason": finish_reason,
                "prompt_version": PROMPT_VERSION,
                "schema_name": SCHEMA_NAME,
            },
        )
        return payload


def _normalize_gemini_exception(exc: Exception) -> AIAnalysisError:
    text = str(exc).lower()
    status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if status in {401, 403} or "api key" in text or "permission" in text or "unauth" in text:
        return AIAnalysisError(AIErrorCode.PROVIDER_AUTH_FAILED)
    if status == 429 or "rate" in text or "quota" in text:
        return AIAnalysisError(AIErrorCode.PROVIDER_RATE_LIMITED, retryable=True)
    if status in {500, 502, 503, 504} or "unavailable" in text or "internal" in text:
        return AIAnalysisError(AIErrorCode.PROVIDER_UNAVAILABLE, retryable=True)
    if "timeout" in text or "timed out" in text or "deadline" in text:
        return AIAnalysisError(AIErrorCode.PROVIDER_TIMEOUT, retryable=True)
    if "safety" in text or "blocked" in text:
        return AIAnalysisError(AIErrorCode.SAFETY_BLOCKED)
    return AIAnalysisError(AIErrorCode.PROVIDER_UNAVAILABLE, retryable=True)
