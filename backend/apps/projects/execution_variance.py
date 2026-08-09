"""FO-115B planned-vs-actual execution variance helpers.

Actual Start / Actual End are DateFields on ProjectTask (FO-104).
Lifecycle (FO-111) sets them; planned dates are never rewritten.
"""

from __future__ import annotations

from datetime import date

from django.utils import timezone

from .models import ProjectTask


def _as_date(value) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if hasattr(value, "date"):
        return value.date()
    return date.fromisoformat(str(value)[:10])


def compute_execution_schedule(*, task, today=None) -> dict:
    """Derive start/completion variance and execution_schedule_status.

    Day-level math matches FacilityOps planned/actual DateField convention.
    Unscheduled tasks (missing planned dates) do not receive start/completion
    variance penalties.
    """
    today = _as_date(today) or timezone.localdate()
    planned_start = _as_date(task.planned_start)
    planned_end = _as_date(task.planned_end)
    actual_start = _as_date(task.actual_start)
    actual_end = _as_date(task.actual_end)

    start_variance_days = None
    if planned_start is not None and actual_start is not None:
        start_variance_days = (actual_start - planned_start).days

    completion_variance_days = None
    if planned_end is not None and actual_end is not None:
        completion_variance_days = (actual_end - planned_end).days

    status = "variance_unavailable"
    is_unscheduled = planned_start is None or planned_end is None

    if task.status == ProjectTask.Status.CANCELLED and actual_start is None:
        status = "unscheduled" if is_unscheduled else "not_started"
    elif actual_start is None:
        status = "unscheduled" if is_unscheduled else "not_started"
    elif actual_end is not None:
        if is_unscheduled or planned_end is None:
            status = "unscheduled"
        elif completion_variance_days is None:
            status = "variance_unavailable"
        elif completion_variance_days < 0:
            status = "completed_early"
        elif completion_variance_days == 0:
            status = "completed_on_time"
        else:
            status = "completed_late"
    else:
        # In progress / paused / blocked with actual start.
        past_due = (
            planned_end is not None
            and today > planned_end
            and task.status
            not in (
                ProjectTask.Status.COMPLETED,
                ProjectTask.Status.CANCELLED,
            )
        )
        if past_due:
            status = "in_progress_past_due"
        elif is_unscheduled or planned_start is None:
            status = "unscheduled"
        elif start_variance_days is None:
            status = "variance_unavailable"
        elif start_variance_days < 0:
            status = "started_early"
        elif start_variance_days == 0:
            status = "started_on_time"
        else:
            status = "started_late"

    days_past_planned_end = 0
    if (
        planned_end is not None
        and actual_end is None
        and task.status
        not in (
            ProjectTask.Status.COMPLETED,
            ProjectTask.Status.CANCELLED,
        )
        and today > planned_end
    ):
        days_past_planned_end = (today - planned_end).days

    return {
        "start_variance_days": start_variance_days,
        "completion_variance_days": completion_variance_days,
        "execution_schedule_status": status,
        "days_past_planned_end": days_past_planned_end,
        "actual_execution_end": (
            actual_end.isoformat()
            if actual_end is not None
            else (
                today.isoformat()
                if actual_start is not None
                and task.status
                not in (
                    ProjectTask.Status.COMPLETED,
                    ProjectTask.Status.CANCELLED,
                )
                else None
            )
        ),
    }
