"""Background AI analysis processing (status transitions + provider call)."""

from __future__ import annotations

import logging
import uuid

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from pydantic import ValidationError as PydanticValidationError

from .ai import metrics
from .ai.errors import (
    AIAnalysisError,
    AIErrorCode,
    RETRYABLE_ERROR_CODES,
    safe_message_for_code,
)
from .ai.schema_v1 import validate_facility_image_analysis
from .ai_provider import get_ai_provider
from .models import AITicketAnalysis

logger = logging.getLogger(__name__)


class RetryableAIProcessing(Exception):
    """Signal Celery to retry a transient provider failure."""

    def __init__(self, analysis_id: str, code: str):
        self.analysis_id = analysis_id
        self.code = code
        super().__init__(code)


def process_ticket_ai_analysis(analysis_id: str, *, attempt: int = 1) -> dict:
    """Run configured provider and persist validated structured results.

    Idempotent for COMPLETED records. Raises RetryableAIProcessing for transient
    failures so the Celery task can apply bounded backoff.
    """
    analysis = (
        AITicketAnalysis.objects.select_related(
            "ticket",
            "ticket__building",
            "ticket__floor",
            "ticket__area",
            "tenant",
        )
        .prefetch_related("analysis_attachments__attachment")
        .filter(pk=analysis_id, is_deleted=False)
        .first()
    )
    if analysis is None:
        logger.warning("AI analysis %s not found", analysis_id)
        return {"ok": False, "reason": "not_found"}

    if analysis.status == AITicketAnalysis.Status.COMPLETED:
        return {"ok": True, "status": analysis.status, "skipped": True}

    correlation_id = analysis.correlation_id or uuid.uuid4().hex
    started_at = timezone.now()
    with transaction.atomic():
        locked = (
            AITicketAnalysis.objects.select_for_update()
            .filter(pk=analysis.pk, is_deleted=False)
            .first()
        )
        if locked is None:
            return {"ok": False, "reason": "not_found"}
        if locked.status == AITicketAnalysis.Status.COMPLETED:
            return {"ok": True, "status": locked.status, "skipped": True}
        locked.status = AITicketAnalysis.Status.PROCESSING
        if locked.started_at is None:
            locked.started_at = started_at
        locked.error_message = ""
        locked.error_code = ""
        locked.retryable = False
        locked.attempt_count = max(locked.attempt_count or 0, attempt)
        locked.correlation_id = correlation_id
        locked.save(
            update_fields=[
                "status",
                "started_at",
                "error_message",
                "error_code",
                "retryable",
                "attempt_count",
                "correlation_id",
                "updated_at",
            ]
        )
        analysis = locked

    metrics.incr("analyses_processing")
    attachments = [
        link.attachment
        for link in analysis.analysis_attachments.all()
        if link.attachment
        and not link.attachment.is_deleted
        and link.attachment.tenant_id == analysis.tenant_id
        and str(link.attachment.owner_id) == str(analysis.ticket_id)
    ]

    try:
        provider = get_ai_provider()
        result = provider.analyze(
            ticket=analysis.ticket,
            attachments=attachments,
            correlation_id=correlation_id,
        )
        # Independently validate structured payload before persistence.
        if result.result_json.get("schema_version"):
            try:
                validate_facility_image_analysis(
                    {
                        key: value
                        for key, value in result.result_json.items()
                        if key != "meta" and not str(key).startswith("_")
                    }
                )
            except PydanticValidationError as exc:
                metrics.incr("schema_validation_failures")
                raise AIAnalysisError(AIErrorCode.SCHEMA_VALIDATION_FAILED) from exc

        completed_at = timezone.now()
        duration_ms = max(
            0,
            int((completed_at - (analysis.started_at or started_at)).total_seconds() * 1000),
        )
        with transaction.atomic():
            locked = (
                AITicketAnalysis.objects.select_for_update()
                .filter(pk=analysis.pk, is_deleted=False)
                .first()
            )
            if locked is None:
                return {"ok": False, "reason": "not_found"}
            if locked.status == AITicketAnalysis.Status.COMPLETED:
                return {"ok": True, "status": locked.status, "skipped": True}
            locked.status = AITicketAnalysis.Status.COMPLETED
            locked.completed_at = completed_at
            locked.duration_ms = duration_ms
            locked.model_name = result.model_name
            locked.model_version = result.model_version
            locked.provider = result.provider
            locked.prompt_version = result.prompt_version
            locked.schema_version = result.schema_version
            locked.input_image_count = result.input_image_count
            locked.input_byte_count = result.input_byte_count
            locked.result_json = result.result_json
            locked.error_message = ""
            locked.error_code = ""
            locked.retryable = False
            locked.save(
                update_fields=[
                    "status",
                    "completed_at",
                    "duration_ms",
                    "model_name",
                    "model_version",
                    "provider",
                    "prompt_version",
                    "schema_version",
                    "input_image_count",
                    "input_byte_count",
                    "result_json",
                    "error_message",
                    "error_code",
                    "retryable",
                    "updated_at",
                ]
            )
        metrics.incr("analyses_completed")
        logger.info(
            "ai.analysis_completed",
            extra={
                "analysis_id": str(analysis.id),
                "ticket_id": str(analysis.ticket_id),
                "tenant_id": str(analysis.tenant_id),
                "provider": result.provider,
                "model": result.model_name,
                "attempt": attempt,
                "duration_ms": duration_ms,
            },
        )
        return {
            "ok": True,
            "status": AITicketAnalysis.Status.COMPLETED,
            "analysis_id": str(analysis.id),
            "duration_ms": duration_ms,
        }
    except RetryableAIProcessing:
        raise
    except AIAnalysisError as exc:
        return _fail_or_retry(
            analysis=analysis,
            started_at=started_at,
            attempt=attempt,
            code=exc.code,
            retryable=exc.retryable,
        )
    except Exception:
        logger.exception(
            "ai.analysis_internal_error analysis_id=%s",
            analysis_id,
        )
        return _fail_or_retry(
            analysis=analysis,
            started_at=started_at,
            attempt=attempt,
            code=AIErrorCode.ANALYSIS_INTERNAL_ERROR,
            retryable=False,
        )


