from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from .models import (
    Project,
    ProjectHistory,
    ProjectIssue,
    ProjectIssueComment,
    ProjectMember,
    ProjectNote,
    ProjectTask,
    ProjectTaskChecklistItem,
    ProjectTaskComment,
)
from .tenant_scope import user_can_access_tenant


def record_history(*, project, action, description, actor=None, metadata=None):
    actor_id = str(actor.id) if actor else None
    return ProjectHistory.objects.create(
        project=project,
        actor=actor,
        action=action,
        description=description,
        metadata=metadata or {},
        created_by=actor_id,
        updated_by=actor_id,
    )


def sync_project_manager_membership(*, project, actor=None):
    """Ensure project_manager has an active PM membership; demote prior PMs."""
    if not project.project_manager_id:
        return None

    actor_id = str(actor.id) if actor else None
    previous_pms = ProjectMember.objects.filter(
        project=project,
        role=ProjectMember.Role.PROJECT_MANAGER,
        is_deleted=False,
        is_active=True,
    ).exclude(user_id=project.project_manager_id)

    for membership in previous_pms:
        membership.role = ProjectMember.Role.MEMBER
        membership.updated_by = actor_id
        membership.save(update_fields=["role", "updated_by", "updated_at"])

    existing = ProjectMember.objects.filter(
        project=project,
        user_id=project.project_manager_id,
        is_deleted=False,
    ).first()

    if existing:
        changed = False
        if existing.role != ProjectMember.Role.PROJECT_MANAGER:
            existing.role = ProjectMember.Role.PROJECT_MANAGER
            changed = True
        if not existing.is_active:
            existing.is_active = True
            changed = True
        if changed:
            existing.updated_by = actor_id
            existing.save(
                update_fields=["role", "is_active", "updated_by", "updated_at"]
            )
        return existing

    return ProjectMember.objects.create(
        tenant=project.tenant,
        project=project,
        user=project.project_manager,
        role=ProjectMember.Role.PROJECT_MANAGER,
        is_active=True,
        added_by=actor,
        created_by=actor_id,
        updated_by=actor_id,
    )


@transaction.atomic
def create_project(*, actor, data):
    organization = data["organization"]
    tenant = data.get("tenant") or organization.tenant
    if not user_can_access_tenant(actor, tenant.id):
        raise PermissionDenied("You cannot create projects for another tenant.")

    actor_id = str(actor.id)
    project = Project(
        tenant=tenant,
        created_by=actor_id,
        updated_by=actor_id,
        **{k: v for k, v in data.items() if k != "tenant"},
    )
    project.tenant = tenant
    project.save()

    sync_project_manager_membership(project=project, actor=actor)
    record_history(
        project=project,
        action="created",
        description="Project created.",
        actor=actor,
        metadata={"status": project.status, "project_code": project.project_code},
    )
    return project


@transaction.atomic
def update_project(*, project, data, actor=None):
    if "tenant" in data:
        data = {k: v for k, v in data.items() if k != "tenant"}

    if actor and not user_can_access_tenant(actor, project.tenant_id):
        raise PermissionDenied("You cannot update projects for another tenant.")

    changes = {}
    for field, value in data.items():
        previous_value = getattr(project, field)
        if previous_value != value:
            changes[field] = {
                "from": str(previous_value) if previous_value is not None else None,
                "to": str(value) if value is not None else None,
            }
            setattr(project, field, value)

    if not changes:
        return project

    actor_id = str(actor.id) if actor else None
    project.updated_by = actor_id
    project.save()

    if "project_manager" in changes:
        sync_project_manager_membership(project=project, actor=actor)

    record_history(
        project=project,
        action="updated",
        description="Project updated.",
        actor=actor,
        metadata={"changes": changes},
    )
    return project


