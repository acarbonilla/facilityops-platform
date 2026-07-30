"""Background AI analysis processing (status transitions + provider call)."""

from __future__ import annotations

import logging

from django.db import transaction
from django.utils import timezone

from .ai_provider import get_ai_provider
from .models import AITicketAnalysis

logger = logging.getLogger(__name__)


def process_ticket_ai_analysis(analysis_id: str) -> dict:
    """Run placeholder (or configured) provider and persist result.

    Never raises to Celery for expected processing failures — marks Failed.
    """
    analysis = (
        AITicketAnalysis.objects.select_related("ticket", "tenant")
        .prefetch_related("analysis_attachments__attachment")
        .filter(pk=analysis_id, is_deleted=False)
        .first()
    )
    if analysis is None:
        logger.warning("AI analysis %s not found", analysis_id)
        return {"ok": False, "reason": "not_found"}

    if analysis.status == AITicketAnalysis.Status.COMPLETED:
        return {"ok": True, "status": analysis.status, "skipped": True}

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
        locked.started_at = started_at
        locked.error_message = ""
        locked.save(
            update_fields=["status", "started_at", "error_message", "updated_at"]
        )
        analysis = locked

    attachments = [
        link.attachment
        for link in analysis.analysis_attachments.all()
        if not link.attachment.is_deleted
    ]

    try:
        provider = get_ai_provider()
        result = provider.analyze(ticket=analysis.ticket, attachments=attachments)
        completed_at = timezone.now()
        duration_ms = max(
            0,
            int((completed_at - (analysis.started_at or started_at)).total_seconds() * 1000),
        )
        analysis.status = AITicketAnalysis.Status.COMPLETED
        analysis.completed_at = completed_at
        analysis.duration_ms = duration_ms
        analysis.model_name = result.model_name
        analysis.model_version = result.model_version
        analysis.result_json = result.result_json
        analysis.error_message = ""
        analysis.save(
            update_fields=[
                "status",
                "completed_at",
                "duration_ms",
                "model_name",
                "model_version",
                "result_json",
                "error_message",
                "updated_at",
            ]
        )
        return {
            "ok": True,
            "status": analysis.status,
            "analysis_id": str(analysis.id),
            "duration_ms": duration_ms,
        }
    except Exception as exc:  # noqa: BLE001 — worker must record failure
        logger.exception("FM ticket AI analysis failed for %s", analysis_id)
        completed_at = timezone.now()
        duration_ms = max(
            0,
            int((completed_at - (analysis.started_at or started_at)).total_seconds() * 1000),
        )
        analysis.status = AITicketAnalysis.Status.FAILED
        analysis.completed_at = completed_at
        analysis.duration_ms = duration_ms
        analysis.error_message = str(exc)[:2000]
        analysis.save(
            update_fields=[
                "status",
                "completed_at",
                "duration_ms",
                "error_message",
                "updated_at",
            ]
        )
        return {
            "ok": False,
            "status": analysis.status,
            "analysis_id": str(analysis.id),
            "error": analysis.error_message,
        }
