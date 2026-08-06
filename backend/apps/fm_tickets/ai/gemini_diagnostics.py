"""FO-102 Gemini provider failure classification (no secrets / prompts / images)."""

from __future__ import annotations

import re
from typing import Any

from django.utils import timezone

from .errors import AIAnalysisError, AIErrorCode, admin_message_for_code

# Countdown seconds after attempt N fails before attempt N+1 (1m, 5m, 15m, 30m).
DEFAULT_RETRY_COUNTDOWNS_SECONDS = (60, 300, 900, 1800)


def retry_countdown_seconds(failed_attempt: int) -> int:
    """Return Celery countdown after ``failed_attempt`` (1-based) fails."""
    if failed_attempt < 1:
        failed_attempt = 1
    index = min(failed_attempt - 1, len(DEFAULT_RETRY_COUNTDOWNS_SECONDS) - 1)
    return int(DEFAULT_RETRY_COUNTDOWNS_SECONDS[index])


def _safe_provider_message(text: str, *, limit: int = 400) -> str:
    """Truncate and strip likely secrets from provider error text."""
    cleaned = re.sub(
        r"(?i)(api[_-]?key|authorization|bearer|token|AQ\.[A-Za-z0-9_-]+)\s*[:=]?\s*\S+",
        r"\1=[redacted]",
        text or "",
    )
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:limit]


def _extract_http_status(exc: Exception) -> int | None:
    for attr in ("status_code", "code"):
        value = getattr(exc, attr, None)
        if isinstance(value, int) and 100 <= value <= 599:
            return value
        if isinstance(value, str) and value.isdigit():
            code = int(value)
            if 100 <= code <= 599:
                return code
    response = getattr(exc, "response", None)
    if response is not None:
        status = getattr(response, "status_code", None)
        if isinstance(status, int):
            return status
    match = re.search(r"\b([45]\d{2})\b", str(exc))
    if match:
        return int(match.group(1))
    return None


def classify_gemini_exception(exc: Exception, *, model: str = "") -> AIAnalysisError:
    """Map Gemini/SDK exceptions to FO-102 error codes + safe diagnostics."""
    text = str(exc) or ""
    lower = text.lower()
    status = _extract_http_status(exc)
    provider_code = ""
    for marker in (
        "resource_exhausted",
        "invalid_argument",
        "unauthenticated",
        "permission_denied",
        "not_found",
        "unavailable",
        "deadline_exceeded",
        "failed_precondition",
    ):
        if marker in lower:
            provider_code = marker.upper()
            break

    code = AIErrorCode.UNKNOWN_PROVIDER_ERROR
    retryable: bool | None = None

    if (
        status in {401, 403}
        or "api key" in lower
        or "api_key" in lower
        or "unauth" in lower
        or "invalid api key" in lower
        or "api key not valid" in lower
    ):
        if "permission" in lower or status == 403:
            code = AIErrorCode.PERMISSION_DENIED
        else:
            code = AIErrorCode.INVALID_API_KEY
        retryable = False
    elif "permission_denied" in lower or "permission denied" in lower:
        code = AIErrorCode.PERMISSION_DENIED
        retryable = False
    elif (
        "billing" in lower
        or "payment" in lower
        or "prepay" in lower
        or "billing_disabled" in lower
        or "check your billing" in lower
        or ("credit" in lower and ("bill" in lower or "exhaust" in lower or "require" in lower))
    ):
        code = AIErrorCode.BILLING_DISABLED
        # Billing rarely recovers without human action — do not auto-retry forever.
        retryable = False
    elif status == 404 or (
        "model" in lower
        and ("not found" in lower or "does not exist" in lower or "not supported" in lower)
    ):
        code = AIErrorCode.MODEL_NOT_FOUND
        retryable = False
    elif (
        status == 429
        or "resource_exhausted" in lower
        or "quota" in lower
        or "rate limit" in lower
        or "rate_limit" in lower
    ):
        if "per day" in lower or "per_day" in lower or "daily" in lower or "rpd" in lower:
            code = AIErrorCode.RATE_LIMIT_RPD
            retryable = True
        elif (
            "per minute" in lower
            or "per_minute" in lower
            or "rpm" in lower
            or "rate limit" in lower
            or "rate_limit" in lower
        ):
            code = AIErrorCode.RATE_LIMIT_RPM
            retryable = True
        elif "quota" in lower or "resource_exhausted" in lower:
            # Google often uses RESOURCE_EXHAUSTED for prepaid/quota/billing alike.
            code = AIErrorCode.QUOTA_EXHAUSTED
            retryable = True
        else:
            code = AIErrorCode.PROVIDER_RATE_LIMITED
            retryable = True
    elif "too many states" in lower or (
        status == 400 and ("invalid_argument" in lower or "schema" in lower)
    ):
        code = AIErrorCode.INVALID_PROVIDER_RESPONSE
        retryable = False
    elif status in {500, 502, 503, 504} or "unavailable" in lower:
        code = AIErrorCode.PROVIDER_UNAVAILABLE
        retryable = True
    elif (
        "timeout" in lower
        or "timed out" in lower
        or "deadline" in lower
        or status == 408
    ):
        code = AIErrorCode.NETWORK_TIMEOUT
        retryable = True
    elif "safety" in lower or "blocked" in lower:
        code = AIErrorCode.SAFETY_BLOCKED
        retryable = False
    elif status in {401, 403}:
        code = AIErrorCode.PROVIDER_AUTH_FAILED
        retryable = False

    diagnostics = build_provider_diagnostics(
        http_status=status,
        provider_error_code=provider_code,
        provider_message=text,
        model=model,
        error_code=code,
        retryable=retryable
        if retryable is not None
        else code
        in {
            AIErrorCode.PROVIDER_TIMEOUT,
            AIErrorCode.PROVIDER_RATE_LIMITED,
            AIErrorCode.PROVIDER_UNAVAILABLE,
            AIErrorCode.RATE_LIMIT_RPM,
            AIErrorCode.RATE_LIMIT_RPD,
            AIErrorCode.QUOTA_EXHAUSTED,
            AIErrorCode.NETWORK_TIMEOUT,
            AIErrorCode.UNKNOWN_PROVIDER_ERROR,
        },
    )
    return AIAnalysisError(
        code,
        retryable=retryable,
        detail=_safe_provider_message(text, limit=200),
        diagnostics=diagnostics,
    )


def build_provider_diagnostics(
    *,
    http_status: int | None,
    provider_error_code: str,
    provider_message: str,
    model: str,
    error_code: str,
    retryable: bool,
) -> dict[str, Any]:
    return {
        "http_status": http_status,
        "provider_error_code": (provider_error_code or "")[:80],
        "provider_message": _safe_provider_message(provider_message),
        "retryable": bool(retryable),
        "request_timestamp": timezone.now().isoformat(),
        "model": (model or "")[:100],
        "error_code": error_code,
        "admin_message": admin_message_for_code(error_code),
    }