@transaction.atomic
def soft_delete_project(*, project, actor):
    if not user_can_access_tenant(actor, project.tenant_id):
        raise PermissionDenied("You cannot delete projects for another tenant.")

    if project.status == Project.Status.COMPLETED:
        raise ValidationError(
            {"status": "Completed projects cannot be deleted."}
        )

    actor_id = str(actor.id) if actor else None
    project.is_deleted = True
    project.deleted_at = timezone.now()
    project.deleted_by = actor_id
    project.updated_by = actor_id
    project.save(
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
        action="deleted",
        description="Project soft-deleted.",
        actor=actor,
        metadata={"project_id": str(project.id)},
    )
    return project


@transaction.atomic
def add_project_member(*, project, user, role, actor=None):
    if not user_can_access_tenant(actor, project.tenant_id):
        raise PermissionDenied("You cannot manage members for another tenant.")

    if getattr(user, "tenant_id", None) != project.tenant_id:
        raise ValidationError({"user": "User must belong to the project tenant."})

    if not user.is_active:
        raise ValidationError(
            {"user": "Inactive users cannot be assigned as project members."}
        )

    if ProjectMember.objects.filter(
        project=project, user=user, is_deleted=False
    ).exists():
        raise ValidationError({"user": "User is already a member of this project."})

    actor_id = str(actor.id) if actor else None
    member = ProjectMember.objects.create(
        tenant=project.tenant,
        project=project,
        user=user,
        role=role,
        is_active=True,
        added_by=actor,
        created_by=actor_id,
        updated_by=actor_id,
    )
    record_history(
        project=project,
        action="member_added",
        description=f"Member {user.email} added as {role}.",
        actor=actor,
        metadata={"member_id": str(member.id), "user_id": str(user.id), "role": role},
    )
    return member


@transaction.atomic
def remove_project_member(*, member, actor):
    project = member.project
    if not user_can_access_tenant(actor, project.tenant_id):
        raise PermissionDenied("You cannot manage members for another tenant.")

    actor_id = str(actor.id) if actor else None
    member.is_deleted = True
    member.deleted_at = timezone.now()
    member.deleted_by = actor_id
    member.is_active = False
    member.updated_by = actor_id
    member.save(
        update_fields=(
            "is_deleted",
            "deleted_at",
            "deleted_by",
            "is_active",
            "updated_by",
            "updated_at",
        )
    )
    record_history(
        project=project,
        action="member_removed",
        description=f"Member {member.user.email} removed.",
        actor=actor,
        metadata={"member_id": str(member.id), "user_id": str(member.user_id)},
    )
    return member


def _task_history_metadata(task, **extra):
    payload = {
        "task_id": str(task.id),
        "task_code": task.task_code,
        "status": task.status,
    }
    payload.update(extra)
    return payload


def _ensure_project_access(*, actor, project):
    if actor and not user_can_access_tenant(actor, project.tenant_id):
        raise PermissionDenied("You cannot access projects for another tenant.")
    if project.is_deleted:
        raise ValidationError({"project": "Project not found."})


def build_task_summary(project):
    """Counts by status for FO-104 project detail integration."""
    qs = project.tasks.filter(is_deleted=False)
    return {
        "total": qs.count(),
        "not_started": qs.filter(status=ProjectTask.Status.NOT_STARTED).count(),
        "in_progress": qs.filter(status=ProjectTask.Status.IN_PROGRESS).count(),
        "blocked": qs.filter(status=ProjectTask.Status.BLOCKED).count(),
        "on_hold": qs.filter(status=ProjectTask.Status.ON_HOLD).count(),
        "completed": qs.filter(status=ProjectTask.Status.COMPLETED).count(),
        "cancelled": qs.filter(status=ProjectTask.Status.CANCELLED).count(),
    }


