"""FM Ticket notification service (FO-058A + FO-099 intelligent intake).

FO-099 events reuse create_notification and requester-safe `_ticket_target_url`.
Deduplication is application-level: one row per (recipient, event_code, ticket).
Preferences inherit the existing fm_tickets in_app module family (FO-059).
"""

from django.contrib.auth import get_user_model

from apps.access_control.models import UserRole
from apps.notifications.models import Notification, NotificationPreference
from apps.notifications.preference_services import get_effective_notification_preference
from apps.notifications.services import create_notification

from .classification_readiness import get_classification_block_reason
from .models import FmTicket
from .tenant_scope import uses_employee_requester_scope

ASSIGNMENT_EVENT_CODE = "fm_ticket.assigned"
STATUS_CHANGED_EVENT_CODE = "fm_ticket.status_changed"
EMPLOYEE_CONCERN_CREATED_EVENT_CODE = "fm_ticket.employee_concern_created"
EMPLOYEE_CONCERN_SUBMITTED_EVENT_CODE = "fm_ticket.employee_concern_submitted"
AI_ANALYSIS_READY_EVENT_CODE = "fm_ticket.ai_analysis_ready"
AI_ANALYSIS_FAILED_EVENT_CODE = "fm_ticket.ai_analysis_failed"
CLASSIFICATION_COMPLETED_EVENT_CODE = "fm_ticket.classification_completed"
SOURCE_MODULE = "fm_tickets"

FM_OPERATIONAL_ROLE_CODES = {"facility_manager", "system_admin"}


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


def _channel_enabled_for_recipient(recipient) -> bool:
    return bool(
        get_effective_notification_preference(
            recipient,
            NotificationPreference.Channel.IN_APP,
            SOURCE_MODULE,
        )
    )


def _notification_already_exists(*, recipient, event_code, ticket) -> bool:
    return Notification.objects.filter(
        recipient=recipient,
        event_code=event_code,
        source_module=SOURCE_MODULE,
        source_object_id=ticket.id,
    ).exists()


def _create_if_allowed(
    *,
    recipient,
    event_code,
    title,
    message,
    severity,
    ticket,
    metadata,
    actor=None,
):
    if not _is_eligible_recipient(recipient, ticket=ticket, actor=actor):
        return None
    if not _channel_enabled_for_recipient(recipient):
        return None
    if _notification_already_exists(
        recipient=recipient, event_code=event_code, ticket=ticket
    ):
        return None

    return create_notification(
        recipient=recipient,
        event_code=event_code,
        title=title,
        message=message,
        severity=severity,
        tenant=ticket.tenant,
        target_url=_ticket_target_url(ticket, recipient),
        source_module=SOURCE_MODULE,
        source_object_id=ticket.id,
        metadata=metadata,
    )


def _resolve_fm_operational_recipients(*, ticket, actor=None):
    """Tenant FM / system-admin users, excluding employee-only requesters."""
    User = get_user_model()
    user_ids = (
        UserRole.objects.filter(
            is_active=True,
            role__is_active=True,
            role__is_deleted=False,
            role__code__in=FM_OPERATIONAL_ROLE_CODES,
            user__tenant_id=ticket.tenant_id,
            user__is_active=True,
        )
        .values_list("user_id", flat=True)
        .distinct()
    )
    candidates = list(User.objects.filter(id__in=user_ids, is_active=True))
    eligible = []
    for candidate in _collect_eligible_recipients(
        candidates, ticket=ticket, actor=actor
    ):
        # Dual-role users receive the internal event once (not employee-only scope).
        if uses_employee_requester_scope(candidate):
            continue
        eligible.append(candidate)
    return eligible


def _severity_for_status_change(to_status):
    if to_status in {FmTicket.Status.RESOLVED, FmTicket.Status.CLOSED}:
        return "success"
    if to_status == FmTicket.Status.CANCELLED:
        return "warning"
    return "info"


def _status_notification_copy(
    *,
    recipient,
    ticket_number,
    from_status,
    to_status,
    notification_context=None,
):
    from_label = _format_status_label(from_status)
    to_label = _format_status_label(to_status)

    if notification_context == "automatic_closure":
        if uses_employee_requester_scope(recipient):
            return (
                "Your request was automatically closed",
                (
                    f"{ticket_number}: closed because the acknowledgement "
                    "period expired."
                ),
            )
        return (
            "FM ticket automatically closed",
            (
                f"{ticket_number}: automatically closed after the "
                "acknowledgement period expired "
                f"({from_label} → {to_label})."
            ),
        )

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
    if not _channel_enabled_for_recipient(assignee):
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


def notify_fm_ticket_status_changed(
    *,
    ticket,
    from_status,
    to_status,
    actor=None,
    notification_context=None,
):
    recipients = _collect_eligible_recipients(
        [ticket.requester, ticket.assignee],
        ticket=ticket,
        actor=actor,
    )
    if not recipients:
        return []

    ticket_number = _ticket_number(ticket)
    severity = _severity_for_status_change(to_status)
    event_name = (
        "automatic_closure"
        if notification_context == "automatic_closure"
        else "status_changed"
    )

    notifications = []
    for recipient in recipients:
        if not _channel_enabled_for_recipient(recipient):
            continue
        title, message = _status_notification_copy(
            recipient=recipient,
            ticket_number=ticket_number,
            from_status=from_status,
            to_status=to_status,
            notification_context=notification_context,
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
                    "event": event_name,
                    "from_status": from_status,
                    "to_status": to_status,
                },
            )
        )

    return notifications


