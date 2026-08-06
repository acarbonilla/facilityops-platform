"""AI queue service: create analysis records and enqueue Celery workers.

Architecture (FO-084):
  Ticket Created → Attachment Service → AI Queue Service → Celery Worker
  → AI Provider Adapter → Result Persistence
"""

from __future__ import annotations

import logging
import uuid

from django.db import transaction
from django.http import Http404
from django.utils import timezone

from apps.attachments.models import Attachment
from apps.attachments.ownership import AttachmentOwnerType

from .models import AITicketAnalysis, AITicketAnalysisAttachment, FmTicket
from .tenant_scope import scope_fm_ticket_queryset

logger = logging.getLogger(__name__)


class AITicketAnalysisError(Exception):
    """Base error for AI analysis queue/processing."""


class AITicketAnalysisValidationError(AITicketAnalysisError):
    """Invalid input for queueing an analysis job."""


def _scoped_ticket_or_404(*, actor, ticket_id) -> FmTicket:
    ticket = (
        scope_fm_ticket_queryset(FmTicket.objects.filter(is_deleted=False), actor)
        .filter(pk=ticket_id)
        .first()
    )
    if ticket is None:
        raise Http404
    return ticket


def _load_authorized_attachments(*, ticket: FmTicket, attachment_ids: list) -> list[Attachment]:
    if not attachment_ids:
        raise AITicketAnalysisValidationError(
            "At least one attachment id is required for AI image analysis."
        )

    normalized_ids: list[uuid.UUID] = []
    seen: set[uuid.UUID] = set()
    for raw_id in attachment_ids:
        try:
            attachment_uuid = uuid.UUID(str(raw_id))
        except (TypeError, ValueError) as exc:
            raise AITicketAnalysisValidationError("Invalid attachment id.") from exc
        if attachment_uuid in seen:
            continue
        seen.add(attachment_uuid)
        normalized_ids.append(attachment_uuid)

    attachments = list(
        Attachment.objects.filter(
            id__in=normalized_ids,
            is_deleted=False,
            status=Attachment.Status.ACTIVE,
            owner_type=AttachmentOwnerType.FM_TICKET,
            owner_id=ticket.id,
            tenant_id=ticket.tenant_id,
        )
    )
    if len(attachments) != len(normalized_ids):
        raise AITicketAnalysisValidationError(
            "One or more attachments are not authorized for this ticket."
        )

    # Preserve caller order where possible.
    by_id = {attachment.id: attachment for attachment in attachments}
    return [by_id[attachment_id] for attachment_id in normalized_ids]


@transaction.atomic
def queue_ticket_image_analysis(
    *,
    actor,
    ticket_id,
    attachment_ids: list,
) -> AITicketAnalysis:
    """Create a queued AITicketAnalysis and dispatch background processing.

    FO-097: If the ticket already has an active (queued/processing) analysis,
    return that analysis instead of creating a duplicate queue entry.
    """
    ticket = _scoped_ticket_or_404(actor=actor, ticket_id=ticket_id)
    attachments = _load_authorized_attachments(
        ticket=ticket,
        attachment_ids=attachment_ids,
    )

    active = (
        AITicketAnalysis.objects.filter(
            ticket=ticket,
            is_deleted=False,
            status__in=AITicketAnalysis.ACTIVE_STATUSES,
        )
        .order_by("-queued_at", "-created_at")
        .first()
    )
    if active is not None:
        logger.info(
            "Reusing active FM ticket AI analysis",
            extra={
                "ticket_id": str(ticket.id),
                "analysis_id": str(active.id),
                "status": active.status,
            },
        )
        return active

    actor_id = str(actor.id) if actor is not None else None
    analysis = AITicketAnalysis.objects.create(
        tenant=ticket.tenant,
        ticket=ticket,
        status=AITicketAnalysis.Status.QUEUED,
        queued_at=timezone.now(),
        requested_by=actor,
        created_by=actor_id,
        updated_by=actor_id,
        model_name="placeholder",
        model_version="v0",
        result_json={},
    )
    AITicketAnalysisAttachment.objects.bulk_create(
        [
            AITicketAnalysisAttachment(
                analysis=analysis,
                attachment=attachment,
                created_by=actor_id,
                updated_by=actor_id,
            )
            for attachment in attachments
        ]
    )

    # Import lazily so module import stays light for migrations/tests.
    from .tasks import process_fm_ticket_ai_analysis

    async_result = process_fm_ticket_ai_analysis.delay(str(analysis.id))
    analysis.celery_task_id = getattr(async_result, "id", "") or ""
    analysis.save(update_fields=["celery_task_id", "updated_at", "updated_by"])

    logger.info(
        "Queued FM ticket AI analysis",
        extra={
            "analysis_id": str(analysis.id),
            "ticket_id": str(ticket.id),
            "attachment_count": len(attachments),
            "celery_task_id": analysis.celery_task_id,
        },
    )
    return analysis