@transaction.atomic
def create_task(*, project, actor, data):
    """
    Create a project task.

    Assignment notifications are deferred (FO-104 boundary) — callers must not
    expect notification side-effects from create/assign.
    """
    _ensure_project_access(actor=actor, project=project)
    actor_id = str(actor.id) if actor else None

    payload = dict(data)
    if payload.get("sequence") is None:
        max_sequence = (
            ProjectTask.objects.filter(project=project, is_deleted=False)
            .order_by("-sequence")
            .values_list("sequence", flat=True)
            .first()
        )
        payload["sequence"] = (max_sequence or 0) + 1

    task = ProjectTask(
        tenant=project.tenant,
        project=project,
        created_by=actor_id,
        updated_by=actor_id,
        **payload,
    )
    task.save()

    record_history(
        project=project,
        action="task_created",
        description=f"Task {task.task_code} created.",
        actor=actor,
        metadata=_task_history_metadata(task, name=task.name),
    )
    if task.person_in_charge_id:
        # Notifications deferred — FO-104 does not emit assignment alerts.
        record_history(
            project=project,
            action="task_assigned",
            description=(
                f"Task {task.task_code} assigned to "
                f"{task.person_in_charge.email}."
            ),
            actor=actor,
            metadata=_task_history_metadata(
                task,
                person_in_charge_id=str(task.person_in_charge_id),
            ),
        )
    return task


@transaction.atomic
def update_task(*, task, data, actor=None):
    """
    Update a project task fields with FO-104 validation via model.clean.

    Assignment notifications are deferred (FO-104 boundary).
    FO-105: status→in_progress/completed is gated on FS dependency readiness.
    """
    from .dependency_service import assert_task_dependency_ready_for_status

    project = task.project
    _ensure_project_access(actor=actor, project=project)

    previous_status = task.status
    previous_progress = task.progress_percentage
    previous_pic_id = task.person_in_charge_id

    changes = {}
    for field, value in data.items():
        previous_value = getattr(task, field)
        if previous_value != value:
            changes[field] = {
                "from": str(previous_value) if previous_value is not None else None,
                "to": str(value) if value is not None else None,
            }
            setattr(task, field, value)

    if not changes:
        return task

    # Apply progress/status sync before dependency gate so coerced completed
    # (e.g. in_progress + 100%) is also checked.
    task.apply_progress_status_sync()
    if task.status != previous_status:
        assert_task_dependency_ready_for_status(
            task, target_status=task.status
        )

    actor_id = str(actor.id) if actor else None
    task.updated_by = actor_id
    task.save()

    record_history(
        project=project,
        action="task_updated",
        description=f"Task {task.task_code} updated.",
        actor=actor,
        metadata=_task_history_metadata(task, changes=changes),
    )

    if "status" in changes and task.status != previous_status:
        record_history(
            project=project,
            action="task_status_changed",
            description=(
                f"Task {task.task_code} status changed from "
                f"{previous_status} to {task.status}."
            ),
            actor=actor,
            metadata=_task_history_metadata(
                task,
                from_status=previous_status,
                to_status=task.status,
            ),
        )

    if (
        "progress_percentage" in changes
        and task.progress_percentage != previous_progress
    ):
        record_history(
            project=project,
            action="task_progress_changed",
            description=(
                f"Task {task.task_code} progress changed to "
                f"{task.progress_percentage}."
            ),
            actor=actor,
            metadata=_task_history_metadata(
                task,
                from_progress=str(previous_progress),
                to_progress=str(task.progress_percentage),
            ),
        )

    if task.person_in_charge_id != previous_pic_id:
        # Notifications deferred — FO-104 does not emit assignment alerts.
        record_history(
            project=project,
            action="task_assigned",
            description=(
                f"Task {task.task_code} assigned to "
                f"{getattr(task.person_in_charge, 'email', None)}."
            ),
            actor=actor,
            metadata=_task_history_metadata(
                task,
                person_in_charge_id=(
                    str(task.person_in_charge_id) if task.person_in_charge_id else None
                ),
                previous_person_in_charge_id=(
                    str(previous_pic_id) if previous_pic_id else None
                ),
            ),
        )

    return task


@transaction.atomic
def assign_task(*, task, person_in_charge, actor=None):
    """
    Assign PIC. Idempotent when the same PIC is already set.

    Assignment notifications are deferred (FO-104 boundary).
    """
    project = task.project
    _ensure_project_access(actor=actor, project=project)

    if task.person_in_charge_id == getattr(person_in_charge, "id", None):
        return task

    return update_task(
        task=task,
        data={"person_in_charge": person_in_charge},
        actor=actor,
    )


