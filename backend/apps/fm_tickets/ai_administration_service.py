"""FO-093 AI Administration & Governance — centralized configuration service.

Governs AI provider settings, feature flags, thresholds, prompt registry
metadata, policies, health, and audit history. Does not run analysis,
mutate tickets, retrain models, or expose secrets/prompt text.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Max, Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.fm_tickets.models import AIAdminAuditEntry, AIAdminConfig, AITicketAnalysis

AI_ADMIN_PERMISSION = "settings.manage"
CONFIG_SCOPE = "global"
# Stable singleton id for the global AI admin config row.
AI_ADMIN_CONFIG_ID = uuid.UUID("00000000-0000-4000-8000-000000000093")

ALLOWED_PROVIDERS = frozenset({"placeholder", "gemini", "gemini_vision"})

FEATURE_FLAG_FIELDS = (
    "flag_image_analysis",
    "flag_recommendation_engine",
    "flag_executive_dashboard",
    "flag_similar_cases",
    "flag_attention_center",
    "flag_operational_insights",
)

PROVIDER_FIELDS = (
    "provider",
    "model_name",
    "enabled",
    "timeout_seconds",
    "max_images",
    "max_upload_bytes",
    "retry_attempts",
    "store_raw_response",
)

THRESHOLD_FIELDS = (
    "confidence_threshold",
    "health_warning_threshold",
    "health_critical_threshold",
    "attention_warning_threshold",
    "attention_critical_threshold",
    "acceptance_healthy_rate",
    "override_warning_rate",
)

PATCHABLE_FIELDS = PROVIDER_FIELDS + FEATURE_FLAG_FIELDS + THRESHOLD_FIELDS

SECRET_FIELD_NAMES = frozenset(
    {
        "api_key",
        "gemini_api_key",
        "GEMINI_API_KEY",
        "password",
        "secret",
        "token",
        "prompt",
        "prompt_text",
        "raw_response",
    }
)

PROMPT_REGISTRY = (
    {
        "name": "fm_ticket_image_analysis",
        "version": "v1",
        "description": "FM ticket image analysis prompt for Gemini Vision.",
        "active": True,
        "last_updated": "2026-07-01",
    },
    {
        "name": "recommendation_engine",
        "version": "v1",
        "description": "FacilityRecommendationV1 category and priority guidance.",
        "active": True,
        "last_updated": "2026-07-15",
    },
    {
        "name": "executive_summary_rules",
        "version": "v1",
        "description": "Deterministic FO-092 executive summary rules (not generative).",
        "active": True,
        "last_updated": "2026-08-04",
    },
)

GOVERNANCE_POLICIES = (
    {
        "code": "human_review_mandatory",
        "title": "Human review is mandatory",
        "statement": "AI recommendations require human review before operational use.",
    },
    {
        "code": "no_auto_close",
        "title": "AI cannot auto-close tickets",
        "statement": "FacilityOps AI never closes FM Tickets automatically.",
    },
    {
        "code": "no_auto_assign",
        "title": "AI cannot auto-assign technicians",
        "statement": "Technician assignment remains a human operational decision.",
    },
    {
        "code": "no_auto_category",
        "title": "AI cannot modify category",
        "statement": "Category changes require an authorized human decision.",
    },
    {
        "code": "no_auto_priority",
        "title": "AI cannot modify priority",
        "statement": "Priority changes require an authorized human decision.",
    },
    {
        "code": "advisory_recommendations",
        "title": "AI recommendations are advisory",
        "statement": "Recommendations inform humans; they do not replace judgment.",
    },
    {
        "code": "deterministic_summaries",
        "title": "AI summaries are deterministic where applicable",
        "statement": "Executive and operational summaries use rule-based logic, not generative claims.",
    },
)


def assert_ai_admin(user) -> None:
    from apps.access_control.services import user_has_permission

    if user is None or not user.is_authenticated:
        raise PermissionDenied("Authentication required.")
    if not user_has_permission(user, AI_ADMIN_PERMISSION):
        raise PermissionDenied(
            "AI administration requires settings.manage permission."
        )


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def get_or_create_config() -> AIAdminConfig:
    config, _ = AIAdminConfig.objects.get_or_create(id=AI_ADMIN_CONFIG_ID)
    return config


def _env_provider() -> str:
    return (getattr(settings, "FACILITYOPS_AI_PROVIDER", "placeholder") or "placeholder").strip().lower()


def _env_model() -> str:
    return (getattr(settings, "FACILITYOPS_GEMINI_MODEL", "") or "").strip()


def _env_enabled() -> bool:
    return bool(getattr(settings, "FACILITYOPS_GEMINI_ENABLED", False))


def build_effective_config(config: AIAdminConfig | None = None) -> dict[str, Any]:
    """Merge DB overrides onto Django/env defaults. Never includes API keys."""
    row = config or get_or_create_config()
    provider = (row.provider or _env_provider()).strip().lower() or "placeholder"
    model_name = (row.model_name or _env_model()).strip()
    enabled = _env_enabled() if row.enabled is None else bool(row.enabled)
    timeout = row.timeout_seconds
    if timeout is None:
        timeout = int(getattr(settings, "FACILITYOPS_GEMINI_TIMEOUT_SECONDS", 60))
    max_images = row.max_images
    if max_images is None:
        max_images = int(getattr(settings, "FACILITYOPS_GEMINI_MAX_IMAGES", 5))
    max_bytes = row.max_upload_bytes
    if max_bytes is None:
        max_bytes = int(getattr(settings, "FACILITYOPS_GEMINI_MAX_TOTAL_BYTES", 15 * 1024 * 1024))
    retries = row.retry_attempts
    if retries is None:
        retries = int(getattr(settings, "FACILITYOPS_AI_MAX_ATTEMPTS", 3))
    store_raw = (
        bool(getattr(settings, "FACILITYOPS_AI_STORE_RAW_RESPONSE", False))
        if row.store_raw_response is None
        else bool(row.store_raw_response)
    )
    temperature = float(getattr(settings, "FACILITYOPS_GEMINI_TEMPERATURE", 0.2))

    def threshold(field: str, setting_name: str, default):
        value = getattr(row, field, None)
        if value is not None:
            return value
        return getattr(settings, setting_name, default)

    return {
        "scope": CONFIG_SCOPE,
        "provider": {
            "provider": provider,
            "model": model_name,
            "enabled": enabled,
            "timeout_seconds": timeout,
            "max_images": max_images,
            "max_upload_bytes": max_bytes,
            "retry_attempts": retries,
            "temperature": temperature,
            "temperature_readonly": True,
            "store_raw_response": store_raw,
            "api_key_configured": bool(
                (getattr(settings, "GEMINI_API_KEY", None) or "").strip()
            ),
            "api_key_editable": False,
        },
        "feature_flags": {
            "image_analysis": bool(row.flag_image_analysis),
            "recommendation_engine": bool(row.flag_recommendation_engine),
            "executive_dashboard": bool(row.flag_executive_dashboard),
            "similar_cases": bool(row.flag_similar_cases),
            "attention_center": bool(row.flag_attention_center),
            "operational_insights": bool(row.flag_operational_insights),
        },
        "thresholds": {
            "confidence_threshold": float(
                threshold(
                    "confidence_threshold",
                    "FACILITYOPS_AI_LOW_CONFIDENCE_THRESHOLD",
                    50.0,
                )
            ),
            "health_warning_threshold": int(
                threshold(
                    "health_warning_threshold",
                    "FACILITYOPS_AI_HEALTH_NEEDS_REVIEW_MIN",
                    50,
                )
            ),
            "health_critical_threshold": int(
                threshold(
                    "health_critical_threshold",
                    "FACILITYOPS_AI_HEALTH_HEALTHY_MIN",
                    75,
                )
            ),
            "attention_warning_threshold": int(
                threshold(
                    "attention_warning_threshold",
                    "FACILITYOPS_AI_ATTENTION_HIGH_MIN",
                    60,
                )
            ),
            "attention_critical_threshold": int(
                threshold(
                    "attention_critical_threshold",
                    "FACILITYOPS_AI_ATTENTION_CRITICAL_MIN",
                    80,
                )
            ),
            "acceptance_healthy_rate": float(
                threshold(
                    "acceptance_healthy_rate",
                    "FACILITYOPS_AI_HIGH_ACCEPTANCE_RATE",
                    0.70,
                )
            ),
            "override_warning_rate": float(
                threshold(
                    "override_warning_rate",
                    "FACILITYOPS_AI_HIGH_OVERRIDE_RATE",
                    0.40,
                )
            ),
        },
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def is_feature_enabled(flag_key: str) -> bool:
    """Fail-safe feature flag check. Unknown flags are treated as disabled."""
    mapping = {
        "image_analysis": "flag_image_analysis",
        "recommendation_engine": "flag_recommendation_engine",
        "executive_dashboard": "flag_executive_dashboard",
        "similar_cases": "flag_similar_cases",
        "attention_center": "flag_attention_center",
        "operational_insights": "flag_operational_insights",
    }
    field = mapping.get(flag_key)
    if not field:
        return False
    try:
        row = get_or_create_config()
    except Exception:
        # Fail safe: if config store is unavailable, keep core analysis available
        # only for image_analysis/recommendation to avoid blocking FO-084–087.
        return flag_key in {"image_analysis", "recommendation_engine"}
    return bool(getattr(row, field, False))


def get_runtime_setting(setting_name: str, default=None):
    """Resolve a Django AI setting, preferring DB overrides for mapped thresholds."""
    config = get_or_create_config()
    mapping = {
        "FACILITYOPS_AI_LOW_CONFIDENCE_THRESHOLD": "confidence_threshold",
        "FACILITYOPS_AI_HEALTH_NEEDS_REVIEW_MIN": "health_warning_threshold",
        "FACILITYOPS_AI_HEALTH_HEALTHY_MIN": "health_critical_threshold",
        "FACILITYOPS_AI_ATTENTION_HIGH_MIN": "attention_warning_threshold",
        "FACILITYOPS_AI_ATTENTION_CRITICAL_MIN": "attention_critical_threshold",
        "FACILITYOPS_AI_HIGH_ACCEPTANCE_RATE": "acceptance_healthy_rate",
        "FACILITYOPS_AI_HIGH_OVERRIDE_RATE": "override_warning_rate",
        "FACILITYOPS_AI_PROVIDER": None,
        "FACILITYOPS_GEMINI_ENABLED": None,
        "FACILITYOPS_GEMINI_MODEL": None,
        "FACILITYOPS_GEMINI_TIMEOUT_SECONDS": None,
        "FACILITYOPS_GEMINI_MAX_IMAGES": None,
        "FACILITYOPS_GEMINI_MAX_TOTAL_BYTES": None,
        "FACILITYOPS_AI_MAX_ATTEMPTS": None,
        "FACILITYOPS_AI_STORE_RAW_RESPONSE": None,
    }
    field = mapping.get(setting_name)
    if field:
        value = getattr(config, field, None)
        if value is not None:
            return value
    if setting_name == "FACILITYOPS_AI_PROVIDER" and config.provider:
        return config.provider
    if setting_name == "FACILITYOPS_GEMINI_MODEL" and config.model_name:
        return config.model_name
    if setting_name == "FACILITYOPS_GEMINI_ENABLED" and config.enabled is not None:
        return config.enabled
    if setting_name == "FACILITYOPS_GEMINI_TIMEOUT_SECONDS" and config.timeout_seconds is not None:
        return config.timeout_seconds
    if setting_name == "FACILITYOPS_GEMINI_MAX_IMAGES" and config.max_images is not None:
        return config.max_images
    if setting_name == "FACILITYOPS_GEMINI_MAX_TOTAL_BYTES" and config.max_upload_bytes is not None:
        return config.max_upload_bytes
    if setting_name == "FACILITYOPS_AI_MAX_ATTEMPTS" and config.retry_attempts is not None:
        return config.retry_attempts
    if setting_name == "FACILITYOPS_AI_STORE_RAW_RESPONSE" and config.store_raw_response is not None:
        return config.store_raw_response
    return getattr(settings, setting_name, default)


def _validate_patch(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValidationError({"detail": "Expected a JSON object."})
    for key in payload:
        lowered = str(key).lower()
        if lowered in SECRET_FIELD_NAMES or "secret" in lowered or "api_key" in lowered:
            raise ValidationError({key: "Secrets and API keys cannot be set via this API."})
        if "prompt" in lowered:
            raise ValidationError({key: "Prompt text cannot be modified via this API."})

    cleaned: dict[str, Any] = {}

    # Nested or flat shapes both accepted.
    provider = payload.get("provider")
    if isinstance(provider, dict):
        for key in PROVIDER_FIELDS:
            if key == "model_name" and "model" in provider:
                cleaned["model_name"] = provider.get("model")
            elif key in provider:
                cleaned[key] = provider[key]
    flags = payload.get("feature_flags")
    if isinstance(flags, dict):
        flag_map = {
            "image_analysis": "flag_image_analysis",
            "recommendation_engine": "flag_recommendation_engine",
            "executive_dashboard": "flag_executive_dashboard",
            "similar_cases": "flag_similar_cases",
            "attention_center": "flag_attention_center",
            "operational_insights": "flag_operational_insights",
        }
        for src, dest in flag_map.items():
            if src in flags:
                cleaned[dest] = flags[src]
    thresholds = payload.get("thresholds")
    if isinstance(thresholds, dict):
        for key in THRESHOLD_FIELDS:
            if key in thresholds:
                cleaned[key] = thresholds[key]

    for key in PATCHABLE_FIELDS:
        if key in payload and key not in cleaned:
            cleaned[key] = payload[key]

    if "provider" in cleaned and cleaned["provider"] is not None:
        provider_value = str(cleaned["provider"]).strip().lower()
        if provider_value not in ALLOWED_PROVIDERS:
            raise ValidationError(
                {"provider": f"Provider must be one of: {', '.join(sorted(ALLOWED_PROVIDERS))}."}
            )
        cleaned["provider"] = provider_value

    if "timeout_seconds" in cleaned and cleaned["timeout_seconds"] is not None:
        value = int(cleaned["timeout_seconds"])
        if value < 5 or value > 600:
            raise ValidationError({"timeout_seconds": "Must be between 5 and 600."})
        cleaned["timeout_seconds"] = value

    if "max_images" in cleaned and cleaned["max_images"] is not None:
        value = int(cleaned["max_images"])
        if value < 1 or value > 20:
            raise ValidationError({"max_images": "Must be between 1 and 20."})
        cleaned["max_images"] = value

    if "max_upload_bytes" in cleaned and cleaned["max_upload_bytes"] is not None:
        value = int(cleaned["max_upload_bytes"])
        if value < 1024 or value > 50 * 1024 * 1024:
            raise ValidationError(
                {"max_upload_bytes": "Must be between 1024 and 52428800 bytes."}
            )
        cleaned["max_upload_bytes"] = value

    if "retry_attempts" in cleaned and cleaned["retry_attempts"] is not None:
        value = int(cleaned["retry_attempts"])
        if value < 1 or value > 10:
            raise ValidationError({"retry_attempts": "Must be between 1 and 10."})
        cleaned["retry_attempts"] = value

    if "confidence_threshold" in cleaned and cleaned["confidence_threshold"] is not None:
        value = float(cleaned["confidence_threshold"])
        if value < 0 or value > 100:
            raise ValidationError({"confidence_threshold": "Must be between 0 and 100."})
        cleaned["confidence_threshold"] = value

    for rate_field in ("acceptance_healthy_rate", "override_warning_rate"):
        if rate_field in cleaned and cleaned[rate_field] is not None:
            value = float(cleaned[rate_field])
            if value < 0 or value > 1:
                raise ValidationError({rate_field: "Must be between 0 and 1."})
            cleaned[rate_field] = value

    for band_field in (
        "health_warning_threshold",
        "health_critical_threshold",
        "attention_warning_threshold",
        "attention_critical_threshold",
    ):
        if band_field in cleaned and cleaned[band_field] is not None:
            value = int(cleaned[band_field])
            if value < 0 or value > 100:
                raise ValidationError({band_field: "Must be between 0 and 100."})
            cleaned[band_field] = value

    for flag in FEATURE_FLAG_FIELDS:
        if flag in cleaned and cleaned[flag] is not None:
            cleaned[flag] = bool(cleaned[flag])

    if "enabled" in cleaned and cleaned["enabled"] is not None:
        cleaned["enabled"] = bool(cleaned["enabled"])
    if "store_raw_response" in cleaned and cleaned["store_raw_response"] is not None:
        cleaned["store_raw_response"] = bool(cleaned["store_raw_response"])
    if "model_name" in cleaned and cleaned["model_name"] is not None:
        cleaned["model_name"] = str(cleaned["model_name"]).strip()[:100]

    # Reject unknown top-level keys that look like attempts to smuggle secrets.
    allowed_top = set(PATCHABLE_FIELDS) | {
        "provider",
        "feature_flags",
        "thresholds",
        "model",
    }
    for key in payload:
        if key not in allowed_top and key not in PATCHABLE_FIELDS:
            raise ValidationError({key: "Unknown or unsupported configuration field."})

    return cleaned


def _record_audit(*, actor, field: str, old, new, note: str = "") -> None:
    AIAdminAuditEntry.objects.create(
        actor=actor if getattr(actor, "pk", None) else None,
        actor_email=(getattr(actor, "email", "") or "")[:254],
        changed_field=field,
        old_value=_stringify(old)[:2000],
        new_value=_stringify(new)[:2000],
        scope=CONFIG_SCOPE,
        note=note[:255],
        created_by=str(actor.id) if getattr(actor, "id", None) else None,
        updated_by=str(actor.id) if getattr(actor, "id", None) else None,
    )


class AIAdministrationService:
    """Central FO-093 governance orchestration."""

    def get_config(self, user) -> dict[str, Any]:
        assert_ai_admin(user)
        effective = build_effective_config()
        return {
            **effective,
            "interpretation": {
                "scope": CONFIG_SCOPE,
                "note": (
                    "AI administration is platform-global in V1. API keys are never "
                    "exposed or editable here. Prompt text is not available."
                ),
            },
            "generated_at": timezone.localtime().isoformat(),
        }

    @transaction.atomic
    def update_config(self, user, payload: dict[str, Any]) -> dict[str, Any]:
        assert_ai_admin(user)
        cleaned = _validate_patch(payload)
        if not cleaned:
            raise ValidationError({"detail": "No supported configuration fields provided."})
        config = get_or_create_config()
        for field, new_value in cleaned.items():
            old_value = getattr(config, field)
            if old_value == new_value:
                continue
            setattr(config, field, new_value)
            _record_audit(
                actor=user,
                field=field,
                old=old_value,
                new=new_value,
                note="AI administration configuration update",
            )
        config.updated_by = str(user.id) if getattr(user, "id", None) else None
        config.save()
        return self.get_config(user)

    def list_prompts(self, user) -> dict[str, Any]:
        assert_ai_admin(user)
        return {
            "scope": CONFIG_SCOPE,
            "prompts": list(PROMPT_REGISTRY),
            "editable": False,
            "prompt_text_exposed": False,
            "note": "Prompt registry is read-only metadata. Prompt text is never returned.",
            "generated_at": timezone.localtime().isoformat(),
        }

    def list_policies(self, user) -> dict[str, Any]:
        assert_ai_admin(user)
        return {
            "scope": CONFIG_SCOPE,
            "policies": list(GOVERNANCE_POLICIES),
            "editable": False,
            "generated_at": timezone.localtime().isoformat(),
        }

    def get_health(self, user) -> dict[str, Any]:
        assert_ai_admin(user)
        effective = build_effective_config()
        qs = AITicketAnalysis.objects.all()
        tenant = getattr(user, "tenant", None)
        scope_note = "global"
        if tenant is not None:
            qs = qs.filter(tenant=tenant)
            scope_note = "tenant"

        aggregates = qs.aggregate(
            queued=Count("id", filter=models_Q_status(AITicketAnalysis.Status.QUEUED)),
            processing=Count(
                "id", filter=models_Q_status(AITicketAnalysis.Status.PROCESSING)
            ),
            completed=Count(
                "id", filter=models_Q_status(AITicketAnalysis.Status.COMPLETED)
            ),
            failed=Count("id", filter=models_Q_status(AITicketAnalysis.Status.FAILED)),
            last_success=Max(
                "completed_at",
                filter=models_Q_status(AITicketAnalysis.Status.COMPLETED),
            ),
            retry_sum=Sum("attempt_count"),
        )
        provider = effective["provider"]
        ai_enabled = bool(provider["enabled"]) or provider["provider"] == "placeholder"
        if provider["provider"] in {"gemini", "gemini_vision"} and not provider["api_key_configured"]:
            status = "misconfigured"
            status_label = "Misconfigured"
        elif not effective["feature_flags"]["image_analysis"]:
            status = "disabled"
            status_label = "Disabled"
        elif aggregates["failed"] and aggregates["failed"] > (aggregates["completed"] or 0):
            status = "degraded"
            status_label = "Degraded"
        else:
            status = "healthy"
            status_label = "Healthy"

        return {
            "scope": scope_note,
            "provider_status": status,
            "provider_status_label": status_label,
            "active_model": provider["model"] or provider["provider"],
            "ai_enabled": ai_enabled,
            "feature_image_analysis": effective["feature_flags"]["image_analysis"],
            "last_successful_analysis": (
                aggregates["last_success"].isoformat()
                if aggregates["last_success"]
                else None
            ),
            "queued_analyses": aggregates["queued"] or 0,
            "processing_analyses": aggregates["processing"] or 0,
            "completed_analyses": aggregates["completed"] or 0,
            "failed_analyses": aggregates["failed"] or 0,
            "retry_count": aggregates["retry_sum"] or 0,
            "health_status": status,
            "health_status_label": status_label,
            "generated_at": timezone.localtime().isoformat(),
        }

    def list_audit(self, user, *, limit: int = 50) -> dict[str, Any]:
        assert_ai_admin(user)
        limit = max(1, min(int(limit or 50), 200))
        entries = list(AIAdminAuditEntry.objects.all()[:limit])
        return {
            "scope": CONFIG_SCOPE,
            "count": len(entries),
            "entries": [
                {
                    "id": str(entry.id),
                    "actor_email": entry.actor_email,
                    "changed_field": entry.changed_field,
                    "old_value": entry.old_value,
                    "new_value": entry.new_value,
                    "scope": entry.scope,
                    "note": entry.note,
                    "created_at": entry.created_at.isoformat() if entry.created_at else None,
                }
                for entry in entries
            ],
            "generated_at": timezone.localtime().isoformat(),
        }


def models_Q_status(status: str):
    from django.db.models import Q

    return Q(status=status)


def get_ai_config(user) -> dict[str, Any]:
    return AIAdministrationService().get_config(user)


def update_ai_config(user, payload) -> dict[str, Any]:
    return AIAdministrationService().update_config(user, payload)


def list_ai_prompts(user) -> dict[str, Any]:
    return AIAdministrationService().list_prompts(user)


def list_ai_policies(user) -> dict[str, Any]:
    return AIAdministrationService().list_policies(user)


def get_ai_health(user) -> dict[str, Any]:
    return AIAdministrationService().get_health(user)


def list_ai_audit(user, *, limit: int = 50) -> dict[str, Any]:
    return AIAdministrationService().list_audit(user, limit=limit)