def get_ticket_ai_analysis(*, actor, ticket_id, analysis_id) -> AITicketAnalysis:
    ticket = _scoped_ticket_or_404(actor=actor, ticket_id=ticket_id)
    analysis = (
        AITicketAnalysis.objects.filter(
            pk=analysis_id,
            ticket=ticket,
            tenant_id=ticket.tenant_id,
            is_deleted=False,
        )
        .prefetch_related("analysis_attachments")
        .first()
    )
    if analysis is None:
        raise Http404
    return analysis


def list_ticket_ai_analyses(*, actor, ticket_id):
    ticket = _scoped_ticket_or_404(actor=actor, ticket_id=ticket_id)
    return (
        AITicketAnalysis.objects.filter(
            ticket=ticket,
            tenant_id=ticket.tenant_id,
            is_deleted=False,
        )
        .prefetch_related("analysis_attachments")
        .order_by("-queued_at", "-created_at")
    )


@transaction.atomic
def retry_ticket_ai_analysis(*, actor, ticket_id, analysis_id) -> AITicketAnalysis:
    """FO-102: manually re-enqueue a failed analysis without creating a duplicate row.

    Preserves the same AITicketAnalysis id/audit trail. Refuses when another
    analysis for the ticket is already active, or when this analysis is active.
    """
    ticket = _scoped_ticket_or_404(actor=actor, ticket_id=ticket_id)
    analysis = (
        AITicketAnalysis.objects.select_for_update()
        .filter(
            pk=analysis_id,
            ticket=ticket,
            tenant_id=ticket.tenant_id,
            is_deleted=False,
        )
        .first()
    )
    if analysis is None:
        raise Http404

    if analysis.status in AITicketAnalysis.ACTIVE_STATUSES:
        logger.info(
            "AI analysis retry skipped — already active",
            extra={
                "analysis_id": str(analysis.id),
                "status": analysis.status,
            },
        )
        return analysis

    if analysis.status == AITicketAnalysis.Status.COMPLETED:
        raise AITicketAnalysisValidationError(
            "Completed analyses cannot be retried; queue a new analysis instead."
        )

    if analysis.status not in AITicketAnalysis.TERMINAL_FAILURE_STATUSES:
        raise AITicketAnalysisValidationError(
            "Only failed analyses can be manually retried."
        )

    other_active = (
        AITicketAnalysis.objects.filter(
            ticket=ticket,
            is_deleted=False,
            status__in=AITicketAnalysis.ACTIVE_STATUSES,
        )
        .exclude(pk=analysis.pk)
        .exists()
    )
    if other_active:
        raise AITicketAnalysisValidationError(
            "Another AI analysis is already queued or running for this ticket."
        )

    actor_id = str(actor.id) if actor is not None else None
    prior_attempt = analysis.attempt_count or 0
    analysis.status = AITicketAnalysis.Status.QUEUED
    analysis.queued_at = timezone.now()
    analysis.started_at = None
    analysis.completed_at = None
    analysis.next_retry_at = None
    analysis.error_message = ""
    analysis.error_code = ""
    analysis.admin_diagnostic_message = ""
    diagnostics = dict(analysis.provider_diagnostics or {})
    diagnostics["manual_retry_requested_at"] = timezone.now().isoformat()
    diagnostics["manual_retry_by"] = actor_id or ""
    diagnostics["prior_attempt_count"] = prior_attempt
    analysis.provider_diagnostics = diagnostics
    analysis.retryable = False
    analysis.updated_by = actor_id
    analysis.save(
        update_fields=[
            "status",
            "queued_at",
            "started_at",
            "completed_at",
            "next_retry_at",
            "error_message",
            "error_code",
            "admin_diagnostic_message",
            "provider_diagnostics",
            "retryable",
            "updated_at",
            "updated_by",
        ]
    )

    from .tasks import process_fm_ticket_ai_analysis

    async_result = process_fm_ticket_ai_analysis.delay(
        str(analysis.id),
        attempt=1,
    )
    analysis.celery_task_id = getattr(async_result, "id", "") or ""
    analysis.save(update_fields=["celery_task_id", "updated_at", "updated_by"])

    logger.info(
        "Manually retried FM ticket AI analysis",
        extra={
            "analysis_id": str(analysis.id),
            "ticket_id": str(ticket.id),
            "celery_task_id": analysis.celery_task_id,
            "prior_attempt_count": prior_attempt,
        },
    )
    return analysis
