from apps.notifications.services import create_notification

from apps.inspection.models import Inspection

ASSIGNMENT_EVENT_CODE = "inspection.assigned"
STATUS_CHANGED_EVENT_CODE = "inspection.status_changed"
SOURCE_MODULE = "inspection"


def _format_status_label(status):
    return dict(Inspection.Status.choices).get(status, status)


def _inspection_number(inspection):
    return inspection.inspection_number or str(inspection.id)


def _inspection_target_url(inspection):
    return f"/inspection/inspections/{inspection.id}"


def _is_eligible_recipient(recipient, *, inspection, actor):
    if recipient is None:
        return False
    if not getattr(recipient, "is_active", False):
        return False
    if actor is not None and recipient.id == actor.id:
        return False

    recipient_tenant_id = getattr(recipient, "tenant_id", None)
    if recipient_tenant_id is None:
        return False
    if recipient_tenant_id != inspection.tenant_id:
        return False

    return True


def _collect_eligible_recipients(candidates, *, inspection, actor):
    seen = set()
    eligible = []

    for candidate in candidates:
        if candidate is None or candidate.id in seen:
            continue
        if not _is_eligible_recipient(candidate, inspection=inspection, actor=actor):
            continue

        seen.add(candidate.id)
        eligible.append(candidate)

    return eligible


def _severity_for_status_change(to_status):
    if to_status in {
        Inspection.Status.COMPLETED,
        Inspection.Status.VERIFIED,
    }:
        return "success"
    if to_status == Inspection.Status.CANCELLED:
        return "warning"
    return "info"


def _notify_assignment_principal(
    *,
    inspection,
    recipient,
    actor,
    assignment_role,
):
    if not _is_eligible_recipient(recipient, inspection=inspection, actor=actor):
        return None

    inspection_number = _inspection_number(inspection)
    message = f"{inspection_number}: {inspection.title}"

    return create_notification(
        recipient=recipient,
        event_code=ASSIGNMENT_EVENT_CODE,
        title="5S inspection assigned to you",
        message=message,
        severity="info",
        tenant=inspection.tenant,
        target_url=_inspection_target_url(inspection),
        source_module=SOURCE_MODULE,
        source_object_id=inspection.id,
        metadata={
            "inspection_number": inspection_number,
            "event": "assigned",
            "assignment_role": assignment_role,
        },
    )


def notify_inspection_assigned(
    *,
    inspection,
    inspector=None,
    supervisor=None,
    previous_inspector_id=None,
    previous_supervisor_id=None,
    actor=None,
):
    notifications = []

    if inspector is not None and previous_inspector_id != inspector.id:
        inspector_notification = _notify_assignment_principal(
            inspection=inspection,
            recipient=inspector,
            actor=actor,
            assignment_role="inspector",
        )
        if inspector_notification is not None:
            notifications.append(inspector_notification)

    if supervisor is not None and previous_supervisor_id != supervisor.id:
        supervisor_notification = _notify_assignment_principal(
            inspection=inspection,
            recipient=supervisor,
            actor=actor,
            assignment_role="supervisor",
        )
        if supervisor_notification is not None:
            notifications.append(supervisor_notification)

    return notifications


def notify_inspection_status_changed(
    *,
    inspection,
    from_status,
    to_status,
    actor=None,
):
    if from_status == to_status:
        return []

    recipients = _collect_eligible_recipients(
        [inspection.inspector, inspection.supervisor],
        inspection=inspection,
        actor=actor,
    )
    if not recipients:
        return []

    inspection_number = _inspection_number(inspection)
    from_label = _format_status_label(from_status)
    to_label = _format_status_label(to_status)
    message = (
        f"{inspection_number}: status changed from {from_label} to {to_label}."
    )
    severity = _severity_for_status_change(to_status)

    notifications = []
    for recipient in recipients:
        notifications.append(
            create_notification(
                recipient=recipient,
                event_code=STATUS_CHANGED_EVENT_CODE,
                title="5S inspection status updated",
                message=message,
                severity=severity,
                tenant=inspection.tenant,
                target_url=_inspection_target_url(inspection),
                source_module=SOURCE_MODULE,
                source_object_id=inspection.id,
                metadata={
                    "inspection_number": inspection_number,
                    "event": "status_changed",
                    "from_status": from_status,
                    "to_status": to_status,
                },
            )
        )

    return notifications