@transaction.atomic
def soft_delete_task(*, task, actor):
    """Allow soft-delete of any non-already-deleted task (including completed).

    FO-105: block when active dependencies exist as predecessor or successor.
    """
    from .dependency_service import assert_task_has_no_active_dependencies

    project = task.project
    _ensure_project_access(actor=actor, project=project)

    if task.is_deleted:
        raise ValidationError({"task": "Task is already deleted."})

    assert_task_has_no_active_dependencies(task)

    actor_id = str(actor.id) if actor else None
    task.is_deleted = True
    task.deleted_at = timezone.now()
    task.deleted_by = actor_id
    task.updated_by = actor_id
    task.save(
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
        action="task_deleted",
        description=f"Task {task.task_code} soft-deleted.",
        actor=actor,
        metadata=_task_history_metadata(task),
    )
    return task


@transaction.atomic
def reorder_tasks(*, project, task_ids, actor=None):
    _ensure_project_access(actor=actor, project=project)
    actor_id = str(actor.id) if actor else None

    tasks = list(
        ProjectTask.objects.select_for_update().filter(
            project=project,
            is_deleted=False,
            id__in=task_ids,
        )
    )
    by_id = {str(task.id): task for task in tasks}
    if len(by_id) != len(task_ids):
        raise ValidationError(
            {"task_ids": "One or more tasks were not found on this project."}
        )

    for index, task_id in enumerate(task_ids, start=1):
        task = by_id[str(task_id)]
        if task.sequence != index:
            task.sequence = index
            task.updated_by = actor_id
            # Bypass full_clean for sequence-only reorder.
            ProjectTask.objects.filter(pk=task.pk).update(
                sequence=index,
                updated_by=actor_id,
                updated_at=timezone.now(),
            )

    record_history(
        project=project,
        action="task_updated",
        description="Project tasks reordered.",
        actor=actor,
        metadata={"task_ids": [str(tid) for tid in task_ids]},
    )
    return list(
        ProjectTask.objects.filter(project=project, is_deleted=False).order_by(
            "sequence", "created_at"
        )
    )


@transaction.atomic
def create_checklist_item(*, task, text, actor=None, sequence=None, is_completed=False):
    project = task.project
    _ensure_project_access(actor=actor, project=project)
    actor_id = str(actor.id) if actor else None

    if sequence is None:
        max_sequence = (
            ProjectTaskChecklistItem.objects.filter(task=task, is_deleted=False)
            .order_by("-sequence")
            .values_list("sequence", flat=True)
            .first()
        )
        sequence = (max_sequence or 0) + 1

    item = ProjectTaskChecklistItem(
        tenant=task.tenant,
        task=task,
        text=text,
        sequence=sequence,
        is_completed=bool(is_completed),
        created_by=actor_id,
        updated_by=actor_id,
    )
    if item.is_completed:
        item.completed_by = actor
        item.completed_at = timezone.now()
    item.save()

    record_history(
        project=project,
        action="checklist_item_created",
        description=f"Checklist item added to {task.task_code}.",
        actor=actor,
        metadata=_task_history_metadata(
            task,
            checklist_item_id=str(item.id),
            text=item.text,
        ),
    )
    return item


@transaction.atomic
def update_checklist_item(*, item, data, actor=None):
    task = item.task
    project = task.project
    _ensure_project_access(actor=actor, project=project)
    actor_id = str(actor.id) if actor else None

    if "text" in data:
        item.text = data["text"]
    if "sequence" in data and data["sequence"] is not None:
        item.sequence = data["sequence"]
    if "is_completed" in data:
        was_completed = item.is_completed
        item.is_completed = bool(data["is_completed"])
        if item.is_completed and not was_completed:
            item.completed_by = actor
            item.completed_at = timezone.now()
        elif not item.is_completed:
            item.completed_by = None
            item.completed_at = None

    item.updated_by = actor_id
    item.save()

    action = "checklist_item_updated"
    if "is_completed" in data:
        action = (
            "checklist_item_completed"
            if item.is_completed
            else "checklist_item_reopened"
        )

    record_history(
        project=project,
        action=action,
        description=f"Checklist item updated on {task.task_code}.",
        actor=actor,
        metadata=_task_history_metadata(
            task,
            checklist_item_id=str(item.id),
            is_completed=item.is_completed,
        ),
    )
    return item


