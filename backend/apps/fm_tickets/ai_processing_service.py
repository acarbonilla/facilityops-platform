"""Background AI analysis processing (status transitions + provider call).

FO-102: delayed retries (1m/5m/15m/30m), diagnostic persistence, retry states.
"""

from __future__ import annotations

import logging
import uuid
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from pydantic import ValidationError as PydanticValidationError

from .ai import metrics
from .ai.errors import (
    AIAnalysisError,
    AIErrorCode,
    RETRYABLE_ERROR_CODES,
    admin_message_for_code,
    safe_message_for_code,
)
from .ai.gemini_diagnostics import retry_countdown_seconds
from .ai.schema_recommendation_v1 import validate_facility_recommendation
from .ai.schema_v1 import validate_facility_image_analysis
from .ai_provider import get_ai_provider
from .models import AITicketAnalysis

logger = logging.getLogger(__name__)


class RetryableAIProcessing(Exception):
    """Legacy signal — FO-102 schedules delayed Celery tasks instead of raising."""

    def __init__(self, analysis_id: str, code: str):
        self.analysis_id = analysis_id
        self.code = code
        super().__init__(code)


def process_ticket_ai_analysis(analysis_id: str, *, attempt: int = 1) -> dict:
    """Run configured provider and persist validated structured results.

    Idempotent for COMPLETED records. Schedules delayed Celery retries for
    transient FO-102 provider failures (does not raise RetryableAIProcessing).
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

    if analysis.status in AITicketAnalysis.TERMINAL_FAILURE_STATUSES:
        return {
            "ok": False,
            "status": analysis.status,
            "skipped": True,
            "reason": "terminal_failure",
        }

    correlation_id = analysis.correlation_id or uuid.uuid4().hex
    started_at = timezone.now()
    run_status = (
        AITicketAnalysis.Status.RETRYING
        if attempt > 1
        else AITicketAnalysis.Status.PROCESSING
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
        if locked.status in AITicketAnalysis.TERMINAL_FAILURE_STATUSES:
            return {
                "ok": False,
                "status": locked.status,
                "skipped": True,
                "reason": "terminal_failure",
            }
        locked.status = run_status
        if locked.started_at is None:
            locked.started_at = started_at
        locked.next_retry_at = None
        locked.error_message = ""
        locked.error_code = ""
        locked.retryable = False
        locked.attempt_count = max(locked.attempt_count or 0, attempt)
        locked.correlation_id = correlation_id
        locked.save(
            update_fields=[
                "status",
                "started_at",
                "next_retry_at",
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
        raw_provider_name = getattr(provider, "PROVIDER_NAME", "")
        provider_name = raw_provider_name if isinstance(raw_provider_name, str) else ""
        selected_model = ""
        try:
            from apps.fm_tickets.ai_administration_service import get_runtime_setting

            selected_model = str(
                get_runtime_setting("FACILITYOPS_GEMINI_MODEL", "") or ""
            )
        except Exception:
            selected_model = ""
        # Stamp selected provider/model before network I/O (FO-101B/FO-102).
        if provider_name or selected_model:
            AITicketAnalysis.objects.filter(pk=analysis.pk).update(
                provider=provider_name or analysis.provider,
                model_name=selected_model or analysis.model_name,
                updated_at=timezone.now(),
            )
            if provider_name:
                analysis.provider = provider_name
            if selected_model:
                analysis.model_name = selected_model

        result = provider.analyze(
            ticket=analysis.ticket,
            attachments=attachments,
            correlation_id=correlation_id,
        )
        result_payload = {
            key: value
            for key, value in (result.result_json or {}).items()
            if key != "meta" and not str(key).startswith("_")
        }
        if result_payload.get("schema_version"):
            try:
                if (
                    result_payload.get("schema_name") == "FacilityRecommendationV1"
                    or "findings" in result_payload
                ):
                    validated = validate_facility_recommendation(result_payload)
                else:
                    validated = validate_facility_image_analysis(result_payload)
                result_payload = validated.model_dump(mode="json")
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
            locked.next_retry_at = None
            locked.duration_ms = duration_ms
            locked.model_name = result.model_name
            locked.model_version = result.model_version
            locked.provider = result.provider
            locked.prompt_version = result.prompt_version
            locked.schema_version = result.schema_version
            locked.input_image_count = result.input_image_count
            locked.input_byte_count = result.input_byte_count
            locked.result_json = result_payload
            locked.error_message = ""
            locked.error_code = ""
            locked.admin_diagnostic_message = ""
            locked.provider_diagnostics = {}
            locked.retryable = False
            locked.save(
                update_fields=[
                    "status",
                    "completed_at",
                    "next_retry_at",
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
                    "admin_diagnostic_message",
                    "provider_diagnostics",
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
                "retry_count": max(0, attempt - 1),
                "duration_ms": duration_ms,
                "error_category": "",
                "overall_confidence": result_payload.get("overall_confidence"),
                "recommended_category": result_payload.get("recommended_category"),
                "recommended_priority": result_payload.get("recommended_priority"),
                "finding_count": len(result_payload.get("findings") or []),
                "success": True,
            },
        )
        try:
            from apps.fm_tickets.notification_service import notify_ai_analysis_ready

            locked.refresh_from_db()
            ticket = getattr(locked, "ticket", None)
            if ticket is None:
                from apps.fm_tickets.models import FmTicket

                ticket = FmTicket.objects.filter(pk=locked.ticket_id).first()
            if ticket is not None:
                notify_ai_analysis_ready(ticket=ticket, analysis=locked)
        except Exception:
            logger.exception(
                "ai.analysis_ready_notification_failed analysis_id=%s",
                analysis_id,
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
            diagnostics=getattr(exc, "diagnostics", None) or {},
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
            diagnostics={},
        )


def _fail_or_retry(
    *,
    analysis,
    started_at,
    attempt: int,
    code: str,
    retryable: bool,
    diagnostics: dict | None = None,
) -> dict:
    from apps.fm_tickets.ai_administration_service import get_runtime_setting

    max_attempts = max(1, int(get_runtime_setting("FACILITYOPS_AI_MAX_ATTEMPTS", 5)))
    should_retry = retryable and code in RETRYABLE_ERROR_CODES and attempt < max_attempts

    completed_at = timezone.now()
    duration_ms = max(
        0,
        int((completed_at - (analysis.started_at or started_at)).total_seconds() * 1000),
    )
    safe_message = safe_message_for_code(code)
    admin_message = admin_message_for_code(code)
    diagnostics_payload = dict(diagnostics or {})
    if not diagnostics_payload:
        diagnostics_payload = {
            "http_status": None,
            "provider_error_code": "",
            "provider_message": "",
            "retryable": bool(should_retry),
            "request_timestamp": completed_at.isoformat(),
            "model": analysis.model_name or "",
            "error_code": code,
            "admin_message": admin_message,
        }
    else:
        diagnostics_payload.setdefault("error_code", code)
        diagnostics_payload.setdefault("admin_message", admin_message)
        diagnostics_payload.setdefault("model", analysis.model_name or "")
        diagnostics_payload["retryable"] = bool(should_retry)

    countdown = retry_countdown_seconds(attempt) if should_retry else 0
    next_retry_at = (
        completed_at + timedelta(seconds=countdown) if should_retry else None
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

        locked.attempt_count = attempt
        locked.error_code = code
        locked.error_message = safe_message
        locked.admin_diagnostic_message = admin_message
        locked.provider_diagnostics = diagnostics_payload
        locked.retryable = should_retry
        locked.duration_ms = duration_ms

        if should_retry:
            locked.status = AITicketAnalysis.Status.WAITING_FOR_RETRY
            locked.completed_at = None
            locked.next_retry_at = next_retry_at
            locked.save(
                update_fields=[
                    "status",
                    "attempt_count",
                    "error_code",
                    "error_message",
                    "admin_diagnostic_message",
                    "provider_diagnostics",
                    "retryable",
                    "duration_ms",
                    "completed_at",
                    "next_retry_at",
                    "updated_at",
                ]
            )
        else:
            if retryable and code in RETRYABLE_ERROR_CODES:
                locked.status = AITicketAnalysis.Status.RETRY_FAILED
            else:
                locked.status = AITicketAnalysis.Status.PERMANENTLY_FAILED
            locked.completed_at = completed_at
            locked.next_retry_at = None
            locked.retryable = False
            locked.save(
                update_fields=[
                    "status",
                    "completed_at",
                    "next_retry_at",
                    "duration_ms",
                    "attempt_count",
                    "error_code",
                    "error_message",
                    "admin_diagnostic_message",
                    "provider_diagnostics",
                    "retryable",
                    "updated_at",
                ]
            )

    logger.info(
        "ai.analysis_failed",
        extra={
            "analysis_id": str(analysis.id),
            "ticket_id": str(analysis.ticket_id),
            "tenant_id": str(analysis.tenant_id),
            "provider": analysis.provider,
            "model": analysis.model_name,
            "attempt": attempt,
            "retry_count": max(0, attempt - 1),
            "duration_ms": duration_ms,
            "error_code": code,
            "error_category": code,
            "retry_scheduled": should_retry,
            "countdown_seconds": countdown if should_retry else 0,
        },
    )

    if should_retry:
        metrics.incr("analyses_retry")
        _schedule_delayed_retry(
            analysis_id=str(analysis.id),
            next_attempt=attempt + 1,
            countdown=countdown,
        )
        return {
            "ok": False,
            "status": AITicketAnalysis.Status.WAITING_FOR_RETRY,
            "analysis_id": str(analysis.id),
            "error_code": code,
            "error": safe_message,
            "retry_scheduled": True,
            "countdown_seconds": countdown,
            "next_attempt": attempt + 1,
        }

    if code == AIErrorCode.SAFETY_BLOCKED:
        metrics.incr("safety_blocks")
    metrics.incr("analyses_failed")
    try:
        from apps.fm_tickets.notification_service import notify_ai_analysis_failed

        failed = (
            AITicketAnalysis.objects.select_related("ticket")
            .filter(pk=analysis.pk)
            .first()
        )
        if failed is not None and failed.ticket_id:
            notify_ai_analysis_failed(ticket=failed.ticket, analysis=failed)
    except Exception:
        logger.exception(
            "ai.analysis_failed_notification_failed analysis_id=%s",
            analysis.id,
        )
    terminal = (
        AITicketAnalysis.Status.RETRY_FAILED
        if retryable and code in RETRYABLE_ERROR_CODES
        else AITicketAnalysis.Status.PERMANENTLY_FAILED
    )
    return {
        "ok": False,
        "status": terminal,
        "analysis_id": str(analysis.id),
        "error_code": code,
        "error": safe_message,
    }


def _schedule_delayed_retry(*, analysis_id: str, next_attempt: int, countdown: int) -> None:
    from .tasks import process_fm_ticket_ai_analysis

    async_result = process_fm_ticket_ai_analysis.apply_async(
        args=[analysis_id],
        kwargs={"attempt": next_attempt},
        countdown=max(0, int(countdown)),
    )
    task_id = getattr(async_result, "id", "") or ""
    AITicketAnalysis.objects.filter(pk=analysis_id).update(
        celery_task_id=task_id,
        updated_at=timezone.now(),
    )
    logger.info(
        "ai.analysis_retry_scheduled",
        extra={
            "analysis_id": analysis_id,
            "next_attempt": next_attempt,
            "countdown_seconds": countdown,
            "celery_task_id": task_id,
        },
    )
