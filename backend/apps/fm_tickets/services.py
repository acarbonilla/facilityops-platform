from datetime import timedelta

from apps.access_control.services import get_user_roles
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import (
    FmTicket,
    FmTicketComment,
    FmTicketEscalation,
    FmTicketHistory,
    FmTicketStatusHistory,
)
from .notification_service import (
    notify_fm_ticket_assigned,
    notify_fm_ticket_status_changed,
)


SLA_AT_RISK_WINDOW = timedelta(hours=4)
TICKET_ASSIGNEE_ROLES = {"technician", "facility_manager", "system_admin"}


def _validate_ticket_assignee(*, assigned_to, ticket):
    if not assigned_to.is_active:
        raise ValidationError({"assignee": ["Assigned technician must be active."]})

    assignee_tenant_id = getattr(assigned_to, "tenant_id", None)
    if assignee_tenant_id is None:
        raise ValidationError(
            {"assignee": ["Assigned technician must belong to the ticket tenant."]}
        )
    if assignee_tenant_id != ticket.tenant_id:
        raise ValidationError(
            {"assignee": ["Assigned technician must belong to the ticket tenant."]}
        )

    role_codes = {role.code for role in get_user_roles(assigned_to)}
    if role_codes and not role_codes.intersection(TICKET_ASSIGNEE_ROLES):
        raise ValidationError(
            {
                "assignee": [
                    "User must have one of these roles: "
                    f"{', '.join(sorted(TICKET_ASSIGNEE_ROLES))}."
                ]
            }
        )


def record_ticket_history(
    *,
    ticket,
    action,
    description,
    actor=None,
    metadata=None,
):
    actor_id = str(actor.id) if actor else None
    return FmTicketHistory.objects.create(
        ticket=ticket,
        actor=actor,
        action=action,
        description=description,
        metadata=metadata or {},
        created_by=actor_id,
        updated_by=actor_id,
    )


def record_ticket_status_history(
    *,
    ticket,
    from_status,
    to_status,
    changed_by=None,
    note="",
):
    changed_by_id = str(changed_by.id) if changed_by else None
    return FmTicketStatusHistory.objects.create(
        ticket=ticket,
        from_status=from_status,
        to_status=to_status,
        changed_by=changed_by,
        changed_at=timezone.now(),
        note=note,
        created_by=changed_by_id,
        updated_by=changed_by_id,
    )


def calculate_ticket_sla_status(ticket):
    if not ticket.response_due_at and not ticket.resolution_due_at:
        return FmTicket.SlaStatus.NOT_APPLICABLE

    now = timezone.now()

    if ticket.resolved_at:
        if ticket.response_met is False or ticket.resolution_met is False:
            return FmTicket.SlaStatus.MISSED
        return FmTicket.SlaStatus.MET

    if not ticket.first_responded_at and ticket.response_due_at:
        if now > ticket.response_due_at:
            return FmTicket.SlaStatus.BREACHED
        if ticket.response_due_at - now <= SLA_AT_RISK_WINDOW:
            return FmTicket.SlaStatus.AT_RISK
        if ticket.status in {FmTicket.Status.DRAFT, FmTicket.Status.OPEN}:
            return FmTicket.SlaStatus.NOT_STARTED
        return FmTicket.SlaStatus.WITHIN_SLA

    if ticket.resolution_due_at:
        if now > ticket.resolution_due_at:
            return FmTicket.SlaStatus.BREACHED
        if ticket.resolution_due_at - now <= SLA_AT_RISK_WINDOW:
            return FmTicket.SlaStatus.AT_RISK
        return FmTicket.SlaStatus.WITHIN_SLA

    if ticket.first_responded_at:
        return FmTicket.SlaStatus.WITHIN_SLA

    return FmTicket.SlaStatus.NOT_APPLICABLE


def mark_ticket_first_response(*, ticket, responded_at=None):
    if ticket.first_responded_at:
        return False
    ticket.first_responded_at = responded_at or timezone.now()
    return True


def _apply_status_timestamps(ticket, to_status):
    now = timezone.now()

    if to_status == FmTicket.Status.RESOLVED:
        ticket.resolved_at = ticket.resolved_at or now
        ticket.closed_at = None
    elif to_status == FmTicket.Status.CLOSED:
        ticket.resolved_at = ticket.resolved_at or now
        ticket.closed_at = now
    elif to_status == FmTicket.Status.CANCELLED:
        ticket.closed_at = now


def create_ticket(*, requester, data):
    requester_id = str(requester.id)
    ticket = FmTicket.objects.create(
        requester=requester,
        created_by=requester_id,
        updated_by=requester_id,
        **data,
    )
    record_ticket_history(
        ticket=ticket,
        action="created",
        description="Ticket created.",
        actor=requester,
        metadata={"status": ticket.status},
    )
    record_ticket_status_history(
        ticket=ticket,
        from_status=None,
        to_status=ticket.status,
        changed_by=requester,
        note="Initial ticket status.",
    )
    return ticket


