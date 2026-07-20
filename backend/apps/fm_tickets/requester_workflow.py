"""Employee requester-owned workflow actions for FO-077.

Uses the existing change_ticket_status service for atomic status, history, and
notification handling. Dedicated endpoints enforce requester ownership without
granting operational close/update permissions to Employee.
"""

from django.core.exceptions import ValidationError
from django.db import transaction

from apps.maintenance.models import MaintenanceWorkOrder

from .models import FmTicket
from .services import change_ticket_status
from .tenant_scope import (
    is_eligible_employee_requester,
    uses_employee_requester_scope,
)


# Pre-execution statuses already supported for cancellation in the operational
# frontend transition map, excluding in_progress (active ticket execution).
REQUESTER_CANCELLABLE_STATUSES = frozenset(
    {
        FmTicket.Status.DRAFT,
        FmTicket.Status.OPEN,
        FmTicket.Status.ASSIGNED,
        FmTicket.Status.ON_HOLD,
    }
)

ACTIVE_MAINTENANCE_STATUSES = frozenset(
    {
        MaintenanceWorkOrder.Status.DRAFT,
        MaintenanceWorkOrder.Status.OPEN,
        MaintenanceWorkOrder.Status.ASSIGNED,
        MaintenanceWorkOrder.Status.IN_PROGRESS,
        MaintenanceWorkOrder.Status.ON_HOLD,
        MaintenanceWorkOrder.Status.REOPENED,
    }
)


def is_employee_requester_actor(user):
    """Return True when the caller must use requester-owned workflow endpoints."""
    return uses_employee_requester_scope(user) and is_eligible_employee_requester(user)


def _ticket_has_active_maintenance_execution(ticket):
    try:
        work_order = ticket.maintenance_work_order
    except MaintenanceWorkOrder.DoesNotExist:
        return False
    if work_order is None or getattr(work_order, "is_deleted", False):
        return False
    return work_order.status in ACTIVE_MAINTENANCE_STATUSES


def can_requester_cancel(ticket, user):
    if not is_employee_requester_actor(user):
        return False
    if ticket.requester_id != user.id:
        return False
    if ticket.is_deleted:
        return False
    if ticket.status not in REQUESTER_CANCELLABLE_STATUSES:
        return False
    if _ticket_has_active_maintenance_execution(ticket):
        return False
    return True


def can_requester_acknowledge(ticket, user):
    if not is_employee_requester_actor(user):
        return False
    if ticket.requester_id != user.id:
        return False
    if ticket.is_deleted:
        return False
    return ticket.status == FmTicket.Status.RESOLVED


def can_requester_reopen(ticket, user):
    if not is_employee_requester_actor(user):
        return False
    if ticket.requester_id != user.id:
        return False
    if ticket.is_deleted:
        return False
    return ticket.status == FmTicket.Status.RESOLVED


def get_requester_available_actions(ticket, user):
    return {
        "can_cancel": can_requester_cancel(ticket, user),
        "can_acknowledge": can_requester_acknowledge(ticket, user),
        "can_reopen": can_requester_reopen(ticket, user),
    }


def _require_reason(reason, field_name="reason"):
    normalized = (reason or "").strip()
    if not normalized:
        raise ValidationError({field_name: ["This field is required."]})
    return normalized


@transaction.atomic
def requester_cancel_ticket(*, ticket, actor, reason):
    if not can_requester_cancel(ticket, actor):
        raise ValidationError(
            {
                "status": [
                    "This request cannot be cancelled in its current state."
                ]
            }
        )

    note = _require_reason(reason)
    if ticket.status == FmTicket.Status.CANCELLED:
        return ticket

    return change_ticket_status(
        ticket=ticket,
        to_status=FmTicket.Status.CANCELLED,
        changed_by=actor,
        note=note,
    )


@transaction.atomic
def requester_acknowledge_ticket(*, ticket, actor):
    if not can_requester_acknowledge(ticket, actor):
        raise ValidationError(
            {
                "status": [
                    "Only resolved requests can be acknowledged and closed."
                ]
            }
        )

    if ticket.status == FmTicket.Status.CLOSED:
        return ticket

    return change_ticket_status(
        ticket=ticket,
        to_status=FmTicket.Status.CLOSED,
        changed_by=actor,
        note="Requester acknowledged resolution.",
    )


@transaction.atomic
def requester_reopen_ticket(*, ticket, actor, reason):
    if not can_requester_reopen(ticket, actor):
        raise ValidationError(
            {
                "status": [
                    "Only resolved requests can be reopened."
                ]
            }
        )

    note = _require_reason(reason)
    return change_ticket_status(
        ticket=ticket,
        to_status=FmTicket.Status.IN_PROGRESS,
        changed_by=actor,
        note=note,
    )
