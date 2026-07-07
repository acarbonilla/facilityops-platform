from datetime import timedelta

from django.utils import timezone

from .models import (
    MaintenanceAssignment,
    MaintenanceCompletion,
    MaintenanceHistory,
    MaintenanceSLA,
    MaintenanceStatusHistory,
    MaintenanceWorkOrder,
)


SLA_AT_RISK_WINDOW = timedelta(hours=4)
DEFAULT_RESPONSE_SLA = timedelta(hours=4)


def record_history(
    *,
    work_order,
    action,
    description,
    actor=None,
    metadata=None,
):
    actor_id = str(actor.id) if actor else None
    return MaintenanceHistory.objects.create(
        work_order=work_order,
        actor=actor,
        action=action,
        description=description,
        metadata=metadata or {},
        created_by=actor_id,
        updated_by=actor_id,
    )


def record_status_history(
    *,
    work_order,
    from_status,
    to_status,
    changed_by=None,
    note="",
):
    changed_by_id = str(changed_by.id) if changed_by else None
    return MaintenanceStatusHistory.objects.create(
        work_order=work_order,
        from_status=from_status,
        to_status=to_status,
        changed_by=changed_by,
        changed_at=timezone.now(),
        note=note,
        created_by=changed_by_id,
        updated_by=changed_by_id,
    )


def _calculate_deadline_met(actual_at, due_at):
    if not actual_at:
        return None
    if not due_at:
        return True
    return actual_at <= due_at


def calculate_sla(work_order):
    resolution_due_at = work_order.due_at
    defaults = {
        "response_due_at": work_order.requested_at + DEFAULT_RESPONSE_SLA,
        "resolution_due_at": resolution_due_at,
    }
    sla, _ = MaintenanceSLA.objects.get_or_create(
        work_order=work_order,
        defaults=defaults,
    )

    if not sla.response_due_at:
        sla.response_due_at = defaults["response_due_at"]
    if not sla.resolution_due_at:
        sla.resolution_due_at = resolution_due_at

    sla.resolved_at = work_order.completed_at or work_order.closed_at
    sla.response_met = _calculate_deadline_met(
        sla.first_responded_at,
        sla.response_due_at,
    )
    sla.resolution_met = _calculate_deadline_met(
        sla.resolved_at,
        sla.resolution_due_at,
    )

    if not sla.response_due_at and not sla.resolution_due_at:
        sla.sla_status = MaintenanceSLA.Status.NOT_APPLICABLE
    else:
        now = timezone.now()
        if sla.resolved_at:
            if sla.response_met is False or sla.resolution_met is False:
                sla.sla_status = MaintenanceSLA.Status.MISSED
            else:
                sla.sla_status = MaintenanceSLA.Status.MET
        elif not sla.first_responded_at and sla.response_due_at:
            if now > sla.response_due_at:
                sla.sla_status = MaintenanceSLA.Status.BREACHED
            elif sla.response_due_at - now <= SLA_AT_RISK_WINDOW:
                sla.sla_status = MaintenanceSLA.Status.AT_RISK
            elif work_order.status in {
                MaintenanceWorkOrder.Status.DRAFT,
                MaintenanceWorkOrder.Status.OPEN,
            }:
                sla.sla_status = MaintenanceSLA.Status.NOT_STARTED
            else:
                sla.sla_status = MaintenanceSLA.Status.WITHIN_SLA
        elif sla.resolution_due_at:
            if now > sla.resolution_due_at:
                sla.sla_status = MaintenanceSLA.Status.BREACHED
            elif sla.resolution_due_at - now <= SLA_AT_RISK_WINDOW:
                sla.sla_status = MaintenanceSLA.Status.AT_RISK
            else:
                sla.sla_status = MaintenanceSLA.Status.WITHIN_SLA
        else:
            sla.sla_status = MaintenanceSLA.Status.WITHIN_SLA

    sla.updated_by = work_order.updated_by
    sla.save()
    return sla


def _mark_first_response(*, work_order, responded_at=None):
    sla = calculate_sla(work_order)
    if sla.first_responded_at:
        return sla
    sla.first_responded_at = responded_at or timezone.now()
    sla.updated_by = work_order.updated_by
    sla.save()
    return sla


def _apply_status_timestamps(work_order, to_status):
    now = timezone.now()

    if to_status == MaintenanceWorkOrder.Status.IN_PROGRESS:
        work_order.started_at = work_order.started_at or now
    elif to_status == MaintenanceWorkOrder.Status.COMPLETED:
        work_order.started_at = work_order.started_at or now
        work_order.completed_at = work_order.completed_at or now
        work_order.closed_at = None
    elif to_status == MaintenanceWorkOrder.Status.CLOSED:
        work_order.completed_at = work_order.completed_at or now
        work_order.closed_at = now
    elif to_status == MaintenanceWorkOrder.Status.CANCELLED:
        work_order.closed_at = now


def create_work_order(*, requester, data):
    requester_id = str(requester.id)
    work_order = MaintenanceWorkOrder.objects.create(
        requester=requester,
        created_by=requester_id,
        updated_by=requester_id,
        **data,
    )
    calculate_sla(work_order)
    record_history(
        work_order=work_order,
        action="created",
        description="Work order created.",
        actor=requester,
        metadata={"status": work_order.status},
    )
    record_status_history(
        work_order=work_order,
        from_status=None,
        to_status=work_order.status,
        changed_by=requester,
        note="Initial work order status.",
    )
    return work_order


