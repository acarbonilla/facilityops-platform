"""FO-111 Technician task execution workflow helpers.

Paused maps to existing ProjectTask status `on_hold` (no schema change).
Lifecycle: not_started → in_progress ⇄ on_hold → completed.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from .models import ProjectIssue, ProjectTask
from .services import create_issue, update_task
from .workspace_access import (
    can_edit_assigned_project_task,
    user_uses_project_workspace_scope,
)

BLOCKER_SEVERITY_DEFAULT = ProjectIssue.Severity.HIGH


def _ensure_execution_actor(*, actor, task):
    if actor is None:
        raise PermissionDenied("Authentication required.")
    if user_uses_project_workspace_scope(actor):
        if not can_edit_assigned_project_task(actor, task):
            raise PermissionDenied(
                "Technicians may only execute tasks assigned to them."
            )


def start_task(*, task, actor):
    """Move assigned task to in_progress and set actual_start when missing."""
    _ensure_execution_actor(actor=actor, task=task)
    if task.status == ProjectTask.Status.COMPLETED:
        raise ValidationError({"status": "Completed tasks cannot be started."})
    if task.status == ProjectTask.Status.CANCELLED:
        raise ValidationError({"status": "Cancelled tasks cannot be started."})

    payload = {
        "status": ProjectTask.Status.IN_PROGRESS,
    }
    if task.actual_start is None:
        payload["actual_start"] = timezone.localdate()
    if task.progress_percentage is None or Decimal(
        str(task.progress_percentage)
    ) == Decimal("0.00"):
        payload["progress_percentage"] = Decimal("1.00")

    return update_task(task=task, data=payload, actor=actor)


def pause_task(*, task, actor):
    """Pause work — maps to on_hold (FO-111 “Paused”)."""
    _ensure_execution_actor(actor=actor, task=task)
    if task.status != ProjectTask.Status.IN_PROGRESS:
        raise ValidationError(
            {"status": "Only in-progress tasks can be paused."}
        )
    return update_task(
        task=task,
        data={"status": ProjectTask.Status.ON_HOLD},
        actor=actor,
    )


def resume_task(*, task, actor):
    """Resume paused (on_hold) or blocked work into in_progress."""
    _ensure_execution_actor(actor=actor, task=task)
    if task.status not in (
        ProjectTask.Status.ON_HOLD,
        ProjectTask.Status.BLOCKED,
    ):
        raise ValidationError(
            {"status": "Only paused or blocked tasks can be resumed."}
        )
    payload = {"status": ProjectTask.Status.IN_PROGRESS}
    if task.actual_start is None:
        payload["actual_start"] = timezone.localdate()
    return update_task(task=task, data=payload, actor=actor)


def complete_task(*, task, actor, actual_end=None):
    """Mark assigned task completed at 100%."""
    _ensure_execution_actor(actor=actor, task=task)
    if task.status == ProjectTask.Status.CANCELLED:
        raise ValidationError({"status": "Cancelled tasks cannot be completed."})
    end_date = actual_end or timezone.localdate()
    if isinstance(end_date, str):
        end_date = date.fromisoformat(end_date)
    payload = {
        "status": ProjectTask.Status.COMPLETED,
        "progress_percentage": Decimal("100.00"),
        "actual_end": end_date,
    }
    if task.actual_start is None:
        payload["actual_start"] = end_date
    return update_task(task=task, data=payload, actor=actor)


def update_task_progress(*, task, actor, progress_percentage):
    """Update progress 0–100 with FO-104 sync / FO-107 recalculation."""
    _ensure_execution_actor(actor=actor, task=task)
    progress = Decimal(str(progress_percentage))
    payload = {"progress_percentage": progress}
    # Drive status from progress for technician execution convenience.
    if progress <= Decimal("0.00"):
        if task.status == ProjectTask.Status.IN_PROGRESS:
            # Keep in_progress clamp (model forces >= 1) — set status not_started
            # only when explicitly zeroing from a non-active state is requested.
            payload["status"] = ProjectTask.Status.NOT_STARTED
        else:
            payload["status"] = ProjectTask.Status.NOT_STARTED
    elif progress >= Decimal("100.00"):
        payload["status"] = ProjectTask.Status.COMPLETED
        if task.actual_end is None:
            payload["actual_end"] = timezone.localdate()
        if task.actual_start is None:
            payload["actual_start"] = timezone.localdate()
    else:
        if task.status in (
            ProjectTask.Status.NOT_STARTED,
            ProjectTask.Status.COMPLETED,
        ):
            payload["status"] = ProjectTask.Status.IN_PROGRESS
        if task.actual_start is None:
            payload["actual_start"] = timezone.localdate()
    return update_task(task=task, data=payload, actor=actor)


def report_task_blocker(
    *,
    task,
    actor,
    title,
    description="",
    severity=None,
):
    """Create a Project Issue blocker linked contextually to the task."""
    _ensure_execution_actor(actor=actor, task=task)
    project = task.project
    severity_value = severity or BLOCKER_SEVERITY_DEFAULT
    body = (description or "").strip()
    if not body:
        body = f"Blocker reported while executing task {task.task_code}."
    issue = create_issue(
        project=project,
        actor=actor,
        data={
            "title": title.strip(),
            "description": body,
            "severity": severity_value,
            "status": ProjectIssue.Status.OPEN,
        },
    )
    return issue
