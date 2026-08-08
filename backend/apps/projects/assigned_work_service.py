"""FO-112 Technician assigned-work dashboard projection.

Dashboard is a read-only projection over Project / ProjectTask / ProjectIssue.
No stored TechnicianDashboard model. Identity is always the authenticated user.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone

from .dependency_service import batch_dependency_readiness, compute_delay_flags
from .models import Project, ProjectIssue, ProjectMember, ProjectTask
from .tenant_scope import scope_projects_to_user
from .workspace_access import user_uses_project_workspace_scope

RECENTLY_COMPLETED_DAYS = 14
UPCOMING_LIMIT = 8
ASSIGNED_LIST_DEFAULT_LIMIT = 50
OPEN_ISSUE_STATUSES = (
    ProjectIssue.Status.OPEN,
    ProjectIssue.Status.INVESTIGATING,
    ProjectIssue.Status.BLOCKED,
)
ACTIVE_TASK_EXCLUDE = (
    ProjectTask.Status.COMPLETED,
    ProjectTask.Status.CANCELLED,
)


def _today(today=None) -> date:
    return today or timezone.localdate()


def end_of_week(today: date) -> date:
    """Sunday end of the ISO week containing `today` (Mon=0 … Sun=6)."""
    return today + timedelta(days=(6 - today.weekday()))


def assigned_tasks_queryset(user, *, include_completed=True):
    """PIC-assigned tasks for the authenticated user (tenant-scoped via project)."""
    qs = (
        ProjectTask.objects.filter(
            is_deleted=False,
            person_in_charge_id=user.id,
            project__is_deleted=False,
        )
        .exclude(status=ProjectTask.Status.CANCELLED)
        .select_related(
            "project",
            "project__project_manager",
            "person_in_charge",
        )
        .prefetch_related("checklist_items")
    )
    if not include_completed:
        qs = qs.exclude(status=ProjectTask.Status.COMPLETED)

    # Intersect with projects the user may access (workspace / tenant scope).
    accessible_project_ids = scope_projects_to_user(
        Project.objects.filter(is_deleted=False),
        user,
    ).values_list("id", flat=True)
    return qs.filter(project_id__in=accessible_project_ids)


def apply_assigned_work_filters(queryset, params):
    """Optional filters for dashboard and full assigned-work list."""
    project_id = (params.get("project") or params.get("project_id") or "").strip()
    if project_id:
        queryset = queryset.filter(project_id=project_id)

    status_value = (params.get("status") or "").strip()
    if status_value:
        queryset = queryset.filter(status=status_value)

    priority = (params.get("priority") or "").strip()
    if priority:
        queryset = queryset.filter(priority=priority)

    search = (params.get("search") or "").strip()
    if search:
        queryset = queryset.filter(
            Q(name__icontains=search)
            | Q(task_code__icontains=search)
            | Q(project__name__icontains=search)
            | Q(project__project_code__icontains=search)
        )

    date_from = (params.get("date_from") or "").strip()
    date_to = (params.get("date_to") or "").strip()
    if date_from:
        queryset = queryset.filter(planned_end__gte=date_from)
    if date_to:
        queryset = queryset.filter(planned_end__lte=date_to)

    return queryset


def _checklist_counts(task) -> dict:
    items = list(task.checklist_items.all()) if hasattr(task, "checklist_items") else []
    # Soft-deleted checklist rows may still be prefetched; keep active only.
    active = [item for item in items if not getattr(item, "is_deleted", False)]
    total = len(active)
    completed = sum(1 for item in active if item.is_completed)
    return {
        "checklist_total": total,
        "checklist_completed": completed,
        "checklist_completion_label": f"{completed}/{total}" if total else "0/0",
    }


def serialize_assigned_task(task, *, readiness=None, today=None) -> dict:
    today = _today(today)
    delay = compute_delay_flags(task, today=today)
    ready = readiness or {
        "is_dependency_ready": True,
        "blocking_predecessor_count": 0,
    }
    checklist = _checklist_counts(task)
    project = task.project
    return {
        "id": str(task.id),
        "task_code": task.task_code,
        "name": task.name,
        "status": task.status,
        "priority": task.priority,
        "progress_percentage": str(task.progress_percentage),
        "planned_start": task.planned_start.isoformat() if task.planned_start else None,
        "planned_end": task.planned_end.isoformat() if task.planned_end else None,
        "actual_start": task.actual_start.isoformat() if task.actual_start else None,
        "actual_end": task.actual_end.isoformat() if task.actual_end else None,
        "project_id": str(project.id),
        "project_code": project.project_code,
        "project_name": project.name,
        "is_delayed": delay["is_delayed"],
        "delay_days": delay["delay_days"],
        "is_dependency_ready": ready.get("is_dependency_ready", True),
        "blocking_predecessor_count": ready.get("blocking_predecessor_count", 0),
        "block_reason": _block_reason(task, ready),
        **checklist,
    }


def _block_reason(task, readiness) -> str | None:
    if task.status == ProjectTask.Status.BLOCKED:
        return "status_blocked"
    if task.status == ProjectTask.Status.ON_HOLD:
        return "paused"
    if not readiness.get("is_dependency_ready", True):
        return "waiting_predecessor"
    return None


def sort_assigned_tasks(tasks_payload: list[dict], today: date) -> list[dict]:
    """Sort: overdue → due today → in progress → upcoming → unscheduled → other."""

    def rank(row: dict) -> tuple:
        status = row["status"]
        planned_end = row["planned_end"]
        planned_start = row["planned_start"]
        if row.get("is_delayed"):
            return (0, -(row.get("delay_days") or 0), row["task_code"])
        if planned_end == today.isoformat() and status not in ACTIVE_TASK_EXCLUDE:
            return (1, row["priority"], row["task_code"])
        if status == ProjectTask.Status.IN_PROGRESS:
            return (2, planned_end or "9999", row["task_code"])
        if (
            status == ProjectTask.Status.NOT_STARTED
            and planned_start
            and planned_start > today.isoformat()
        ):
            return (3, planned_start, row["task_code"])
        if planned_start is None or planned_end is None:
            return (4, row["task_code"])
        return (5, planned_end or "9999", row["task_code"])

    return sorted(tasks_payload, key=rank)


def _my_projects_payload(user, assigned_tasks, today) -> list[dict]:
    project_ids_from_tasks = {task.project_id for task in assigned_tasks}
    member_project_ids = set(
        ProjectMember.objects.filter(
            user_id=user.id,
            is_active=True,
            is_deleted=False,
            project__is_deleted=False,
        ).values_list("project_id", flat=True)
    )
    project_ids = project_ids_from_tasks | member_project_ids
    if not project_ids:
        return []

    projects = (
        scope_projects_to_user(
            Project.objects.filter(id__in=project_ids, is_deleted=False),
            user,
        )
        .select_related("project_manager")
        .order_by("project_code")
    )

    by_project = defaultdict(list)
    for task in assigned_tasks:
        by_project[task.project_id].append(task)

    rows = []
    for project in projects:
        mine = by_project.get(project.id, [])
        active = [t for t in mine if t.status not in ACTIVE_TASK_EXCLUDE]
        completed = [t for t in mine if t.status == ProjectTask.Status.COMPLETED]
        overdue = [
            t
            for t in active
            if compute_delay_flags(t, today=today)["is_delayed"]
        ]
        rows.append(
            {
                "id": str(project.id),
                "project_code": project.project_code,
                "name": project.name,
                "status": project.status,
                "accomplishment_percentage": str(
                    project.completion_percentage
                    if project.completion_percentage is not None
                    else Decimal("0.00")
                ),
                "planned_end_date": (
                    project.planned_end_date.isoformat()
                    if project.planned_end_date
                    else None
                ),
                "project_manager_id": (
                    str(project.project_manager_id)
                    if project.project_manager_id
                    else None
                ),
                "project_manager_email": (
                    project.project_manager.email
                    if project.project_manager_id
                    else None
                ),
                "my_task_count": len(active) + len(completed),
                "my_completed_task_count": len(completed),
                "my_overdue_task_count": len(overdue),
            }
        )
    return rows


def _open_blockers_for_user(user, project_ids, limit=10) -> list[dict]:
    if not project_ids:
        return []
    actor_id = str(user.id)
    issues = (
        ProjectIssue.objects.filter(
            is_deleted=False,
            project_id__in=project_ids,
            status__in=OPEN_ISSUE_STATUSES,
            created_by=actor_id,
        )
        .select_related("project")
        .order_by("-created_at")[:limit]
    )
    return [
        {
            "id": str(issue.id),
            "title": issue.title,
            "status": issue.status,
            "severity": issue.severity,
            "project_id": str(issue.project_id),
            "project_code": issue.project.project_code,
            "project_name": issue.project.name,
            "created_at": issue.created_at.isoformat(),
        }
        for issue in issues
    ]


def build_technician_assigned_work(user, *, today=None, params=None) -> dict:
    """Curated dashboard payload for GET /api/projects/my-work/."""
    today = _today(today)
    params = params or {}
    week_end = end_of_week(today)
    recent_since = today - timedelta(days=RECENTLY_COMPLETED_DAYS)

    base = apply_assigned_work_filters(
        assigned_tasks_queryset(user, include_completed=True),
        params,
    )
    tasks = list(base.order_by("planned_end", "task_code")[:200])
    readiness = batch_dependency_readiness(tasks)

    active = [t for t in tasks if t.status not in ACTIVE_TASK_EXCLUDE]
    completed = [t for t in tasks if t.status == ProjectTask.Status.COMPLETED]

    def payload(task):
        return serialize_assigned_task(
            task,
            readiness=readiness.get(str(task.id)),
            today=today,
        )

    today_work = []
    due_today = []
    due_this_week = []
    overdue = []
    blocked = []
    upcoming = []
    unscheduled = []

    for task in active:
        row = payload(task)
        ready = readiness.get(str(task.id), {})
        delay = compute_delay_flags(task, today=today)

        if delay["is_delayed"]:
            overdue.append(row)

        if task.planned_end == today:
            due_today.append(row)

        if (
            task.planned_end is not None
            and today < task.planned_end <= week_end
            and not delay["is_delayed"]
        ):
            due_this_week.append(row)

        in_window = (
            task.planned_start is not None
            and task.planned_end is not None
            and task.planned_start <= today <= task.planned_end
        )
        due_is_today = task.planned_end == today
        if (
            in_window
            or due_is_today
            or task.status == ProjectTask.Status.IN_PROGRESS
        ):
            today_work.append(row)

        if (
            task.status == ProjectTask.Status.BLOCKED
            or task.status == ProjectTask.Status.ON_HOLD
            or not ready.get("is_dependency_ready", True)
        ):
            blocked.append(row)

        if (
            task.status == ProjectTask.Status.NOT_STARTED
            and task.planned_start is not None
            and task.planned_start > today
        ):
            upcoming.append(row)

        if task.planned_start is None or task.planned_end is None:
            unscheduled.append(row)

    upcoming = sorted(
        upcoming,
        key=lambda r: (r["planned_start"] or "9999", r["task_code"]),
    )[:UPCOMING_LIMIT]

    recently_completed = []
    for task in completed:
        end = task.actual_end
        if end is None:
            continue
        if end < recent_since:
            continue
        recently_completed.append(payload(task))
    recently_completed = sorted(
        recently_completed,
        key=lambda r: (r["actual_end"] or "", r["task_code"]),
        reverse=True,
    )[:15]

    projects = _my_projects_payload(user, tasks, today)
    project_ids = [p["id"] for p in projects]
    blockers = _open_blockers_for_user(user, project_ids)

    in_progress_count = sum(
        1 for t in active if t.status == ProjectTask.Status.IN_PROGRESS
    )
    status_blocked_count = sum(
        1 for t in active if t.status == ProjectTask.Status.BLOCKED
    )
    paused_count = sum(1 for t in active if t.status == ProjectTask.Status.ON_HOLD)
    dependency_blocked_count = sum(
        1
        for t in active
        if not readiness.get(str(t.id), {}).get("is_dependency_ready", True)
    )

    summary = {
        "my_projects": len(projects),
        "my_assigned_tasks": len(active),
        "in_progress": in_progress_count,
        "overdue": len(overdue),
        "due_today": len(due_today),
        "due_this_week": len(due_this_week),
        "blocked_or_paused": len(blocked),
        "status_blocked": status_blocked_count,
        "paused": paused_count,
        "dependency_blocked": dependency_blocked_count,
        "completed_recently": len(recently_completed),
        "unscheduled": len(unscheduled),
        "upcoming": len(upcoming),
    }

    workload = {
        "assigned": summary["my_assigned_tasks"],
        "in_progress": summary["in_progress"],
        "overdue": summary["overdue"],
        "blocked": summary["status_blocked"] + summary["dependency_blocked"],
        "paused": summary["paused"],
        "completed": len(completed),
    }

    assigned_preview = sort_assigned_tasks(
        [payload(t) for t in active],
        today,
    )[:ASSIGNED_LIST_DEFAULT_LIMIT]

    return {
        "as_of": today.isoformat(),
        "week_end": week_end.isoformat(),
        "summary": summary,
        "workload": workload,
        "projects": projects,
        "assigned_tasks": assigned_preview,
        "today": sort_assigned_tasks(today_work, today),
        "due_today": due_today,
        "due_this_week": due_this_week,
        "overdue": sorted(overdue, key=lambda r: (-(r["delay_days"] or 0), r["task_code"])),
        "blocked": blocked,
        "upcoming": upcoming,
        "unscheduled": unscheduled,
        "recently_completed": recently_completed,
        "blockers": blockers,
        "workspace_scoped": user_uses_project_workspace_scope(user),
    }


def list_technician_assigned_tasks(user, *, params=None, today=None):
    """Full assigned-work list projection (caller may paginate)."""
    today = _today(today)
    params = params or {}
    include_completed = (params.get("include_completed") or "").lower() in (
        "1",
        "true",
        "yes",
    )
    qs = apply_assigned_work_filters(
        assigned_tasks_queryset(user, include_completed=include_completed),
        params,
    )
    tasks = list(qs.order_by("planned_end", "task_code")[:500])
    readiness = batch_dependency_readiness(tasks)
    rows = [
        serialize_assigned_task(
            task,
            readiness=readiness.get(str(task.id)),
            today=today,
        )
        for task in tasks
    ]
    return sort_assigned_tasks(rows, today)


def user_can_access_my_work(user) -> bool:
    """Authenticated users with projects.view (or manage) may open My Work."""
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    from apps.access_control.services import user_has_permission

    return (
        user_has_permission(user, "projects.view")
        or user_has_permission(user, "projects.manage")
        or user_has_permission(user, "projects.tasks.view")
    )
