from decimal import Decimal

from django.core.exceptions import ValidationError
from django.utils import timezone

from .models import (
    MaintenanceCompletion,
    MaintenanceStatusHistory,
    MaintenanceTask,
    MaintenanceWorkOrder,
)
from .services import calculate_sla, record_history, record_status_history
from .validators import validate_status_transition


def _apply_status_timestamps(
    work_order,
    to_status,
    *,
    changed_at=None,
):
    now = changed_at or timezone.now()

    if to_status == MaintenanceWorkOrder.Status.IN_PROGRESS:
        work_order.started_at = work_order.started_at or now
    elif to_status == MaintenanceWorkOrder.Status.COMPLETED:
        work_order.started_at = work_order.started_at or now
        work_order.completed_at = now
        work_order.closed_at = None
    elif to_status == MaintenanceWorkOrder.Status.REOPENED:
        work_order.completed_at = None
        work_order.closed_at = None


def _mark_first_response(*, work_order, responded_at=None):
    sla = calculate_sla(work_order)
    if sla.first_responded_at:
        return sla

    sla.first_responded_at = responded_at or timezone.now()
    sla.updated_by = work_order.updated_by
    sla.save()
    return sla


def _transition_work_order(
    *,
    work_order,
    action,
    to_status,
    actor=None,
    note="",
    reason="",
    changed_at=None,
):
    validate_status_transition(work_order.status, to_status)

    from_status = work_order.status
    actor_id = str(actor.id) if actor else None
    timestamp = changed_at or timezone.now()

    if to_status not in {
        MaintenanceWorkOrder.Status.DRAFT,
        MaintenanceWorkOrder.Status.OPEN,
    }:
        work_order.updated_by = actor_id
        _mark_first_response(work_order=work_order, responded_at=timestamp)

    if to_status == MaintenanceWorkOrder.Status.CANCELLED:
        work_order.cancellation_reason = reason
    elif to_status == MaintenanceWorkOrder.Status.REOPENED:
        work_order.cancellation_reason = ""

    _apply_status_timestamps(work_order, to_status, changed_at=timestamp)
    work_order.status = to_status
    work_order.updated_by = actor_id
    work_order.save()
    calculate_sla(work_order)

    record_status_history(
        work_order=work_order,
        from_status=from_status,
        to_status=to_status,
        changed_by=actor,
        action=action,
        reason=reason,
        note=note,
    )
    record_history(
        work_order=work_order,
        action=f"workflow_{action}",
        description=f"Workflow action {action} changed status from {from_status} to {to_status}.",
        actor=actor,
        metadata={
            "workflow_action": action,
            "from_status": from_status,
            "to_status": to_status,
            "reason": reason,
            "note": note,
        },
    )
    return work_order


def submit_work_order(*, work_order, actor=None, note=""):
    return _transition_work_order(
        work_order=work_order,
        action=MaintenanceStatusHistory.Action.SUBMIT,
        to_status=MaintenanceWorkOrder.Status.OPEN,
        actor=actor,
        note=note,
    )


def start_work_order(*, work_order, actor=None, note=""):
    return _transition_work_order(
        work_order=work_order,
        action=MaintenanceStatusHistory.Action.START,
        to_status=MaintenanceWorkOrder.Status.IN_PROGRESS,
        actor=actor,
        note=note,
    )


def hold_work_order(*, work_order, actor=None, reason="", note=""):
    if not reason.strip():
        raise ValidationError({"reason": "Hold reason is required."})

    return _transition_work_order(
        work_order=work_order,
        action=MaintenanceStatusHistory.Action.HOLD,
        to_status=MaintenanceWorkOrder.Status.ON_HOLD,
        actor=actor,
        reason=reason.strip(),
        note=note,
    )


def resume_work_order(*, work_order, actor=None, note=""):
    return _transition_work_order(
        work_order=work_order,
        action=MaintenanceStatusHistory.Action.RESUME,
        to_status=MaintenanceWorkOrder.Status.IN_PROGRESS,
        actor=actor,
        note=note,
    )


