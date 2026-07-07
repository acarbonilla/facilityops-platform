from datetime import timedelta

from django.core.exceptions import PermissionDenied
from django.utils import timezone

from .models import (
    MaintenanceCompletion,
    MaintenanceHistory,
    MaintenanceStatusHistory,
    MaintenanceWorkOrder,
)
from .tenant_scope import user_can_access_tenant

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
    action=MaintenanceStatusHistory.Action.SYSTEM,
    reason="",
    note="",
):
    changed_by_id = str(changed_by.id) if changed_by else None
    return MaintenanceStatusHistory.objects.create(
        work_order=work_order,
        from_status=from_status,
        to_status=to_status,
        changed_by=changed_by,
        changed_at=timezone.now(),
        action=action,
        reason=reason,
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
    from .work_order_sla_service import recalculate_work_order_sla

    return recalculate_work_order_sla(work_order=work_order)


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
    elif to_status == MaintenanceWorkOrder.Status.REOPENED:
        work_order.closed_at = None
        work_order.completed_at = None


def create_work_order(*, requester, data):
    if not user_can_access_tenant(requester, data["tenant"].id):
        raise PermissionDenied("You cannot create work orders for another tenant.")
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
        action=MaintenanceStatusHistory.Action.SYSTEM,
        note="Initial work order status.",
    )
    return work_order


def update_work_order(*, work_order, data, actor=None):
    target_tenant = data.get("tenant", work_order.tenant)
    if actor and not user_can_access_tenant(actor, target_tenant.id):
        raise PermissionDenied("You cannot move work orders to another tenant.")
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
        action=MaintenanceStatusHistory.Action.SYSTEM,
        reason=cancellation_reason,
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
