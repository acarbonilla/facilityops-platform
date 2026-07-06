from django.utils import timezone

from .models import FmTicket, FmTicketComment, FmTicketHistory, FmTicketStatusHistory


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


def change_ticket_status(*, ticket, to_status, changed_by=None, note=""):
    from_status = ticket.status
    if from_status == to_status:
        return ticket

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
    return ticket


def assign_ticket(*, ticket, assigned_to, assigned_by=None, note=""):
    previous_assignee = ticket.assignee
    ticket.assignee = assigned_to
    ticket.updated_by = str(assigned_by.id) if assigned_by else None

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

    return ticket

