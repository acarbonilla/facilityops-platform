"""Automatic RESOLVED → CLOSED processing for FO-063.

Eligibility uses ``FmTicket.resolved_at`` as the authoritative resolution
timestamp. Closure reuses ``change_ticket_status`` with ``changed_by=None`` so
history shows system activity without impersonating a user.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import FmTicket
from .services import change_ticket_status

logger = logging.getLogger(__name__)

AUTO_CLOSE_NOTE = (
    "Automatically closed after the acknowledgement period expired."
)
AUTO_CLOSE_HISTORY_DESCRIPTION = (
    "Ticket automatically closed after the acknowledgement period expired."
)
AUTO_CLOSE_SOURCE = "automatic_closure"


def ticket_was_automatically_closed(ticket) -> bool:
    """Return True when the latest close transition was FO-063 automatic closure."""
    if ticket is None or ticket.status != FmTicket.Status.CLOSED:
        return False
    latest_close = (
        ticket.status_history_entries.filter(to_status=FmTicket.Status.CLOSED)
        .order_by("-changed_at", "-id")
        .first()
    )
    if latest_close is None:
        return False
    return latest_close.note == AUTO_CLOSE_NOTE


@dataclass(frozen=True)
class AutoCloseResult:
    ticket_id: str
    outcome: str
    reason: str = ""


def get_auto_close_days() -> int:
    """Return validated auto-close period in full calendar days (default 7)."""
    configured = getattr(settings, "FM_TICKET_AUTO_CLOSE_DAYS", 7)
    try:
        days = int(configured)
    except (TypeError, ValueError):
        return 7
    if days < 1:
        return 7
    return days


def get_auto_close_batch_size() -> int:
    configured = getattr(settings, "FM_TICKET_AUTO_CLOSE_BATCH_SIZE", 100)
    try:
        size = int(configured)
    except (TypeError, ValueError):
        return 100
    if size < 1:
        return 100
    return min(size, 500)


def get_auto_close_cutoff(*, now=None, days=None):
    """Tickets with ``resolved_at`` at or before this instant are eligible."""
    reference = now if now is not None else timezone.now()
    period = get_auto_close_days() if days is None else days
    return reference - timedelta(days=period)


def is_ticket_eligible_for_auto_close(ticket, *, now=None, days=None) -> bool:
    if ticket is None:
        return False
    if getattr(ticket, "is_deleted", False):
        return False
    if ticket.status != FmTicket.Status.RESOLVED:
        return False
    if ticket.resolved_at is None:
        return False

    tenant = getattr(ticket, "tenant", None)
    if tenant is None:
        return False
    if not getattr(tenant, "is_active", False):
        return False
    if getattr(tenant, "is_deleted", False):
        return False

    cutoff = get_auto_close_cutoff(now=now, days=days)
    return ticket.resolved_at <= cutoff


def eligible_auto_close_queryset(*, now=None, days=None, limit=None):
    cutoff = get_auto_close_cutoff(now=now, days=days)
    queryset = (
        FmTicket.objects.filter(
            status=FmTicket.Status.RESOLVED,
            is_deleted=False,
            resolved_at__isnull=False,
            resolved_at__lte=cutoff,
            tenant__isnull=False,
            tenant__is_active=True,
            tenant__is_deleted=False,
        )
        .select_related("tenant", "requester", "assignee")
        .order_by("resolved_at", "id")
    )
    if limit is not None:
        return queryset[:limit]
    return queryset


@transaction.atomic
def auto_close_resolved_ticket(*, ticket_id, now=None, days=None) -> AutoCloseResult:
    """Lock, revalidate, and close one ticket. Safe under concurrent workers."""
    try:
        # Do not select_related nullable FKs under select_for_update — PostgreSQL
        # rejects FOR UPDATE on the nullable side of an outer join.
        ticket = FmTicket.objects.select_for_update().get(pk=ticket_id)
    except FmTicket.DoesNotExist:
        return AutoCloseResult(
            ticket_id=str(ticket_id),
            outcome="skipped",
            reason="not_found",
        )

    if not is_ticket_eligible_for_auto_close(ticket, now=now, days=days):
        if ticket.is_deleted:
            reason = "soft_deleted"
        elif ticket.status == FmTicket.Status.CLOSED:
            reason = "already_closed"
        elif ticket.status != FmTicket.Status.RESOLVED:
            reason = f"status_{ticket.status}"
        elif ticket.resolved_at is None:
            reason = "missing_resolved_at"
        else:
            tenant = getattr(ticket, "tenant", None)
            if tenant is None or not tenant.is_active or getattr(
                tenant, "is_deleted", False
            ):
                reason = "invalid_tenant"
            else:
                reason = "deadline_not_reached"
        return AutoCloseResult(
            ticket_id=str(ticket.id),
            outcome="skipped",
            reason=reason,
        )

    change_ticket_status(
        ticket=ticket,
        to_status=FmTicket.Status.CLOSED,
        changed_by=None,
        note=AUTO_CLOSE_NOTE,
        history_description=AUTO_CLOSE_HISTORY_DESCRIPTION,
        history_metadata={
            "source": AUTO_CLOSE_SOURCE,
            "auto_close_days": get_auto_close_days() if days is None else days,
            "resolved_at": ticket.resolved_at.isoformat(),
        },
        notification_context=AUTO_CLOSE_SOURCE,
    )
    return AutoCloseResult(
        ticket_id=str(ticket.id),
        outcome="closed",
        reason="",
    )


def process_automatic_ticket_closures(*, now=None, days=None, batch_size=None) -> dict:
    """Process a bounded batch of eligible resolved tickets."""
    limit = get_auto_close_batch_size() if batch_size is None else batch_size
    if limit < 1:
        limit = get_auto_close_batch_size()

    candidates = list(
        eligible_auto_close_queryset(now=now, days=days, limit=limit).values_list(
            "id",
            flat=True,
        )
    )

    counts = {
        "examined": len(candidates),
        "closed": 0,
        "skipped": 0,
        "failed": 0,
        "auto_close_days": get_auto_close_days() if days is None else days,
        "batch_size": limit,
    }
    skip_reasons: dict[str, int] = {}

    for ticket_id in candidates:
        try:
            result = auto_close_resolved_ticket(
                ticket_id=ticket_id,
                now=now,
                days=days,
            )
        except Exception:
            counts["failed"] += 1
            logger.exception(
                "fm_tickets.auto_close failed ticket_id=%s",
                ticket_id,
            )
            continue

        if result.outcome == "closed":
            counts["closed"] += 1
            logger.info(
                "fm_tickets.auto_close closed ticket_id=%s",
                result.ticket_id,
            )
        else:
            counts["skipped"] += 1
            skip_reasons[result.reason] = skip_reasons.get(result.reason, 0) + 1
            logger.info(
                "fm_tickets.auto_close skipped ticket_id=%s reason=%s",
                result.ticket_id,
                result.reason,
            )

    counts["skip_reasons"] = skip_reasons
    logger.info("fm_tickets.auto_close batch_complete %s", counts)
    return counts
