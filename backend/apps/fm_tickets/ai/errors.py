"""Normalized AI analysis error codes (FO-085 + FO-102 provider diagnostics)."""

from __future__ import annotations


class AIErrorCode:
    PROVIDER_NOT_CONFIGURED = "PROVIDER_NOT_CONFIGURED"
    NO_VALID_IMAGES = "NO_VALID_IMAGES"
    UNSUPPORTED_IMAGE_TYPE = "UNSUPPORTED_IMAGE_TYPE"
    IMAGE_LIMIT_EXCEEDED = "IMAGE_LIMIT_EXCEEDED"
    INPUT_TOO_LARGE = "INPUT_TOO_LARGE"
    STORAGE_READ_FAILED = "STORAGE_READ_FAILED"
    PROVIDER_TIMEOUT = "PROVIDER_TIMEOUT"
    # Legacy coarse bucket (FO-085); FO-102 prefers finer codes below.
    PROVIDER_RATE_LIMITED = "PROVIDER_RATE_LIMITED"
    PROVIDER_AUTH_FAILED = "PROVIDER_AUTH_FAILED"
    PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
    SAFETY_BLOCKED = "SAFETY_BLOCKED"
    INVALID_PROVIDER_RESPONSE = "INVALID_PROVIDER_RESPONSE"
    SCHEMA_VALIDATION_FAILED = "SCHEMA_VALIDATION_FAILED"
    ANALYSIS_INTERNAL_ERROR = "ANALYSIS_INTERNAL_ERROR"
    # FO-102 — Gemini billing / quota / auth / rate diagnostics
    INVALID_API_KEY = "INVALID_API_KEY"
    BILLING_DISABLED = "BILLING_DISABLED"
    QUOTA_EXHAUSTED = "QUOTA_EXHAUSTED"
    RATE_LIMIT_RPM = "RATE_LIMIT_RPM"
    RATE_LIMIT_RPD = "RATE_LIMIT_RPD"
    MODEL_NOT_FOUND = "MODEL_NOT_FOUND"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    NETWORK_TIMEOUT = "NETWORK_TIMEOUT"
    UNKNOWN_PROVIDER_ERROR = "UNKNOWN_PROVIDER_ERROR"


RETRYABLE_ERROR_CODES = frozenset(
    {
        AIErrorCode.PROVIDER_TIMEOUT,
        AIErrorCode.PROVIDER_RATE_LIMITED,
        AIErrorCode.PROVIDER_UNAVAILABLE,
        AIErrorCode.RATE_LIMIT_RPM,
        AIErrorCode.RATE_LIMIT_RPD,
        AIErrorCode.QUOTA_EXHAUSTED,
        AIErrorCode.NETWORK_TIMEOUT,
        AIErrorCode.UNKNOWN_PROVIDER_ERROR,
    }
)

# User-facing (FM Guided Review / operators). Never generic "Analysis Failed".
SAFE_ERROR_MESSAGES = {
    AIErrorCode.PROVIDER_NOT_CONFIGURED: "AI image analysis is not configured.",
    AIErrorCode.NO_VALID_IMAGES: "No valid images were available for analysis.",
    AIErrorCode.UNSUPPORTED_IMAGE_TYPE: "One or more attachments are not supported images.",
    AIErrorCode.IMAGE_LIMIT_EXCEEDED: "Too many images were submitted for analysis.",
    AIErrorCode.INPUT_TOO_LARGE: "Image payload exceeds the configured analysis limit.",
    AIErrorCode.STORAGE_READ_FAILED: "Unable to read one or more ticket images.",
    AIErrorCode.PROVIDER_TIMEOUT: "The AI provider timed out.",
    AIErrorCode.PROVIDER_RATE_LIMITED: "The AI provider rate limit was reached.",
    AIErrorCode.PROVIDER_AUTH_FAILED: "The AI provider rejected authentication.",
    AIErrorCode.PROVIDER_UNAVAILABLE: "The AI provider is temporarily unavailable.",
    AIErrorCode.SAFETY_BLOCKED: "The AI provider blocked the analysis for safety reasons.",
    AIErrorCode.INVALID_PROVIDER_RESPONSE: "The AI provider returned an unusable response.",
    AIErrorCode.SCHEMA_VALIDATION_FAILED: "The AI provider response failed schema validation.",
    AIErrorCode.ANALYSIS_INTERNAL_ERROR: "Image analysis failed due to an internal error.",
    AIErrorCode.INVALID_API_KEY: "The AI provider rejected the API key.",
    AIErrorCode.BILLING_DISABLED: "AI provider billing appears disabled or unpaid.",
    AIErrorCode.QUOTA_EXHAUSTED: "AI provider quota or prepaid credits appear exhausted.",
    AIErrorCode.RATE_LIMIT_RPM: "AI provider requests-per-minute limit was exceeded.",
    AIErrorCode.RATE_LIMIT_RPD: "AI provider requests-per-day limit was exceeded.",
    AIErrorCode.MODEL_NOT_FOUND: "The configured AI model was not found or is unavailable.",
    AIErrorCode.PERMISSION_DENIED: "The AI provider denied access for this project or key.",
    AIErrorCode.NETWORK_TIMEOUT: "The AI provider request timed out on the network.",
    AIErrorCode.UNKNOWN_PROVIDER_ERROR: "The AI provider returned an unrecognized error.",
}