def update_work_order(*, work_order, data, actor=None):
    changes = {}

    for field, value in data.items():
        previous_value = getattr(work_order, field)
        if previous_value != value:
            changes[field] = {
                "from": str(previous_value) if previous_value is not None else None,
                "to": str(value) if value is not None else None,
            }
            setattr(work_order, field, value)

    if not changes:
        return work_order

    actor_id = str(actor.id) if actor else None
    work_order.updated_by = actor_id
    work_order.save()
    calculate_sla(work_order)
    record_history(
        work_order=work_order,
        action="updated",
        description="Work order details updated.",
        actor=actor,
        metadata={"changes": changes},
    )
    return work_order


def assign_work_order(*, work_order, assigned_to, assigned_by=None, note=""):
    assignment_time = timezone.now()
    actor_id = str(assigned_by.id) if assigned_by else None

    work_order.assignments.filter(is_active=True).update(
        is_active=False,
        unassigned_at=assignment_time,
        updated_by=actor_id,
    )

    previous_assignee = work_order.assignee
    previous_status = work_order.status
    status_changed = work_order.status in {
        MaintenanceWorkOrder.Status.DRAFT,
        MaintenanceWorkOrder.Status.OPEN,
    }

    work_order.assignee = assigned_to
    work_order.updated_by = actor_id
    if status_changed:
        work_order.status = MaintenanceWorkOrder.Status.ASSIGNED
    work_order.save()

    assignment = MaintenanceAssignment.objects.create(
        work_order=work_order,
        assigned_to=assigned_to,
        assigned_by=assigned_by,
        note=note,
        assigned_at=assignment_time,
        created_by=actor_id,
        updated_by=actor_id,
    )
    _mark_first_response(work_order=work_order, responded_at=assignment_time)
    calculate_sla(work_order)

    record_history(
        work_order=work_order,
        action="assigned",
        description=f"Work order assigned to {assigned_to.email}.",
        actor=assigned_by,
        metadata={
            "assignment_id": str(assignment.id),
            "previous_assignee": (
                str(previous_assignee.id) if previous_assignee else None
            ),
            "new_assignee": str(assigned_to.id),
            "note": note,
        },
    )

    if status_changed:
        record_status_history(
            work_order=work_order,
            from_status=previous_status,
            to_status=work_order.status,
            changed_by=assigned_by,
            note=note or "Status updated during assignment.",
        )

    return work_order


def change_status(
    *,
    work_order,
    to_status,
    changed_by=None,
    note="",
    cancellation_reason="",
):
    from_status = work_order.status
    if from_status == to_status:
        return work_order

    if to_status not in {
        MaintenanceWorkOrder.Status.DRAFT,
        MaintenanceWorkOrder.Status.OPEN,
    }:
        _mark_first_response(work_order=work_order)

    _apply_status_timestamps(work_order, to_status)
    work_order.status = to_status
    if to_status == MaintenanceWorkOrder.Status.CANCELLED:
        work_order.cancellation_reason = cancellation_reason
    work_order.updated_by = str(changed_by.id) if changed_by else None
    work_order.save()
    calculate_sla(work_order)

    record_status_history(
        work_order=work_order,
        from_status=from_status,
        to_status=to_status,
        changed_by=changed_by,
        note=note,
    )
    record_history(
        work_order=work_order,
        action="status_changed",
        description=f"Work order status changed from {from_status} to {to_status}.",
        actor=changed_by,
        metadata={
            "from_status": from_status,
            "to_status": to_status,
            "note": note,
            "cancellation_reason": cancellation_reason,
        },
    )
    return work_order


def complete_work_order(
    *,
    work_order,
    completed_by=None,
    completion_notes="",
    resolution_summary="",
    downtime_minutes=None,
    follow_up_required=False,
):
    completion_time = timezone.now()
    actor_id = str(completed_by.id) if completed_by else None

    if work_order.status != MaintenanceWorkOrder.Status.COMPLETED:
        work_order = change_status(
            work_order=work_order,
            to_status=MaintenanceWorkOrder.Status.COMPLETED,
            changed_by=completed_by,
            note="Work order completed.",
        )

    completion, _ = MaintenanceCompletion.objects.update_or_create(
        work_order=work_order,
        defaults={
            "completed_by": completed_by,
            "completion_notes": completion_notes,
            "resolution_summary": resolution_summary,
            "downtime_minutes": downtime_minutes,
            "follow_up_required": follow_up_required,
            "completed_at": completion_time,
            "updated_by": actor_id,
            "created_by": actor_id,
        },
    )

    work_order.completed_at = completion_time
    work_order.updated_by = actor_id
    work_order.save()
    calculate_sla(work_order)

    record_history(
        work_order=work_order,
        action="completed",
        description="Work order completion recorded.",
        actor=completed_by,
        metadata={
            "completion_id": str(completion.id),
            "downtime_minutes": downtime_minutes,
            "follow_up_required": follow_up_required,
        },
    )
    return work_order
