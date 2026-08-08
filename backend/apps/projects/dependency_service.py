"""FO-105 task dependency & delay helpers.

Cycle detection builds a predecessor→successor adjacency list and walks it
with DFS/BFS in O(V+E). Soft-deleted dependencies and soft-deleted tasks are
excluded from the graph.
"""

from __future__ import annotations

from collections import defaultdict, deque
from datetime import date

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import ProjectTask, ProjectTaskDependency
from .services import _ensure_project_access, record_history
from .tenant_scope import user_can_access_tenant


def _active_dependency_qs(*, project_id=None):
    qs = ProjectTaskDependency.objects.filter(
        is_deleted=False,
        predecessor_task__is_deleted=False,
        successor_task__is_deleted=False,
        project__is_deleted=False,
    )
    if project_id is not None:
        qs = qs.filter(project_id=project_id)
    return qs


def would_create_cycle(
    project_id,
    predecessor_id,
    successor_id,
    *,
    exclude_dependency_id=None,
) -> bool:
    """Return True if adding predecessor→successor would introduce a cycle.

    Walks existing finish-to-start edges from ``successor_id`` toward its
    transitive successors. If ``predecessor_id`` is reachable, the new edge
    closes a cycle. Complexity: O(V+E) over active project tasks/deps.
    """
    predecessor_id = str(predecessor_id)
    successor_id = str(successor_id)
    if predecessor_id == successor_id:
        return True

    edges = _active_dependency_qs(project_id=project_id)
    if exclude_dependency_id:
        edges = edges.exclude(pk=exclude_dependency_id)

    adjacency = defaultdict(list)
    for pred_id, succ_id in edges.values_list(
        "predecessor_task_id", "successor_task_id"
    ):
        adjacency[str(pred_id)].append(str(succ_id))

    # BFS from the proposed successor: cycle iff we can reach the predecessor.
    queue = deque([successor_id])
    visited = {successor_id}
    while queue:
        current = queue.popleft()
        if current == predecessor_id:
            return True
        for nxt in adjacency.get(current, ()):
            if nxt not in visited:
                visited.add(nxt)
                queue.append(nxt)
    return False


def _blocking_predecessor_payload(task):
    return {
        "id": str(task.id),
        "task_code": task.task_code,
        "name": task.name,
        "status": task.status,
        "planned_end": (
            task.planned_end.isoformat() if task.planned_end else None
        ),
    }


def get_dependency_readiness(task) -> dict:
    """Derive FS readiness for a single task (no auto-status to blocked)."""
    predecessor_deps = list(
        _active_dependency_qs()
        .filter(successor_task_id=task.id)
        .select_related("predecessor_task")
    )
    successor_count = _active_dependency_qs().filter(
        predecessor_task_id=task.id
    ).count()

    blocking = [
        dep.predecessor_task
        for dep in predecessor_deps
        if dep.predecessor_task.status != ProjectTask.Status.COMPLETED
    ]
    return {
        "is_dependency_ready": len(blocking) == 0,
        "blocking_predecessor_count": len(blocking),
        "blocking_predecessors": [
            _blocking_predecessor_payload(pred) for pred in blocking
        ],
        "predecessor_count": len(predecessor_deps),
        "successor_count": successor_count,
    }


def batch_dependency_readiness(tasks) -> dict:
    """Map task_id(str) → readiness dict for list/gantt efficiency."""
    task_list = list(tasks)
    if not task_list:
        return {}

    task_ids = [task.id for task in task_list]
    task_id_set = set(task_ids)
    deps = list(
        _active_dependency_qs()
        .filter(
            Q(successor_task_id__in=task_ids) | Q(predecessor_task_id__in=task_ids)
        )
        .select_related("predecessor_task", "successor_task")
    )

    pred_by_successor = defaultdict(list)
    succ_by_predecessor = defaultdict(list)
    for dep in deps:
        if dep.successor_task_id in task_id_set:
            pred_by_successor[dep.successor_task_id].append(dep)
        if dep.predecessor_task_id in task_id_set:
            succ_by_predecessor[dep.predecessor_task_id].append(dep)

    result = {}
    for task in task_list:
        predecessor_deps = pred_by_successor.get(task.id, [])
        successor_deps = succ_by_predecessor.get(task.id, [])
        blocking = [
            dep.predecessor_task
            for dep in predecessor_deps
            if dep.predecessor_task.status != ProjectTask.Status.COMPLETED
        ]
        result[str(task.id)] = {
            "is_dependency_ready": len(blocking) == 0,
            "blocking_predecessor_count": len(blocking),
            "blocking_predecessors": [
                _blocking_predecessor_payload(pred) for pred in blocking
            ],
            "predecessor_count": len(predecessor_deps),
            "successor_count": len(successor_deps),
        }
    return result