def _validate_completion_requirements(work_order, completion_notes, actual_hours):
    if not completion_notes.strip():
        raise ValidationError({"completion_notes": "Completion notes are required."})

    normalized_actual_hours = (
        Decimal(str(actual_hours)) if actual_hours is not None else None
    )

    if normalized_actual_hours is None or normalized_actual_hours <= 0:
        raise ValidationError(
            {"actual_hours": "Actual hours must be greater than zero."}
        )

    incomplete_tasks = work_order.tasks.exclude(status=MaintenanceTask.Status.COMPLETED)
    if incomplete_tasks.exists():
        raise ValidationError(
            {
                "tasks": (
                    "All recorded tasks must be completed before completing the work order."
                )
            }
        )


def complete_work_order(
    *,
    work_order,
    completed_by=None,
    completion_notes="",
    actual_hours=None,
    completed_at=None,
    resolution_summary="",
    downtime_minutes=None,
    follow_up_required=False,
):
    normalized_actual_hours = (
        Decimal(str(actual_hours)) if actual_hours is not None else None
    )
    _validate_completion_requirements(
        work_order,
        completion_notes,
        normalized_actual_hours,
    )

    completion_time = completed_at or timezone.now()
    actor_id = str(completed_by.id) if completed_by else None

    work_order = _transition_work_order(
        work_order=work_order,
        action=MaintenanceStatusHistory.Action.COMPLETE,
        to_status=MaintenanceWorkOrder.Status.COMPLETED,
        actor=completed_by,
        note=completion_notes,
        changed_at=completion_time,
    )

    completion, _ = MaintenanceCompletion.objects.update_or_create(
        work_order=work_order,
        defaults={
            "completed_by": completed_by,
            "completion_notes": completion_notes,
            "resolution_summary": resolution_summary or completion_notes,
            "actual_hours": normalized_actual_hours,
            "downtime_minutes": downtime_minutes,
            "follow_up_required": follow_up_required,
            "completed_at": completion_time,
            "updated_by": actor_id,
            "created_by": actor_id,
        },
    )

    work_order.completed_at = completion_time
    work_order.updated_by = actor_id
    work_order.save(update_fields=["completed_at", "updated_by", "updated_at"])
    calculate_sla(work_order)

    record_history(
        work_order=work_order,
        action="completed",
        description="Work order completion recorded.",
        actor=completed_by,
        metadata={
            "workflow_action": "complete",
            "completion_id": str(completion.id),
            "actual_hours": str(normalized_actual_hours),
            "downtime_minutes": downtime_minutes,
            "follow_up_required": follow_up_required,
        },
    )
    return work_order


def cancel_work_order(*, work_order, actor=None, reason="", note=""):
    if not reason.strip():
        raise ValidationError({"reason": "Cancellation reason is required."})

    return _transition_work_order(
        work_order=work_order,
        action=MaintenanceStatusHistory.Action.CANCEL,
        to_status=MaintenanceWorkOrder.Status.CANCELLED,
        actor=actor,
        reason=reason.strip(),
        note=note,
    )


def reopen_work_order(*, work_order, actor=None, reason="", note=""):
    if not reason.strip():
        raise ValidationError({"reason": "Reopen reason is required."})

    actor_id = str(actor.id) if actor else None
    work_order.assignments.filter(is_active=True).update(
        is_active=False,
        unassigned_at=timezone.now(),
        updated_by=actor_id,
    )
    work_order.assignee = None

    reopened_work_order = _transition_work_order(
        work_order=work_order,
        action=MaintenanceStatusHistory.Action.REOPEN,
        to_status=MaintenanceWorkOrder.Status.REOPENED,
        actor=actor,
        reason=reason.strip(),
        note=note,
    )
    reopened_work_order.assignee = None
    reopened_work_order.updated_by = actor_id
    reopened_work_order.save(update_fields=["assignee", "updated_by", "updated_at"])
    calculate_sla(reopened_work_order)
    return reopened_work_order