def _fail_or_retry(*, analysis, started_at, attempt: int, code: str, retryable: bool) -> dict:
    max_attempts = max(1, int(getattr(settings, "FACILITYOPS_AI_MAX_ATTEMPTS", 3)))
    should_retry = retryable and code in RETRYABLE_ERROR_CODES and attempt < max_attempts

    completed_at = timezone.now()
    duration_ms = max(
        0,
        int((completed_at - (analysis.started_at or started_at)).total_seconds() * 1000),
    )
    safe_message = safe_message_for_code(code)

    with transaction.atomic():
        locked = (
            AITicketAnalysis.objects.select_for_update()
            .filter(pk=analysis.pk, is_deleted=False)
            .first()
        )
        if locked is None:
            return {"ok": False, "reason": "not_found"}
        if locked.status == AITicketAnalysis.Status.COMPLETED:
            return {"ok": True, "status": locked.status, "skipped": True}

        locked.attempt_count = attempt
        locked.error_code = code
        locked.error_message = safe_message
        locked.retryable = should_retry
        locked.duration_ms = duration_ms

        if should_retry:
            # Leave PROCESSING so a timeout/crash does not look COMPLETED; Celery retries.
            locked.status = AITicketAnalysis.Status.PROCESSING
            locked.completed_at = None
            locked.save(
                update_fields=[
                    "status",
                    "attempt_count",
                    "error_code",
                    "error_message",
                    "retryable",
                    "duration_ms",
                    "completed_at",
                    "updated_at",
                ]
            )
        else:
            locked.status = AITicketAnalysis.Status.FAILED
            locked.completed_at = completed_at
            locked.save(
                update_fields=[
                    "status",
                    "completed_at",
                    "duration_ms",
                    "attempt_count",
                    "error_code",
                    "error_message",
                    "retryable",
                    "updated_at",
                ]
            )

    if should_retry:
        metrics.incr("analyses_retry")
        raise RetryableAIProcessing(str(analysis.id), code)

    if code == AIErrorCode.SAFETY_BLOCKED:
        metrics.incr("safety_blocks")
    metrics.incr("analyses_failed")
    logger.info(
        "ai.analysis_failed",
        extra={
            "analysis_id": str(analysis.id),
            "ticket_id": str(analysis.ticket_id),
            "tenant_id": str(analysis.tenant_id),
            "attempt": attempt,
            "error_code": code,
        },
    )
    return {
        "ok": False,
        "status": AITicketAnalysis.Status.FAILED,
        "analysis_id": str(analysis.id),
        "error_code": code,
        "error": safe_message,
    }