def compute_delay_flags(task, today=None) -> dict:
    """Derived delay flags — never mutates task status."""
    today = today or timezone.localdate()
    if not isinstance(today, date):
        today = timezone.localdate()

    is_delayed = (
        task.status
        not in (ProjectTask.Status.COMPLETED, ProjectTask.Status.CANCELLED)
        and task.planned_end is not None
        and task.planned_end < today
        and task.actual_end is None
    )
    is_completed_late = (
        task.status == ProjectTask.Status.COMPLETED
        and task.actual_end is not None
        and task.planned_end is not None
        and task.actual_end > task.planned_end
    )

    if is_delayed:
        delay_days = (today - task.planned_end).days
    elif is_completed_late:
        delay_days = (task.actual_end - task.planned_end).days
    else:
        delay_days = 0

    return {
        "is_delayed": is_delayed,
        "is_completed_late": is_completed_late,
        "delay_days": delay_days,
    }


def is_task_scheduled(task) -> bool:
    """Scheduled when both planned_start and planned_end are set."""
    return task.planned_start is not None and task.planned_end is not None


def fs_schedule_conflict_message(*, predecessor, successor) -> str | None:
    """FO-114 Finish-to-Start day-level schedule consistency.

    When both tasks are fully scheduled, require:
      successor.planned_start >= predecessor.planned_end

    Same-day successor start after predecessor end date is allowed.
    Unscheduled either side does not create a schedule conflict.
    """
    if not is_task_scheduled(predecessor) or not is_task_scheduled(successor):
        return None
    if successor.planned_start >= predecessor.planned_end:
        return None
    return (
        "task_schedule_dependency_conflict: successor planned start "
        f"({successor.planned_start}) is before predecessor planned end "
        f"({predecessor.planned_end}) for Finish-to-Start dependency "
        f"{predecessor.task_code} → {successor.task_code}."
    )


def assert_task_dependency_ready_for_status(task, *, target_status):
    """Raise ValidationError when FS predecessors block status transition."""
    if target_status not in (
        ProjectTask.Status.IN_PROGRESS,
        ProjectTask.Status.COMPLETED,
    ):
        return

    readiness = get_dependency_readiness(task)
    if readiness["is_dependency_ready"]:
        return

    codes = [item["task_code"] for item in readiness["blocking_predecessors"]]
    codes_display = ", ".join(codes) if codes else "(unknown)"
    raise ValidationError(
        {
            "status": (
                f"Cannot change status to {target_status}: unfinished "
                f"predecessors must be completed first ({codes_display})."
            ),
            "code": "task_dependency_incomplete",
            "blocking_task_codes": codes,
        }
    )


@transaction.atomic
def create_dependency(
    *,
    project,
    predecessor_task,
    successor_task,
    actor=None,
    dependency_type=ProjectTaskDependency.DependencyType.FINISH_TO_START,
):
    _ensure_project_access(actor=actor, project=project)

    if dependency_type != ProjectTaskDependency.DependencyType.FINISH_TO_START:
        raise ValidationError(
            {
                "dependency_type": (
                    "Only finish_to_start dependencies are supported."
                )
            }
        )

    actor_id = str(actor.id) if actor else None
    dependency = ProjectTaskDependency(
        tenant=project.tenant,
        project=project,
        predecessor_task=predecessor_task,
        successor_task=successor_task,
        dependency_type=dependency_type,
        created_by=actor_id,
        updated_by=actor_id,
    )
    dependency.save()

    record_history(
        project=project,
        action="dependency_created",
        description=(
            f"Dependency created: {predecessor_task.task_code} → "
            f"{successor_task.task_code}."
        ),
        actor=actor,
        metadata={
            "dependency_id": str(dependency.id),
            "predecessor_task_id": str(predecessor_task.id),
            "successor_task_id": str(successor_task.id),
            "dependency_type": dependency.dependency_type,
        },
    )
    return dependency


@transaction.atomic
def soft_delete_dependency(*, dependency, actor):
    project = dependency.project
    if actor and not user_can_access_tenant(actor, project.tenant_id):
        raise PermissionDenied(
            "You cannot manage dependencies for another tenant."
        )
    if project.is_deleted:
        raise ValidationError({"project": "Project not found."})

    if dependency.is_deleted:
        raise ValidationError({"dependency": "Dependency is already deleted."})

    actor_id = str(actor.id) if actor else None
    dependency.is_deleted = True
    dependency.deleted_at = timezone.now()
    dependency.deleted_by = actor_id
    dependency.updated_by = actor_id
    dependency.save(
        update_fields=(
            "is_deleted",
            "deleted_at",
            "deleted_by",
            "updated_by",
            "updated_at",
        )
    )

    record_history(
        project=project,
        action="dependency_removed",
        description=(
            f"Dependency removed: {dependency.predecessor_task.task_code} → "
            f"{dependency.successor_task.task_code}."
        ),
        actor=actor,
        metadata={
            "dependency_id": str(dependency.id),
            "predecessor_task_id": str(dependency.predecessor_task_id),
            "successor_task_id": str(dependency.successor_task_id),
            "dependency_type": dependency.dependency_type,
        },
    )
    return dependency