@transaction.atomic
def soft_delete_checklist_item(*, item, actor):
    task = item.task
    project = task.project
    _ensure_project_access(actor=actor, project=project)
    actor_id = str(actor.id) if actor else None

    item.is_deleted = True
    item.deleted_at = timezone.now()
    item.deleted_by = actor_id
    item.updated_by = actor_id
    item.save(
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
        action="checklist_item_deleted",
        description=f"Checklist item removed from {task.task_code}.",
        actor=actor,
        metadata=_task_history_metadata(
            task,
            checklist_item_id=str(item.id),
        ),
    )
    return item


@transaction.atomic
def add_task_comment(*, task, body, actor, is_internal=True):
    project = task.project
    _ensure_project_access(actor=actor, project=project)
    actor_id = str(actor.id) if actor else None

    comment = ProjectTaskComment(
        tenant=task.tenant,
        task=task,
        author=actor,
        body=body,
        is_internal=True if is_internal is None else bool(is_internal),
        created_by=actor_id,
        updated_by=actor_id,
    )
    comment.save()

    record_history(
        project=project,
        action="comment_added",
        description=f"Comment added to {task.task_code}.",
        actor=actor,
        metadata=_task_history_metadata(
            task,
            comment_id=str(comment.id),
        ),
    )
    return comment


@transaction.atomic
def soft_delete_task_comment(*, comment, actor):
    task = comment.task
    project = task.project
    _ensure_project_access(actor=actor, project=project)
    actor_id = str(actor.id) if actor else None

    comment.is_deleted = True
    comment.deleted_at = timezone.now()
    comment.deleted_by = actor_id
    comment.updated_by = actor_id
    comment.save(
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
        action="comment_deleted",
        description=f"Comment removed from {task.task_code}.",
        actor=actor,
        metadata=_task_history_metadata(
            task,
            comment_id=str(comment.id),
        ),
    )
    return comment

# ---------------------------------------------------------------------------
# FO-106 Notes & Issues
# ---------------------------------------------------------------------------


def _note_history_metadata(note, **extra):
    payload = {
        "note_id": str(note.id),
        "title": note.title,
        "category": note.category,
    }
    payload.update(extra)
    return payload


def _issue_history_metadata(issue, **extra):
    payload = {
        "issue_id": str(issue.id),
        "title": issue.title,
        "status": issue.status,
        "severity": issue.severity,
    }
    payload.update(extra)
    return payload


@transaction.atomic
def create_note(*, project, actor, data):
    _ensure_project_access(actor=actor, project=project)
    actor_id = str(actor.id) if actor else None
    note = ProjectNote(
        tenant=project.tenant,
        project=project,
        author=actor,
        created_by=actor_id,
        updated_by=actor_id,
        **data,
    )
    note.save()
    record_history(
        project=project,
        action="note_created",
        description=f"Note '{note.title}' created.",
        actor=actor,
        metadata=_note_history_metadata(note),
    )
    return note


@transaction.atomic
def update_note(*, note, data, actor=None):
    project = note.project
    _ensure_project_access(actor=actor, project=project)

    changes = {}
    for field, value in data.items():
        previous_value = getattr(note, field)
        if previous_value != value:
            changes[field] = {
                "from": str(previous_value) if previous_value is not None else None,
                "to": str(value) if value is not None else None,
            }
            setattr(note, field, value)

    if not changes:
        return note

    actor_id = str(actor.id) if actor else None
    note.updated_by = actor_id
    note.save()

    record_history(
        project=project,
        action="note_updated",
        description=f"Note '{note.title}' updated.",
        actor=actor,
        metadata=_note_history_metadata(note, changes=changes),
    )
    return note


