"""Gemini Vision provider adapter (FO-085 + FO-086 recommendations).

Uses the official google-genai SDK with generate_content + JSON schema.
Image strategy: inline bytes via Part.from_bytes (no Files API for v1).
FO-086 selects fm_ticket_recommendation_v1 + FacilityRecommendationV1 automatically.
"""

from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from pydantic import ValidationError as PydanticValidationError

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


def _normalize_gemini_recommendation_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Pin identity fields and reconcile confidence scales before Pydantic.

    FO-086 recommendation fields use 0–100 integers; FO-085 nested observation
    confidence is 0.0–1.0. Gemini often emits 0–100 everywhere once bounds are
    stripped from response_json_schema.
    """
    out = {
        **payload,
        "schema_name": SCHEMA_NAME,
        "schema_version": SCHEMA_VERSION,
    }

    def _to_unit_interval(value: Any) -> Any:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return value
        if value > 1:
            return round(float(value) / 100.0, 4)
        return value

    for image in out.get("image_results") or []:
        if not isinstance(image, dict):
            continue
        for key in ("observations", "visible_assets", "visible_hazards"):
            for item in image.get(key) or []:
                if isinstance(item, dict) and "confidence" in item:
                    item["confidence"] = _to_unit_interval(item["confidence"])
    for finding in out.get("cross_image_findings") or []:
        if isinstance(finding, dict) and "confidence" in finding:
            finding["confidence"] = _to_unit_interval(finding["confidence"])
    return out


class GeminiVisionProvider:
    PROVIDER_NAME = "gemini"

    def __init__(self, *, client=None):
        self._client = client

    def _require_config(self) -> tuple[str, str]:
        from apps.fm_tickets.ai_administration_service import get_runtime_setting

        api_key = (getattr(settings, "GEMINI_API_KEY", None) or "").strip()
        model = (get_runtime_setting("FACILITYOPS_GEMINI_MODEL", None) or "").strip()
        enabled = bool(get_runtime_setting("FACILITYOPS_GEMINI_ENABLED", False))
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
        if not isinstance(analysis, dict):
            raise AIAnalysisError(AIErrorCode.INVALID_PROVIDER_RESPONSE)
        analysis = _normalize_gemini_recommendation_payload(analysis)
        try:
            validated = validate_facility_recommendation(analysis)
        except PydanticValidationError as exc:
            raise AIAnalysisError(AIErrorCode.SCHEMA_VALIDATION_FAILED) from exc
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
        from apps.fm_tickets.ai_administration_service import get_runtime_setting

        timeout = max(5, int(get_runtime_setting("FACILITYOPS_GEMINI_TIMEOUT_SECONDS", 60)))
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
    if status == 429 or "rate" in text or "quota" in text or "resource_exhausted" in text:
        return AIAnalysisError(AIErrorCode.PROVIDER_RATE_LIMITED, retryable=True)
    if "too many states" in text or (
        status == 400 and ("invalid_argument" in text or "schema" in text)
    ):
        return AIAnalysisError(AIErrorCode.INVALID_PROVIDER_RESPONSE)
    if status in {500, 502, 503, 504} or "unavailable" in text or "internal" in text:
        return AIAnalysisError(AIErrorCode.PROVIDER_UNAVAILABLE, retryable=True)
    if "timeout" in text or "timed out" in text or "deadline" in text:
        return AIAnalysisError(AIErrorCode.PROVIDER_TIMEOUT, retryable=True)
    if "safety" in text or "blocked" in text:
        return AIAnalysisError(AIErrorCode.SAFETY_BLOCKED)
    return AIAnalysisError(AIErrorCode.PROVIDER_UNAVAILABLE, retryable=True)
