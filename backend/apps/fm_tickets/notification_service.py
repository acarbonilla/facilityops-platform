from apps.notifications.services import create_notification

from .models import FmTicket
from .tenant_scope import uses_employee_requester_scope

ASSIGNMENT_EVENT_CODE = "fm_ticket.assigned"
STATUS_CHANGED_EVENT_CODE = "fm_ticket.status_changed"
SOURCE_MODULE = "fm_tickets"


def _format_status_label(status):
    return dict(FmTicket.Status.choices).get(status, status)


def _ticket_target_url(ticket, recipient=None):
    """Return requester-safe or operational detail URL for the recipient."""
    if recipient is not None and uses_employee_requester_scope(recipient):
        return f"/my-requests/{ticket.id}"
    return f"/fm-tickets/{ticket.id}"


def _ticket_number(ticket):
    return ticket.ticket_number or str(ticket.id)


def _is_eligible_recipient(recipient, *, ticket, actor):
    if recipient is None:
        return False
    if not getattr(recipient, "is_active", False):
        return False
    if actor is not None and recipient.id == actor.id:
        return False

    recipient_tenant_id = getattr(recipient, "tenant_id", None)
    if recipient_tenant_id is None:
        return False
    if recipient_tenant_id != ticket.tenant_id:
        return False

    return True


def _collect_eligible_recipients(candidates, *, ticket, actor):
    seen = set()
    eligible = []

    for candidate in candidates:
        if candidate is None or candidate.id in seen:
            continue
        if not _is_eligible_recipient(candidate, ticket=ticket, actor=actor):
            continue

        seen.add(candidate.id)
        eligible.append(candidate)

    return eligible


def _severity_for_status_change(to_status):
    if to_status in {FmTicket.Status.RESOLVED, FmTicket.Status.CLOSED}:
        return "success"
    if to_status == FmTicket.Status.CANCELLED:
        return "warning"
    return "info"


def _status_notification_copy(*, recipient, ticket_number, from_status, to_status):
    from_label = _format_status_label(from_status)
    to_label = _format_status_label(to_status)

    if uses_employee_requester_scope(recipient):
        title = "Your request status was updated"
        message = (
            f"{ticket_number}: status changed from {from_label} to {to_label}."
        )
    else:
        title = "FM ticket status updated"
        message = (
            f"{ticket_number}: status changed from {from_label} to {to_label}."
        )
    return title, message


def notify_fm_ticket_assigned(*, ticket, assignee, actor=None):
    if not _is_eligible_recipient(assignee, ticket=ticket, actor=actor):
        return None

    ticket_number = _ticket_number(ticket)
    message = f"{ticket_number}: {ticket.title}"

    return create_notification(
        recipient=assignee,
        event_code=ASSIGNMENT_EVENT_CODE,
        title="FM ticket assigned to you",
        message=message,
        severity="info",
        tenant=ticket.tenant,
        target_url=_ticket_target_url(ticket, assignee),
        source_module=SOURCE_MODULE,
        source_object_id=ticket.id,
        metadata={
            "ticket_number": ticket_number,
            "event": "assigned",
        },
    )


def notify_fm_ticket_status_changed(*, ticket, from_status, to_status, actor=None):
    recipients = _collect_eligible_recipients(
        [ticket.requester, ticket.assignee],
        ticket=ticket,
        actor=actor,
    )
    if not recipients:
        return []

    ticket_number = _ticket_number(ticket)
    severity = _severity_for_status_change(to_status)

    notifications = []
    for recipient in recipients:
        title, message = _status_notification_copy(
            recipient=recipient,
            ticket_number=ticket_number,
            from_status=from_status,
            to_status=to_status,
        )
        notifications.append(
            create_notification(
                recipient=recipient,
                event_code=STATUS_CHANGED_EVENT_CODE,
                title=title,
                message=message,
                severity=severity,
                tenant=ticket.tenant,
                target_url=_ticket_target_url(ticket, recipient),
                source_module=SOURCE_MODULE,
                source_object_id=ticket.id,
                metadata={
                    "ticket_number": ticket_number,
                    "event": "status_changed",
                    "from_status": from_status,
                    "to_status": to_status,
                },
            )
        )

    return notifications