@transaction.atomic
def soft_delete_note(*, note, actor):
    project = note.project
    _ensure_project_access(actor=actor, project=project)
    actor_id = str(actor.id) if actor else None

    note.is_deleted = True
    note.deleted_at = timezone.now()
    note.deleted_by = actor_id
    note.updated_by = actor_id
    note.save(
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
        action="note_deleted",
        description=f"Note '{note.title}' soft-deleted.",
        actor=actor,
        metadata=_note_history_metadata(note),
    )
    return note


@transaction.atomic
def create_issue(*, project, actor, data):
    """Create a project issue. Does not create FM tickets or notifications."""
    _ensure_project_access(actor=actor, project=project)
    actor_id = str(actor.id) if actor else None

    issue = ProjectIssue(
        tenant=project.tenant,
        project=project,
        created_by=actor_id,
        updated_by=actor_id,
        **data,
    )
    issue.apply_resolved_at(previous_status=None)
    issue.save()

    record_history(
        project=project,
        action="issue_created",
        description=f"Issue '{issue.title}' created.",
        actor=actor,
        metadata=_issue_history_metadata(issue),
    )
    return issue


@transaction.atomic
def update_issue(*, issue, data, actor=None):
    """Update issue fields. No FM ticket / notification side-effects."""
    project = issue.project
    _ensure_project_access(actor=actor, project=project)

    previous_status = issue.status
    changes = {}
    for field, value in data.items():
        previous_value = getattr(issue, field)
        if previous_value != value:
            changes[field] = {
                "from": str(previous_value) if previous_value is not None else None,
                "to": str(value) if value is not None else None,
            }
            setattr(issue, field, value)

    if not changes:
        return issue

    issue.apply_resolved_at(previous_status=previous_status)

    actor_id = str(actor.id) if actor else None
    issue.updated_by = actor_id
    issue.save()

    record_history(
        project=project,
        action="issue_updated",
        description=f"Issue '{issue.title}' updated.",
        actor=actor,
        metadata=_issue_history_metadata(issue, changes=changes),
    )

    if "status" in changes and issue.status != previous_status:
        record_history(
            project=project,
            action="issue_status_changed",
            description=(
                f"Issue '{issue.title}' status changed from "
                f"{previous_status} to {issue.status}."
            ),
            actor=actor,
            metadata=_issue_history_metadata(
                issue,
                from_status=previous_status,
                to_status=issue.status,
            ),
        )
    return issue


@transaction.atomic
def soft_delete_issue(*, issue, actor):
    project = issue.project
    _ensure_project_access(actor=actor, project=project)
    actor_id = str(actor.id) if actor else None

    issue.is_deleted = True
    issue.deleted_at = timezone.now()
    issue.deleted_by = actor_id
    issue.updated_by = actor_id
    issue.save(
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
        action="issue_deleted",
        description=f"Issue '{issue.title}' soft-deleted.",
        actor=actor,
        metadata=_issue_history_metadata(issue),
    )
    return issue


@transaction.atomic
def add_issue_comment(*, issue, body, actor, is_internal=True):
    project = issue.project
    _ensure_project_access(actor=actor, project=project)
    actor_id = str(actor.id) if actor else None

    comment = ProjectIssueComment(
        tenant=issue.tenant,
        issue=issue,
        author=actor,
        body=body,
        is_internal=True if is_internal is None else bool(is_internal),
        created_by=actor_id,
        updated_by=actor_id,
    )
    comment.save()

    record_history(
        project=project,
        action="issue_comment_added",
        description=f"Comment added to issue '{issue.title}'.",
        actor=actor,
        metadata=_issue_history_metadata(
            issue,
            comment_id=str(comment.id),
        ),
    )
    return comment


@transaction.atomic
def soft_delete_issue_comment(*, comment, actor):
    issue = comment.issue
    project = issue.project
    _ensure_project_access(actor=actor, project=project)
    actor_id = str(actor.id) if actor else None

    comment.is_deleted = True
    comment.deleted_at = timezone.now()
    comment.deleted_by = actor_id
    comment.updated_by = actor_id
    comment.save(
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
        action="issue_comment_deleted",
        description=f"Comment removed from issue '{issue.title}'.",
        actor=actor,
        metadata=_issue_history_metadata(
            issue,
            comment_id=str(comment.id),
        ),
    )
    return comment