def notify_employee_concern_created(*, ticket, actor=None):
    """Immediate Facilities awareness after Employee intake create (FO-099)."""
    ticket_number = _ticket_number(ticket)
    org_name = getattr(ticket.organization, "name", None) or "Organization"
    title = "A new employee facility concern requires review."
    message = (
        f"{ticket_number}: {ticket.title}. "
        f"Organization: {org_name}. "
        "Classification may still be pending; AI status may not yet be available."
    )
    metadata = {
        "ticket_number": ticket_number,
        "event": "employee_concern_created",
        "organization_name": org_name,
        "category": ticket.category,
        "priority": ticket.priority,
    }

    notifications = []
    for recipient in _resolve_fm_operational_recipients(ticket=ticket, actor=actor):
        created = _create_if_allowed(
            recipient=recipient,
            event_code=EMPLOYEE_CONCERN_CREATED_EVENT_CODE,
            title=title,
            message=message,
            severity="info",
            ticket=ticket,
            metadata=metadata,
            actor=actor,
        )
        if created is not None:
            notifications.append(created)
    return notifications


def notify_employee_concern_submitted(*, ticket, actor=None):
    """Requester-safe submission confirmation (FO-099)."""
    requester = ticket.requester
    if requester is None:
        return None
    # Dual-role users already receive the internal create event; skip duplicate.
    if not uses_employee_requester_scope(requester):
        return None

    ticket_number = _ticket_number(ticket)
    return _create_if_allowed(
        recipient=requester,
        event_code=EMPLOYEE_CONCERN_SUBMITTED_EVENT_CODE,
        title="Your facility concern was submitted successfully.",
        message=(
            f"{ticket_number}: Facilities Team will review your concern. "
            "Eligible images may be analyzed in the background."
        ),
        severity="success",
        ticket=ticket,
        metadata={
            "ticket_number": ticket_number,
            "event": "employee_concern_submitted",
        },
        actor=actor,
    )


def notify_ai_analysis_ready(*, ticket, analysis=None, actor=None):
    """Facilities AI-ready review notice after terminal COMPLETED (FO-099)."""
    ticket_number = _ticket_number(ticket)
    title = "AI findings are ready. Review and confirm the ticket classification."
    message = (
        f"{ticket_number}: AI analysis completed. "
        "Human review is required before operational decisions."
    )
    if ticket.category == FmTicket.Category.UNCLASSIFIED or (
        ticket.priority == FmTicket.Priority.PENDING_REVIEW
    ):
        message += " Ticket classification is still pending review."

    metadata = {
        "ticket_number": ticket_number,
        "event": "ai_analysis_ready",
        "analysis_id": str(analysis.id) if analysis is not None else None,
    }

    notifications = []
    for recipient in _resolve_fm_operational_recipients(ticket=ticket, actor=actor):
        created = _create_if_allowed(
            recipient=recipient,
            event_code=AI_ANALYSIS_READY_EVENT_CODE,
            title=title,
            message=message,
            severity="info",
            ticket=ticket,
            metadata=metadata,
            actor=actor,
        )
        if created is not None:
            notifications.append(created)
    return notifications


def notify_ai_analysis_failed(*, ticket, analysis=None, actor=None):
    """Terminal AI failure notice for Facilities only (FO-099)."""
    ticket_number = _ticket_number(ticket)
    title = "AI analysis was unavailable. Continue with manual review."
    message = (
        f"{ticket_number}: AI analysis could not be completed. "
        "The ticket remains active for manual classification."
    )
    metadata = {
        "ticket_number": ticket_number,
        "event": "ai_analysis_failed",
        "analysis_id": str(analysis.id) if analysis is not None else None,
    }

    notifications = []
    for recipient in _resolve_fm_operational_recipients(ticket=ticket, actor=actor):
        created = _create_if_allowed(
            recipient=recipient,
            event_code=AI_ANALYSIS_FAILED_EVENT_CODE,
            title=title,
            message=message,
            severity="warning",
            ticket=ticket,
            metadata=metadata,
            actor=actor,
        )
        if created is not None:
            notifications.append(created)
    return notifications


def notify_classification_completed(*, ticket, actor=None):
    """Requester-safe notice when operational classification first completes."""
    ticket_number = _ticket_number(ticket)
    notifications = []

    requester = ticket.requester
    if requester is not None and uses_employee_requester_scope(requester):
        created = _create_if_allowed(
            recipient=requester,
            event_code=CLASSIFICATION_COMPLETED_EVENT_CODE,
            title="Your facility concern is under Facilities review.",
            message=(
                f"{ticket_number}: Facilities has classified your concern "
                "and continues operational handling."
            ),
            severity="info",
            ticket=ticket,
            metadata={
                "ticket_number": ticket_number,
                "event": "classification_completed",
                "audience": "requester",
            },
            actor=actor,
        )
        if created is not None:
            notifications.append(created)

    # Internal ops (excluding actor) get a short operational notice once.
    title = "Ticket classification completed"
    message = (
        f"{ticket_number}: operational category and priority are set. "
        "Assignment and work-order actions may proceed."
    )
    for recipient in _resolve_fm_operational_recipients(ticket=ticket, actor=actor):
        created = _create_if_allowed(
            recipient=recipient,
            event_code=CLASSIFICATION_COMPLETED_EVENT_CODE,
            title=title,
            message=message,
            severity="success",
            ticket=ticket,
            metadata={
                "ticket_number": ticket_number,
                "event": "classification_completed",
                "audience": "internal",
            },
            actor=actor,
        )
        if created is not None:
            notifications.append(created)

    return notifications


def maybe_notify_classification_completed(*, ticket, previous_incomplete, actor=None):
    """Fire once when readiness flips incomplete → complete."""
    if not previous_incomplete:
        return []
    if get_classification_block_reason(ticket) is not None:
        return []
    return notify_classification_completed(ticket=ticket, actor=actor)
