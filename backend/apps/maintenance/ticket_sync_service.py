from django.core.exceptions import ValidationError

from apps.fm_tickets.models import FmTicket
from apps.fm_tickets.services import change_ticket_status, record_ticket_history

from .models import MaintenanceWorkOrder

# Work Order statuses that map to a Ticket status change.
MAPPED_WORK_ORDER_STATUSES = {
    MaintenanceWorkOrder.Status.ASSIGNED: FmTicket.Status.ASSIGNED,
    MaintenanceWorkOrder.Status.IN_PROGRESS: FmTicket.Status.IN_PROGRESS,
    MaintenanceWorkOrder.Status.ON_HOLD: FmTicket.Status.ON_HOLD,
    MaintenanceWorkOrder.Status.REOPENED: FmTicket.Status.IN_PROGRESS,
    MaintenanceWorkOrder.Status.COMPLETED: FmTicket.Status.RESOLVED,
}

TERMINAL_TICKET_STATUSES = {
    FmTicket.Status.CLOSED,
    FmTicket.Status.CANCELLED,
}


def resolve_mapped_ticket_status(*, work_order_status):
    """Return the Ticket status for a Work Order status, or None when unmapped."""
    return MAPPED_WORK_ORDER_STATUSES.get(work_order_status)


def _sync_metadata(
    *,
    work_order,
    previous_work_order_status,
    maintenance_action,
    target_ticket_status=None,
):
    return {
        "event": "work_order_status_synchronized",
        "work_order_id": str(work_order.id),
        "work_order_number": work_order.work_order_number,
        "from_work_order_status": previous_work_order_status,
        "to_work_order_status": work_order.status,
        "target_ticket_status": target_ticket_status,
        "maintenance_action": maintenance_action,
    }


def synchronize_source_ticket_status(
    *,
    work_order,
    previous_work_order_status,
    actor,
    maintenance_action,
):
    """
    One-way sync: Maintenance Work Order status → linked FM Ticket status.

    Standalone Work Orders (no source_ticket) are skipped.
    Cancellation records Ticket history without changing Ticket status.
    """
    if not work_order.source_ticket_id:
        return None

    # Always re-fetch to avoid stale FK caches on the Work Order instance.
    ticket = FmTicket.objects.select_for_update().get(pk=work_order.source_ticket_id)

    if ticket.is_deleted:
        raise ValidationError(
            {
                "source_ticket": [
                    "Cannot synchronize status because the linked FM ticket is deleted."
                ]
            }
        )

    if ticket.tenant_id != work_order.tenant_id:
        raise ValidationError(
            {
                "source_ticket": [
                    "Cannot synchronize status because the work order and linked "
                    "FM ticket belong to different tenants."
                ]
            }
        )

    if work_order.status == MaintenanceWorkOrder.Status.CANCELLED:
        record_ticket_history(
            ticket=ticket,
            action="linked_work_order_cancelled",
            description=(
                f"Linked maintenance work order {work_order.work_order_number} "
                "was cancelled. Ticket status was not changed automatically."
            ),
            actor=actor,
            metadata={
                "work_order_id": str(work_order.id),
                "work_order_number": work_order.work_order_number,
                "previous_work_order_status": previous_work_order_status,
                "new_work_order_status": work_order.status,
                "maintenance_action": maintenance_action,
            },
        )
        return None

    target_status = resolve_mapped_ticket_status(work_order_status=work_order.status)
    if target_status is None:
        return None

    if ticket.status in TERMINAL_TICKET_STATUSES and ticket.status != target_status:
        raise ValidationError(
            {
                "source_ticket": [
                    "Cannot synchronize status from the linked work order because "
                    f"the FM ticket is already {ticket.status}."
                ]
            }
        )

    if ticket.status == target_status:
        return None

    change_ticket_status(
        ticket=ticket,
        to_status=target_status,
        changed_by=actor,
        note=(
            f"Synchronized from linked work order {work_order.work_order_number} "
            f"({maintenance_action})."
        ),
    )
    ticket.refresh_from_db()

    record_ticket_history(
        ticket=ticket,
        action="work_order_status_synchronized",
        description=(
            f"Ticket status synchronized to {target_status} from linked work order "
            f"{work_order.work_order_number}."
        ),
        actor=actor,
        metadata=_sync_metadata(
            work_order=work_order,
            previous_work_order_status=previous_work_order_status,
            maintenance_action=maintenance_action,
            target_ticket_status=target_status,
        ),
    )
    return ticket
