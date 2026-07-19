from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from rest_framework.exceptions import APIException

from apps.maintenance.models import MaintenanceWorkOrder
from apps.maintenance.services import create_work_order, record_history
from apps.maintenance.work_order_assignment_service import assign_work_order

from .models import FmTicket
from .services import record_ticket_history
from .tenant_scope import scope_fm_ticket_queryset

ELIGIBLE_TICKET_STATUSES = {
    FmTicket.Status.ASSIGNED,
    FmTicket.Status.IN_PROGRESS,
}

PRIORITY_MAP = {
    FmTicket.Priority.LOW: MaintenanceWorkOrder.Priority.LOW,
    FmTicket.Priority.MEDIUM: MaintenanceWorkOrder.Priority.MEDIUM,
    FmTicket.Priority.HIGH: MaintenanceWorkOrder.Priority.HIGH,
    FmTicket.Priority.URGENT: MaintenanceWorkOrder.Priority.CRITICAL,
}


class WorkOrderAlreadyLinked(APIException):
    status_code = 409
    default_detail = "A maintenance work order is already linked to this ticket."
    default_code = "work_order_already_linked"


def map_ticket_priority_to_work_order(priority):
    try:
        return PRIORITY_MAP[priority]
    except KeyError as exc:
        raise ValidationError(
            {"priority": ["Ticket priority cannot be mapped to a work order priority."]}
        ) from exc


def _validate_generation_eligibility(*, ticket):
    if ticket.assignee_id is None:
        raise ValidationError(
            {"assignee": ["Ticket must have an assigned technician before generating a work order."]}
        )

    if ticket.status not in ELIGIBLE_TICKET_STATUSES:
        raise ValidationError(
            {
                "status": [
                    "Work orders can only be generated from assigned or in-progress tickets."
                ]
            }
        )

    if not ticket.asset_id:
        raise ValidationError(
            {
                "asset": [
                    "Ticket must have an asset before a maintenance work order can be generated."
                ]
            }
        )

    assignee = ticket.assignee
    if not assignee.is_active:
        raise ValidationError({"assignee": ["Assigned technician must be active."]})

    assignee_tenant_id = getattr(assignee, "tenant_id", None)
    if assignee_tenant_id is None:
        raise ValidationError(
            {"assignee": ["Assigned technician must belong to the ticket tenant."]}
        )
    if assignee_tenant_id != ticket.tenant_id:
        raise ValidationError(
            {"assignee": ["Assigned technician must belong to the ticket tenant."]}
        )

    if MaintenanceWorkOrder.objects.filter(source_ticket_id=ticket.id).exists():
        raise WorkOrderAlreadyLinked()


@transaction.atomic
def generate_work_order_from_ticket(*, ticket, generated_by):
    locked_ticket_id = (
        scope_fm_ticket_queryset(
            FmTicket.objects.select_for_update(),
            generated_by,
        )
        .get(pk=ticket.pk, is_deleted=False)
        .pk
    )
    locked_ticket = (
        FmTicket.objects.select_related(
            "tenant",
            "organization",
            "department",
            "building",
            "floor",
            "area",
            "asset",
            "requester",
            "assignee",
        ).get(pk=locked_ticket_id)
    )

    _validate_generation_eligibility(ticket=locked_ticket)

    actor_id = str(generated_by.id)
    assignment_notes = (
        f"Generated from FM Ticket {locked_ticket.ticket_number}."
    )
    work_order_data = {
        "tenant": locked_ticket.tenant,
        "organization": locked_ticket.organization,
        "department": locked_ticket.department,
        "building": locked_ticket.building,
        "floor": locked_ticket.floor,
        "area": locked_ticket.area,
        "asset": locked_ticket.asset,
        "source_ticket": locked_ticket,
        "title": locked_ticket.title,
        "description": locked_ticket.description,
        "priority": map_ticket_priority_to_work_order(locked_ticket.priority),
        "status": MaintenanceWorkOrder.Status.OPEN,
        "requested_at": locked_ticket.reported_at,
        "due_at": locked_ticket.due_at,
    }

    try:
        work_order = create_work_order(
            requester=locked_ticket.requester,
            data=work_order_data,
        )
    except IntegrityError as exc:
        raise WorkOrderAlreadyLinked() from exc

    work_order.created_by = actor_id
    work_order.updated_by = actor_id
    work_order.save(update_fields=["created_by", "updated_by", "updated_at"])

    work_order = assign_work_order(
        work_order=work_order,
        assigned_to=locked_ticket.assignee,
        assigned_by=generated_by,
        supervisor=None,
        notes=assignment_notes,
        enforce_permission=False,
    )

    record_history(
        work_order=work_order,
        action="generated_from_ticket",
        description="Work order generated from FM ticket.",
        actor=generated_by,
        metadata={
            "source_ticket_id": str(locked_ticket.id),
            "ticket_number": locked_ticket.ticket_number,
        },
    )
    record_ticket_history(
        ticket=locked_ticket,
        action="work_order_generated",
        description="Maintenance work order generated from ticket.",
        actor=generated_by,
        metadata={
            "work_order_id": str(work_order.id),
            "work_order_number": work_order.work_order_number,
        },
    )

    return work_order
