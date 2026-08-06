from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from .models import Project, ProjectHistory, ProjectMember
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