def active_dependencies_for_task(task):
    """Return (as_predecessor, as_successor) active dependency querysets."""
    as_predecessor = _active_dependency_qs().filter(predecessor_task_id=task.id)
    as_successor = _active_dependency_qs().filter(successor_task_id=task.id)
    return as_predecessor, as_successor


def assert_task_has_no_active_dependencies(task):
    as_pred, as_succ = active_dependencies_for_task(task)
    pred_ids = list(as_pred.values_list("id", flat=True))
    succ_ids = list(as_succ.values_list("id", flat=True))
    if not pred_ids and not succ_ids:
        return

    raise ValidationError(
        {
            "task": (
                "Cannot delete task while active dependencies exist "
                f"({len(pred_ids)} as predecessor, {len(succ_ids)} as "
                "successor). Remove dependencies first."
            ),
            "predecessor_dependency_count": len(pred_ids),
            "successor_dependency_count": len(succ_ids),
            "predecessor_dependency_ids": [str(i) for i in pred_ids],
            "successor_dependency_ids": [str(i) for i in succ_ids],
        }
    )


def build_gantt_payload(project, *, today=None):
    """Assemble FO-105 gantt response for a non-deleted project."""
    today = today or timezone.localdate()
    tasks = list(
        ProjectTask.objects.filter(
            project=project,
            is_deleted=False,
            project__is_deleted=False,
        )
        .select_related("person_in_charge", "project", "tenant")
        .order_by("sequence", "created_at")
    )
    deps = list(
        _active_dependency_qs(project_id=project.id).order_by("created_at")
    )
    readiness_map = batch_dependency_readiness(tasks)

    pred_ids_by_task = defaultdict(list)
    succ_ids_by_task = defaultdict(list)
    for dep in deps:
        pred_ids_by_task[dep.successor_task_id].append(
            str(dep.predecessor_task_id)
        )
        succ_ids_by_task[dep.predecessor_task_id].append(
            str(dep.successor_task_id)
        )

    task_rows = []
    scheduled_count = 0
    milestone_count = 0
    delayed_count = 0
    blocked_count = 0

    for task in tasks:
        readiness = readiness_map.get(str(task.id)) or get_dependency_readiness(
            task
        )
        delay = compute_delay_flags(task, today=today)
        scheduled = is_task_scheduled(task)
        if scheduled:
            scheduled_count += 1
        if task.is_milestone:
            milestone_count += 1
        if delay["is_delayed"]:
            delayed_count += 1
        if not readiness["is_dependency_ready"]:
            blocked_count += 1

        task_rows.append(
            {
                "id": str(task.id),
                "tenant": str(task.tenant_id),
                "project": str(task.project_id),
                "task_code": task.task_code,
                "name": task.name,
                "description": task.description,
                "person_in_charge": (
                    str(task.person_in_charge_id)
                    if task.person_in_charge_id
                    else None
                ),
                "person_in_charge_email": getattr(
                    task.person_in_charge, "email", None
                ),
                "status": task.status,
                "priority": task.priority,
                "planned_start": (
                    task.planned_start.isoformat() if task.planned_start else None
                ),
                "planned_end": (
                    task.planned_end.isoformat() if task.planned_end else None
                ),
                "actual_start": (
                    task.actual_start.isoformat() if task.actual_start else None
                ),
                "actual_end": (
                    task.actual_end.isoformat() if task.actual_end else None
                ),
                "progress_percentage": str(task.progress_percentage),
                "sequence": task.sequence,
                "is_milestone": task.is_milestone,
                "is_dependency_ready": readiness["is_dependency_ready"],
                "blocking_predecessor_count": readiness[
                    "blocking_predecessor_count"
                ],
                "predecessor_count": readiness["predecessor_count"],
                "successor_count": readiness["successor_count"],
                "is_delayed": delay["is_delayed"],
                "is_completed_late": delay["is_completed_late"],
                "delay_days": delay["delay_days"],
                "predecessor_ids": pred_ids_by_task.get(task.id, []),
                "successor_ids": succ_ids_by_task.get(task.id, []),
                "is_scheduled": scheduled,
                "created_at": task.created_at,
                "updated_at": task.updated_at,
            }
        )

    return {
        "project": {
            "id": str(project.id),
            "project_code": project.project_code,
            "name": project.name,
            "status": project.status,
            "priority": project.priority,
            "planned_start_date": project.planned_start_date,
            "planned_end_date": project.planned_end_date,
            "organization": str(project.organization_id),
            "tenant": str(project.tenant_id),
        },
        "tasks": task_rows,
        "dependencies": [
            {
                "id": str(dep.id),
                "predecessor_task_id": str(dep.predecessor_task_id),
                "successor_task_id": str(dep.successor_task_id),
                "dependency_type": dep.dependency_type,
            }
            for dep in deps
        ],
        "summary": {
            "total_tasks": len(tasks),
            "scheduled_tasks": scheduled_count,
            "unscheduled_tasks": len(tasks) - scheduled_count,
            "milestones": milestone_count,
            "delayed_tasks": delayed_count,
            "dependency_blocked_tasks": blocked_count,
        },
    }