# Admin diagnostics — actionable, still no secrets/prompts/images.
ADMIN_DIAGNOSTIC_MESSAGES = {
    AIErrorCode.PROVIDER_NOT_CONFIGURED: (
        "Configure FACILITYOPS_AI_PROVIDER=gemini, enable Gemini, and set GEMINI_API_KEY."
    ),
    AIErrorCode.INVALID_API_KEY: (
        "GEMINI_API_KEY is missing, revoked, or invalid. Rotate the key in Google AI Studio / Cloud."
    ),
    AIErrorCode.BILLING_DISABLED: (
        "Google reports billing/payment issues. Enable Cloud Billing or add prepaid Gemini credits."
    ),
    AIErrorCode.QUOTA_EXHAUSTED: (
        "Quota or prepaid credits exhausted (often RESOURCE_EXHAUSTED). Check Gemini quotas and billing."
    ),
    AIErrorCode.RATE_LIMIT_RPM: (
        "Requests-per-minute exceeded. Reduce concurrency or wait; automatic retry will back off."
    ),
    AIErrorCode.RATE_LIMIT_RPD: (
        "Requests-per-day exceeded. Wait for daily reset or raise the project quota."
    ),
    AIErrorCode.PROVIDER_RATE_LIMITED: (
        "Coarse rate-limit signal. Inspect provider_diagnostics for billing vs RPM vs quota detail."
    ),
    AIErrorCode.PROVIDER_AUTH_FAILED: (
        "Authentication failed. Verify API key permissions and project access."
    ),
    AIErrorCode.PERMISSION_DENIED: (
        "Permission denied for this key/project/model. Confirm Gemini API enablement and IAM."
    ),
    AIErrorCode.MODEL_NOT_FOUND: (
        "Configured FACILITYOPS_GEMINI_MODEL is not available to this key/project."
    ),
    AIErrorCode.PROVIDER_TIMEOUT: (
        "Provider timed out. Check network and FACILITYOPS_GEMINI_TIMEOUT_SECONDS."
    ),
    AIErrorCode.NETWORK_TIMEOUT: (
        "Network timeout contacting Gemini. Check connectivity and proxy settings."
    ),
    AIErrorCode.PROVIDER_UNAVAILABLE: (
        "Gemini returned a transient unavailable/5xx response. Automatic retry applies when configured."
    ),
    AIErrorCode.UNKNOWN_PROVIDER_ERROR: (
        "Unrecognized provider error. Review sanitized provider_diagnostics on the analysis row."
    ),
    AIErrorCode.SAFETY_BLOCKED: "Gemini safety filters blocked the request.",
    AIErrorCode.INVALID_PROVIDER_RESPONSE: "Response was empty or not valid JSON for the schema.",
    AIErrorCode.SCHEMA_VALIDATION_FAILED: "Response JSON failed FacilityRecommendationV1 validation.",
    AIErrorCode.ANALYSIS_INTERNAL_ERROR: "Unexpected application error during analysis processing.",
    AIErrorCode.NO_VALID_IMAGES: "No usable images after validation/decode.",
    AIErrorCode.UNSUPPORTED_IMAGE_TYPE: "Attachment MIME type is not an allowed image type.",
    AIErrorCode.IMAGE_LIMIT_EXCEEDED: "Too many images vs FACILITYOPS_GEMINI_MAX_IMAGES.",
    AIErrorCode.INPUT_TOO_LARGE: "Image bytes exceed FACILITYOPS_GEMINI_MAX_TOTAL_BYTES.",
    AIErrorCode.STORAGE_READ_FAILED: "Attachment storage read failed.",
}


class AIAnalysisError(Exception):
    """Provider/processing error with a stable internal code."""

    def __init__(
        self,
        code: str,
        *,
        retryable: bool | None = None,
        detail: str = "",
        diagnostics: dict | None = None,
    ):
        self.code = code
        self.retryable = (
            retryable if retryable is not None else code in RETRYABLE_ERROR_CODES
        )
        self.detail = detail
        self.diagnostics = dict(diagnostics or {})
        message = SAFE_ERROR_MESSAGES.get(
            code, SAFE_ERROR_MESSAGES[AIErrorCode.ANALYSIS_INTERNAL_ERROR]
        )
        super().__init__(message)

    @property
    def safe_message(self) -> str:
        return str(self)

    @property
    def admin_message(self) -> str:
        return ADMIN_DIAGNOSTIC_MESSAGES.get(
            self.code,
            ADMIN_DIAGNOSTIC_MESSAGES[AIErrorCode.UNKNOWN_PROVIDER_ERROR],
        )


def safe_message_for_code(code: str) -> str:
    return SAFE_ERROR_MESSAGES.get(
        code,
        SAFE_ERROR_MESSAGES[AIErrorCode.ANALYSIS_INTERNAL_ERROR],
    )


def admin_message_for_code(code: str) -> str:
    return ADMIN_DIAGNOSTIC_MESSAGES.get(
        code,
        ADMIN_DIAGNOSTIC_MESSAGES.get(
            AIErrorCode.UNKNOWN_PROVIDER_ERROR,
            "Review provider diagnostics.",
        ),
    )
