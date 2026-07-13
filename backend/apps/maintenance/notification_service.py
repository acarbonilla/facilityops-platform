from apps.notifications.services import create_notification

from .models import MaintenanceWorkOrder

ASSIGNMENT_EVENT_CODE = "maintenance.assigned"
STATUS_CHANGED_EVENT_CODE = "maintenance.status_changed"
SOURCE_MODULE = "maintenance"


def _format_status_label(status):
    return dict(MaintenanceWorkOrder.Status.choices).get(status, status)


def _work_order_number(work_order):
    return work_order.work_order_number or str(work_order.id)


def _work_order_target_url(work_order):
    return f"/maintenance/work-orders/{work_order.id}"


def _is_eligible_recipient(recipient, *, work_order, actor):
    if recipient is None:
        return False
    if not getattr(recipient, "is_active", False):
        return False
    if actor is not None and recipient.id == actor.id:
        return False

    recipient_tenant_id = getattr(recipient, "tenant_id", None)
    if recipient_tenant_id is None:
        return False
    if recipient_tenant_id != work_order.tenant_id:
        return False

    return True


def _collect_eligible_recipients(candidates, *, work_order, actor):
    seen = set()
    eligible = []

    for candidate in candidates:
        if candidate is None or candidate.id in seen:
            continue
        if not _is_eligible_recipient(candidate, work_order=work_order, actor=actor):
            continue

        seen.add(candidate.id)
        eligible.append(candidate)

    return eligible


def _severity_for_status_change(to_status):
    if to_status in {
        MaintenanceWorkOrder.Status.COMPLETED,
        MaintenanceWorkOrder.Status.CLOSED,
    }:
        return "success"
    if to_status in {
        MaintenanceWorkOrder.Status.CANCELLED,
        MaintenanceWorkOrder.Status.ON_HOLD,
    }:
        return "warning"
    return "info"


def _active_supervisor(work_order):
    active_assignment = work_order.assignments.filter(is_active=True).first()
    if active_assignment is None:
        return None
    return active_assignment.supervisor


def _notify_assignment_principal(
    *,
    work_order,
    recipient,
    actor,
    assignment_role,
):
    if not _is_eligible_recipient(recipient, work_order=work_order, actor=actor):
        return None

    work_order_number = _work_order_number(work_order)
    message = f"{work_order_number}: {work_order.title}"

    return create_notification(
        recipient=recipient,
        event_code=ASSIGNMENT_EVENT_CODE,
        title="Maintenance work order assigned to you",
        message=message,
        severity="info",
        tenant=work_order.tenant,
        target_url=_work_order_target_url(work_order),
        source_module=SOURCE_MODULE,
        source_object_id=work_order.id,
        metadata={
            "work_order_number": work_order_number,
            "event": "assigned",
            "assignment_role": assignment_role,
        },
    )


def notify_maintenance_assigned(
    *,
    work_order,
    technician,
    supervisor=None,
    actor=None,
):
    notifications = []

    technician_notification = _notify_assignment_principal(
        work_order=work_order,
        recipient=technician,
        actor=actor,
        assignment_role="technician",
    )
    if technician_notification is not None:
        notifications.append(technician_notification)

    if supervisor is not None:
        supervisor_notification = _notify_assignment_principal(
            work_order=work_order,
            recipient=supervisor,
            actor=actor,
            assignment_role="supervisor",
        )
        if supervisor_notification is not None:
            notifications.append(supervisor_notification)

    return notifications


def notify_maintenance_reassigned(
    *,
    work_order,
    technician,
    supervisor=None,
    previous_assignment,
    actor=None,
):
    notifications = []

    if previous_assignment.assigned_to_id != technician.id:
        technician_notification = _notify_assignment_principal(
            work_order=work_order,
            recipient=technician,
            actor=actor,
            assignment_role="technician",
        )
        if technician_notification is not None:
            notifications.append(technician_notification)

    previous_supervisor_id = previous_assignment.supervisor_id
    new_supervisor_id = supervisor.id if supervisor is not None else None
    if supervisor is not None and previous_supervisor_id != new_supervisor_id:
        supervisor_notification = _notify_assignment_principal(
            work_order=work_order,
            recipient=supervisor,
            actor=actor,
            assignment_role="supervisor",
        )
        if supervisor_notification is not None:
            notifications.append(supervisor_notification)

    return notifications


def notify_maintenance_status_changed(
    *,
    work_order,
    from_status,
    to_status,
    actor=None,
):
    if from_status == to_status:
        return []

    recipients = _collect_eligible_recipients(
        [work_order.requester, work_order.assignee, _active_supervisor(work_order)],
        work_order=work_order,
        actor=actor,
    )
    if not recipients:
        return []

    work_order_number = _work_order_number(work_order)
    from_label = _format_status_label(from_status)
    to_label = _format_status_label(to_status)
    message = (
        f"{work_order_number}: status changed from {from_label} to {to_label}."
    )
    severity = _severity_for_status_change(to_status)

    notifications = []
    for recipient in recipients:
        notifications.append(
            create_notification(
                recipient=recipient,
                event_code=STATUS_CHANGED_EVENT_CODE,
                title="Maintenance work order status updated",
                message=message,
                severity=severity,
                tenant=work_order.tenant,
                target_url=_work_order_target_url(work_order),
                source_module=SOURCE_MODULE,
                source_object_id=work_order.id,
                metadata={
                    "work_order_number": work_order_number,
                    "event": "status_changed",
                    "from_status": from_status,
                    "to_status": to_status,
                },
            )
        )

    return notifications