def update_ticket(*, ticket, data, actor=None):
    changes = {}

    for field, value in data.items():
        previous_value = getattr(ticket, field)
        if previous_value != value:
            changes[field] = {
                "from": str(previous_value) if previous_value is not None else None,
                "to": str(value) if value is not None else None,
            }
            setattr(ticket, field, value)

    if not changes:
        return ticket

    actor_id = str(actor.id) if actor else None
    ticket.updated_by = actor_id
    ticket.save()
    record_ticket_history(
        ticket=ticket,
        action="updated",
        description="Ticket details updated.",
        actor=actor,
        metadata={"changes": changes},
    )
    return ticket


def add_ticket_comment(*, ticket, author, body, is_internal=False):
    if author.id != ticket.requester_id:
        ticket.updated_by = str(author.id)
        mark_ticket_first_response(ticket=ticket)
        ticket.save()

    author_id = str(author.id)
    comment = FmTicketComment.objects.create(
        ticket=ticket,
        author=author,
        body=body,
        is_internal=is_internal,
        created_by=author_id,
        updated_by=author_id,
    )
    record_ticket_history(
        ticket=ticket,
        action="comment_added",
        description="Ticket comment added.",
        actor=author,
        metadata={"is_internal": is_internal},
    )
    return comment


@transaction.atomic
def change_ticket_status(*, ticket, to_status, changed_by=None, note=""):
    from_status = ticket.status
    if from_status == to_status:
        return ticket

    if to_status not in {FmTicket.Status.DRAFT, FmTicket.Status.OPEN}:
        mark_ticket_first_response(ticket=ticket)
    _apply_status_timestamps(ticket, to_status)
    ticket.status = to_status
    ticket.updated_by = str(changed_by.id) if changed_by else None
    ticket.save()

    record_ticket_status_history(
        ticket=ticket,
        from_status=from_status,
        to_status=to_status,
        changed_by=changed_by,
        note=note,
    )
    record_ticket_history(
        ticket=ticket,
        action="status_changed",
        description=f"Ticket status changed from {from_status} to {to_status}.",
        actor=changed_by,
        metadata={
            "from_status": from_status,
            "to_status": to_status,
            "note": note,
        },
    )
    notify_fm_ticket_status_changed(
        ticket=ticket,
        from_status=from_status,
        to_status=to_status,
        actor=changed_by,
    )
    return ticket


@transaction.atomic
def assign_ticket(*, ticket, assigned_to, assigned_by=None, note=""):
    _validate_ticket_assignee(assigned_to=assigned_to, ticket=ticket)

    previous_assignee_id = ticket.assignee_id
    previous_assignee = ticket.assignee
    ticket.assignee = assigned_to
    ticket.updated_by = str(assigned_by.id) if assigned_by else None
    mark_ticket_first_response(ticket=ticket)

    status_changed = ticket.status in {FmTicket.Status.DRAFT, FmTicket.Status.OPEN}
    previous_status = ticket.status
    if status_changed:
        ticket.status = FmTicket.Status.ASSIGNED

    ticket.save()
    record_ticket_history(
        ticket=ticket,
        action="assigned",
        description=f"Ticket assigned to {assigned_to.email}.",
        actor=assigned_by,
        metadata={
            "previous_assignee": (
                str(previous_assignee.id) if previous_assignee else None
            ),
            "new_assignee": str(assigned_to.id),
            "note": note,
        },
    )

    if status_changed:
        record_ticket_status_history(
            ticket=ticket,
            from_status=previous_status,
            to_status=ticket.status,
            changed_by=assigned_by,
            note=note or "Status updated during assignment.",
        )

    if previous_assignee_id != assigned_to.id:
        notify_fm_ticket_assigned(
            ticket=ticket,
            assignee=assigned_to,
            actor=assigned_by,
        )

    return ticket


def resolve_ticket_escalation(*, escalation, resolved_by=None, record_history=True):
    if not escalation.is_active and escalation.resolved_at:
        return escalation

    now = timezone.now()
    resolved_by_id = str(resolved_by.id) if resolved_by else None
    escalation.is_active = False
    escalation.resolved_at = now
    escalation.resolved_by = resolved_by
    escalation.updated_by = resolved_by_id
    escalation.save()

    if record_history:
        record_ticket_history(
            ticket=escalation.ticket,
            action="escalation_resolved",
            description=f"Escalation {escalation.level} resolved.",
            actor=resolved_by,
            metadata={
                "escalation_id": str(escalation.id),
                "level": escalation.level,
            },
        )

    return escalation


def create_ticket_escalation(
    *,
    ticket,
    escalated_by,
    escalated_to=None,
    reason,
    level,
):
    active_escalations = ticket.escalations.filter(is_active=True)
    for escalation in active_escalations:
        resolve_ticket_escalation(
            escalation=escalation,
            resolved_by=escalated_by,
            record_history=False,
        )

    escalated_by_id = str(escalated_by.id) if escalated_by else None
    escalation = FmTicketEscalation.objects.create(
        ticket=ticket,
        escalated_by=escalated_by,
        escalated_to=escalated_to or ticket.assignee,
        reason=reason,
        level=level,
        created_by=escalated_by_id,
        updated_by=escalated_by_id,
    )
    record_ticket_history(
        ticket=ticket,
        action="escalated",
        description=f"Ticket escalated as {level}.",
        actor=escalated_by,
        metadata={
            "escalation_id": str(escalation.id),
            "level": level,
            "reason": reason,
            "escalated_to": (
                str(escalation.escalated_to_id) if escalation.escalated_to_id else None
            ),
        },
    )
    return escalation
