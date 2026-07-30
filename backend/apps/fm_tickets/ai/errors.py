"""Normalized AI analysis error codes (FO-085)."""

from __future__ import annotations


class AIErrorCode:
    PROVIDER_NOT_CONFIGURED = "PROVIDER_NOT_CONFIGURED"
    NO_VALID_IMAGES = "NO_VALID_IMAGES"
    UNSUPPORTED_IMAGE_TYPE = "UNSUPPORTED_IMAGE_TYPE"
    IMAGE_LIMIT_EXCEEDED = "IMAGE_LIMIT_EXCEEDED"
    INPUT_TOO_LARGE = "INPUT_TOO_LARGE"
    STORAGE_READ_FAILED = "STORAGE_READ_FAILED"
    PROVIDER_TIMEOUT = "PROVIDER_TIMEOUT"
    PROVIDER_RATE_LIMITED = "PROVIDER_RATE_LIMITED"
    PROVIDER_AUTH_FAILED = "PROVIDER_AUTH_FAILED"
    PROVIDER_UNAVAILABLE = "PROVIDER_UNAVAILABLE"
    SAFETY_BLOCKED = "SAFETY_BLOCKED"
    INVALID_PROVIDER_RESPONSE = "INVALID_PROVIDER_RESPONSE"
    SCHEMA_VALIDATION_FAILED = "SCHEMA_VALIDATION_FAILED"
    ANALYSIS_INTERNAL_ERROR = "ANALYSIS_INTERNAL_ERROR"


RETRYABLE_ERROR_CODES = frozenset(
    {
        AIErrorCode.PROVIDER_TIMEOUT,
        AIErrorCode.PROVIDER_RATE_LIMITED,
        AIErrorCode.PROVIDER_UNAVAILABLE,
    }
)

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
}


class AIAnalysisError(Exception):
    """Provider/processing error with a stable internal code."""

    def __init__(
        self,
        code: str,
        *,
        retryable: bool | None = None,
        detail: str = "",
    ):
        self.code = code
        self.retryable = (
            retryable if retryable is not None else code in RETRYABLE_ERROR_CODES
        )
        self.detail = detail
        message = SAFE_ERROR_MESSAGES.get(code, SAFE_ERROR_MESSAGES[AIErrorCode.ANALYSIS_INTERNAL_ERROR])
        super().__init__(message)

    @property
    def safe_message(self) -> str:
        return str(self)


def safe_message_for_code(code: str) -> str:
    return SAFE_ERROR_MESSAGES.get(
        code,
        SAFE_ERROR_MESSAGES[AIErrorCode.ANALYSIS_INTERNAL_ERROR],
    )
