"""FO-107 Project progress & accomplishment tracking.

Accomplishment = arithmetic mean of included task progress values.
Included: not_started, in_progress, blocked, on_hold, completed
  (is_deleted=False, status != cancelled).
Milestones: incomplete → 0, completed → 100 (ignore intermediate %).
Rounding: Decimal HALF_UP to integer 0–100, stored as Decimal('NN.00').
Schedule elapsed is a separate optional metric — never mixed into accomplishment.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone

from .dependency_service import (
    batch_dependency_readiness,
    compute_delay_flags,
    is_task_scheduled,
)
from .models import Project, ProjectIssue, ProjectProgressSnapshot, ProjectTask

INCLUDED_TASK_STATUSES = frozenset(
    {
        ProjectTask.Status.NOT_STARTED,
        ProjectTask.Status.IN_PROGRESS,
        ProjectTask.Status.BLOCKED,
        ProjectTask.Status.ON_HOLD,
        ProjectTask.Status.COMPLETED,
    }
)

OPEN_ISSUE_STATUSES = frozenset(
    {
        ProjectIssue.Status.OPEN,
        ProjectIssue.Status.INVESTIGATING,
        ProjectIssue.Status.BLOCKED,
    }
)

HIGH_SEVERITIES = frozenset(
    {
        ProjectIssue.Severity.HIGH,
        ProjectIssue.Severity.CRITICAL,
    }
)

UPCOMING_DUE_DAYS = 14
UPCOMING_DUE_LIMIT = 10


def _as_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0.00")
    return Decimal(str(value))


def round_accomplishment(value: Decimal) -> Decimal:
    """HALF_UP to whole percent, stored as NN.00."""
    quantized = _as_decimal(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    if quantized < Decimal("0"):
        quantized = Decimal("0")
    elif quantized > Decimal("100"):
        quantized = Decimal("100")
    return Decimal(f"{int(quantized)}.00")


def _task_contribution(task: ProjectTask) -> Decimal:
    """Milestone incomplete=0 / completed=100; else use progress_percentage."""
    if task.is_milestone:
        if task.status == ProjectTask.Status.COMPLETED:
            return Decimal("100.00")
        return Decimal("0.00")
    return _as_decimal(task.progress_percentage)


def included_tasks_queryset(project):
    return ProjectTask.objects.filter(
        project=project,
        is_deleted=False,
        status__in=INCLUDED_TASK_STATUSES,
    )


def calculate_accomplishment(project) -> Decimal:
    """Return rounded project accomplishment Decimal('NN.00')."""
    tasks = list(included_tasks_queryset(project))
    if not tasks:
        return Decimal("0.00")
    total = sum((_task_contribution(task) for task in tasks), Decimal("0.00"))
    mean = total / Decimal(len(tasks))
    return round_accomplishment(mean)


def compute_schedule_elapsed_percentage(project, today=None) -> Decimal | None:
    """Optional schedule elapsed % — separate from accomplishment."""
    start = project.planned_start_date
    end = project.planned_end_date
    if not start or not end:
        return None
    today = today or timezone.localdate()
    span = (end - start).days
    if span <= 0:
        if today < start:
            return Decimal("0.00")
        return Decimal("100.00")
    elapsed = (today - start).days
    raw = (Decimal(elapsed) / Decimal(span)) * Decimal("100")
    if raw < Decimal("0"):
        raw = Decimal("0")
    elif raw > Decimal("100"):
        raw = Decimal("100")
    return round_accomplishment(raw)


def _snapshot_counts(project, *, tasks=None, today=None) -> dict:
    today = today or timezone.localdate()
    if tasks is None:
        tasks = list(project.tasks.filter(is_deleted=False))

    included = [t for t in tasks if t.status != ProjectTask.Status.CANCELLED]
    delayed = 0
    for task in included:
        if compute_delay_flags(task, today=today)["is_delayed"]:
            delayed += 1

    return {
        "included_task_count": len(included),
        "completed_task_count": sum(
            1 for t in included if t.status == ProjectTask.Status.COMPLETED
        ),
        "blocked_task_count": sum(
            1 for t in included if t.status == ProjectTask.Status.BLOCKED
        ),
        "delayed_task_count": delayed,
    }


def _task_summary_payload(task) -> dict | None:
    if task is None:
        return None
    return {
        "id": str(task.id),
        "task_code": task.task_code,
        "name": task.name,
        "status": task.status,
        "is_milestone": task.is_milestone,
        "planned_end": task.planned_end.isoformat() if task.planned_end else None,
        "progress_percentage": str(_as_decimal(task.progress_percentage)),
    }


def _actor_summary(actor) -> dict | None:
    if actor is None:
        return None
    full_name = f"{actor.first_name} {actor.last_name}".strip()
    return {
        "id": str(actor.id),
        "name": full_name or actor.email,
        "email": actor.email,
    }


def build_progress_summary(project, actor=None) -> dict:
    """Full FO-107 §8 progress summary dict."""
    today = timezone.localdate()
    tasks = list(
        project.tasks.filter(is_deleted=False).select_related("person_in_charge")
    )
    readiness = batch_dependency_readiness(tasks)

    included = [t for t in tasks if t.status != ProjectTask.Status.CANCELLED]
    excluded = [t for t in tasks if t.status == ProjectTask.Status.CANCELLED]

    not_started = sum(
        1 for t in tasks if t.status == ProjectTask.Status.NOT_STARTED
    )
    in_progress = sum(
        1 for t in tasks if t.status == ProjectTask.Status.IN_PROGRESS
    )
    blocked = sum(1 for t in tasks if t.status == ProjectTask.Status.BLOCKED)
    on_hold = sum(1 for t in tasks if t.status == ProjectTask.Status.ON_HOLD)
    completed = sum(1 for t in tasks if t.status == ProjectTask.Status.COMPLETED)
    cancelled = sum(1 for t in tasks if t.status == ProjectTask.Status.CANCELLED)

    milestones = [t for t in included if t.is_milestone]
    milestone_completed = [
        t for t in milestones if t.status == ProjectTask.Status.COMPLETED
    ]

    delayed_task_count = 0
    completed_late_count = 0
    dependency_blocked_count = 0
    unscheduled_task_count = 0
    for task in included:
        delay = compute_delay_flags(task, today=today)
        if delay["is_delayed"]:
            delayed_task_count += 1
        if delay["is_completed_late"]:
            completed_late_count += 1
        if not is_task_scheduled(task):
            unscheduled_task_count += 1
        ready = readiness.get(str(task.id), {}).get("is_dependency_ready", True)
        if not ready:
            dependency_blocked_count += 1

    issues = list(project.issues.filter(is_deleted=False))
    open_issues = [i for i in issues if i.status in OPEN_ISSUE_STATUSES]
    overdue_issue_count = sum(
        1
        for i in open_issues
        if i.due_date is not None and i.due_date < today
    )
    resolved_issue_count = sum(
        1
        for i in issues
        if i.status in ProjectIssue.RESOLVED_STATUSES
    )
    high_critical_open_count = sum(
        1 for i in open_issues if i.severity in HIGH_SEVERITIES
    )
    blocked_issue_count = sum(
        1 for i in open_issues if i.status == ProjectIssue.Status.BLOCKED
    )

    incomplete_milestones = sorted(
        [
            t
            for t in milestones
            if t.status != ProjectTask.Status.COMPLETED
        ],
        key=lambda t: (
            t.planned_end is None,
            t.planned_end or t.planned_start or today,
            t.sequence,
            t.created_at,
        ),
    )
    next_milestone = (
        _task_summary_payload(incomplete_milestones[0])
        if incomplete_milestones
        else None
    )

    upcoming_horizon = today + timedelta(days=UPCOMING_DUE_DAYS)
    upcoming_candidates = [
        t
        for t in included
        if t.status
        not in (ProjectTask.Status.COMPLETED, ProjectTask.Status.CANCELLED)
        and t.planned_end is not None
        and today <= t.planned_end <= upcoming_horizon
    ]
    upcoming_candidates.sort(key=lambda t: (t.planned_end, t.sequence, t.created_at))
    upcoming_due_tasks = [
        _task_summary_payload(t) for t in upcoming_candidates[:UPCOMING_DUE_LIMIT]
    ]

    latest_snapshot = (
        ProjectProgressSnapshot.objects.filter(project=project, is_deleted=False)
        .select_related("triggered_by", "related_task")
        .order_by("-recorded_at")
        .first()
    )
    previous_snapshot = None
    if latest_snapshot:
        previous_snapshot = (
            ProjectProgressSnapshot.objects.filter(
                project=project,
                is_deleted=False,
                recorded_at__lt=latest_snapshot.recorded_at,
            )
            .order_by("-recorded_at")
            .first()
        )

    accomplishment = calculate_accomplishment(project)
    # Prefer persisted value when already synced.
    project_completion = _as_decimal(project.completion_percentage)
    if project_completion != accomplishment:
        project_completion = accomplishment

    trend = "unchanged"
    if latest_snapshot and previous_snapshot:
        cur = _as_decimal(latest_snapshot.completion_percentage)
        prev = _as_decimal(previous_snapshot.completion_percentage)
        if cur > prev:
            trend = "increased"
        elif cur < prev:
            trend = "decreased"
    elif latest_snapshot and not previous_snapshot:
        trend = "unchanged"

    last_progress_update_at = None
    if latest_snapshot:
        last_progress_update_at = latest_snapshot.recorded_at
    else:
        latest_task_update = (
            ProjectTask.objects.filter(project=project, is_deleted=False)
            .order_by("-updated_at")
            .values_list("updated_at", flat=True)
            .first()
        )
        last_progress_update_at = latest_task_update

    schedule_elapsed = compute_schedule_elapsed_percentage(project, today=today)

    return {
        "project_id": str(project.id),
        "project_completion_percentage": str(project_completion),
        "schedule_elapsed_percentage": (
            str(schedule_elapsed) if schedule_elapsed is not None else None
        ),
        "included_task_count": len(included),
        "excluded_task_count": len(excluded),
        "total_task_count": len(tasks),
        "not_started_count": not_started,
        "in_progress_count": in_progress,
        "blocked_count": blocked,
        "on_hold_count": on_hold,
        "completed_count": completed,
        "cancelled_count": cancelled,
        "milestone_total": len(milestones),
        "milestone_completed": len(milestone_completed),
        "delayed_task_count": delayed_task_count,
        "completed_late_count": completed_late_count,
        "dependency_blocked_count": dependency_blocked_count,
        "unscheduled_task_count": unscheduled_task_count,
        "status_blocked_count": blocked,
        "open_issue_count": len(open_issues),
        "overdue_issue_count": overdue_issue_count,
        "resolved_issue_count": resolved_issue_count,
        "high_critical_open_issue_count": high_critical_open_count,
        "blocked_issue_count": blocked_issue_count,
        "next_milestone": next_milestone,
        "upcoming_due_tasks": upcoming_due_tasks,
        "last_progress_update_at": last_progress_update_at,
        "latest_snapshot": (
            serialize_progress_snapshot(latest_snapshot) if latest_snapshot else None
        ),
        "trend": trend,
    }


def serialize_progress_snapshot(snapshot: ProjectProgressSnapshot) -> dict:
    related = snapshot.related_task
    return {
        "id": str(snapshot.id),
        "completion_percentage": str(_as_decimal(snapshot.completion_percentage)),
        "included_task_count": snapshot.included_task_count,
        "completed_task_count": snapshot.completed_task_count,
        "blocked_task_count": snapshot.blocked_task_count,
        "delayed_task_count": snapshot.delayed_task_count,
        "recorded_at": snapshot.recorded_at,
        "source": snapshot.source,
        "triggered_by": _actor_summary(snapshot.triggered_by),
        "related_task": _task_summary_payload(related) if related_id_safe(related) else None,
    }


def related_id_safe(related):
    return related is not None and not getattr(related, "is_deleted", False)


def _snapshots_differ(latest, *, percentage, counts) -> bool:
    if latest is None:
        return True
    return (
        _as_decimal(latest.completion_percentage) != percentage
        or latest.included_task_count != counts["included_task_count"]
        or latest.completed_task_count != counts["completed_task_count"]
        or latest.blocked_task_count != counts["blocked_task_count"]
        or latest.delayed_task_count != counts["delayed_task_count"]
    )


@transaction.atomic
def recalculate_project_progress(
    project,
    *,
    actor=None,
    source,
    related_task=None,
):
    """Update completion_percentage; snapshot/history only when values change."""
    project = Project.objects.select_for_update().get(pk=project.pk)
    tasks = list(project.tasks.filter(is_deleted=False))
    new_percentage = calculate_accomplishment(project)
    counts = _snapshot_counts(project, tasks=tasks)
    previous_percentage = _as_decimal(project.completion_percentage)
    percentage_changed = previous_percentage != new_percentage

    actor_id = str(actor.id) if actor else None
    if percentage_changed:
        project.completion_percentage = new_percentage
        project.updated_by = actor_id
        project.save(
            update_fields=["completion_percentage", "updated_by", "updated_at"]
        )

    latest = (
        ProjectProgressSnapshot.objects.filter(project=project, is_deleted=False)
        .order_by("-recorded_at", "-created_at")
        .first()
    )

    snapshot = None
    if _snapshots_differ(latest, percentage=new_percentage, counts=counts):
        snapshot = ProjectProgressSnapshot.objects.create(
            tenant_id=project.tenant_id,
            project=project,
            completion_percentage=new_percentage,
            included_task_count=counts["included_task_count"],
            completed_task_count=counts["completed_task_count"],
            blocked_task_count=counts["blocked_task_count"],
            delayed_task_count=counts["delayed_task_count"],
            recorded_at=timezone.now(),
            source=source,
            triggered_by=actor,
            related_task=related_task,
            created_by=actor_id,
            updated_by=actor_id,
        )

    # Local import avoids circular import with services.py.
    from .services import record_history

    if percentage_changed:
        record_history(
            project=project,
            action="project_accomplishment_changed",
            description=(
                f"Project accomplishment changed from {previous_percentage} "
                f"to {new_percentage}."
            ),
            actor=actor,
            metadata={
                "from_percentage": str(previous_percentage),
                "to_percentage": str(new_percentage),
                "source": source,
                "related_task_id": (
                    str(related_task.id) if related_task is not None else None
                ),
                "project_id": str(project.id),
                "project_code": project.project_code,
            },
        )

    if source == ProjectProgressSnapshot.Source.MANUAL_RECALCULATION:
        record_history(
            project=project,
            action="project_progress_recalculated",
            description="Project progress manually recalculated.",
            actor=actor,
            metadata={
                "completion_percentage": str(new_percentage),
                "percentage_changed": percentage_changed,
                "snapshot_created": snapshot is not None,
                "project_id": str(project.id),
                "project_code": project.project_code,
            },
        )

    return {
        "project": project,
        "completion_percentage": new_percentage,
        "percentage_changed": percentage_changed,
        "snapshot": snapshot,
        "counts": counts,
    }


def resolve_recalculation_source(
    *,
    previous_status,
    new_status,
    progress_changed,
    status_changed,
    deleted=False,
) -> str | None:
    """Map task mutation to snapshot source; None if no recalc needed."""
    if deleted:
        return ProjectProgressSnapshot.Source.TASK_DELETED
    if status_changed and new_status == ProjectTask.Status.CANCELLED:
        return ProjectProgressSnapshot.Source.TASK_CANCELLED
    if status_changed:
        return ProjectProgressSnapshot.Source.TASK_STATUS_CHANGED
    if progress_changed:
        return ProjectProgressSnapshot.Source.TASK_PROGRESS_CHANGED
    return None


def build_progress_history_queryset(*, project, params=None):
    """Filtered progress snapshot queryset for history API."""
    from django.utils.dateparse import parse_date, parse_datetime

    params = params or {}
    queryset = (
        ProjectProgressSnapshot.objects.filter(project=project, is_deleted=False)
        .select_related("triggered_by", "related_task")
        .order_by("-recorded_at")
    )

    source = (params.get("source") or "").strip()
    if source:
        queryset = queryset.filter(source=source)

    raw_from = params.get("date_from")
    raw_to = params.get("date_to")
    if raw_from:
        parsed = parse_datetime(str(raw_from)) or parse_date(str(raw_from))
        if parsed is not None:
            if hasattr(parsed, "year") and not hasattr(parsed, "hour"):
                from datetime import datetime, time

                parsed = timezone.make_aware(
                    datetime.combine(parsed, time.min),
                    timezone.get_current_timezone(),
                )
            elif timezone.is_naive(parsed):
                parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
            queryset = queryset.filter(recorded_at__gte=parsed)
    if raw_to:
        parsed = parse_datetime(str(raw_to)) or parse_date(str(raw_to))
        if parsed is not None:
            if hasattr(parsed, "year") and not hasattr(parsed, "hour"):
                from datetime import datetime, time

                parsed = timezone.make_aware(
                    datetime.combine(parsed, time.max),
                    timezone.get_current_timezone(),
                )
            elif timezone.is_naive(parsed):
                parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
            queryset = queryset.filter(recorded_at__lte=parsed)

    ordering = (params.get("ordering") or "-recorded_at").strip()
    ordering_map = {
        "recorded_at": "recorded_at",
        "-recorded_at": "-recorded_at",
        "created_at": "created_at",
        "-created_at": "-created_at",
        "completion_percentage": "completion_percentage",
        "-completion_percentage": "-completion_percentage",
    }
    return queryset.order_by(ordering_map.get(ordering, "-recorded_at"))
