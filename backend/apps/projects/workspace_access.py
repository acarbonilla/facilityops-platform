"""FO-110 Technician Project workspace authorization.

Access strategy (implicit, no auto-membership):
A Technician may access a Project when they are an active ProjectMember
OR Person in Charge of at least one non-deleted, non-cancelled ProjectTask.

Users with broad Project authority (system_admin / projects.manage /
facility_manager) keep tenant-wide portfolio scope.
"""

from __future__ import annotations

from django.db.models import Q

from apps.access_control.services import get_user_roles, user_has_permission

from .models import ProjectMember, ProjectTask
from .tenant_scope import has_global_project_scope, user_can_access_tenant

TECHNICIAN_ROLE_CODE = "technician"

# Cancelled tasks never grant workspace access. Completed tasks still grant
# access so Technicians can review finished assigned work in context.
WORKSPACE_TASK_EXCLUDE_STATUSES = (ProjectTask.Status.CANCELLED,)

TECHNICIAN_TIMELINE_HIDDEN_ACTIONS = frozenset(
    {
        "member_added",
        "member_removed",
        "deleted",
        "dependency_created",
        "dependency_removed",
        "operational_link_created",
        "operational_link_updated",
        "operational_link_removed",
        "project_progress_recalculated",
        "note_deleted",
        "issue_deleted",
        "attachment_deleted",
    }
)

# Fields Technicians may change on their own assigned tasks (FO-110 MVP).
ASSIGNED_TASK_EDITABLE_FIELDS = frozenset(
    {
        "status",
        "progress_percentage",
        "actual_start",
        "actual_end",
        "description",
    }
)


def user_has_technician_role(user) -> bool:
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    return get_user_roles(user).filter(code=TECHNICIAN_ROLE_CODE).exists()


def user_has_broad_project_scope(user) -> bool:
    """Tenant-wide Project portfolio (unchanged FM / admin / manage behavior)."""
    if has_global_project_scope(user):
        return True
    if user_has_permission(user, "projects.manage"):
        return True
    if get_user_roles(user).filter(code="facility_manager").exists():
        return True
    return False


def user_uses_project_workspace_scope(user) -> bool:
    """Technicians (without broad scope) see only assigned/member Projects."""
    if user_has_broad_project_scope(user):
        return False
    return user_has_technician_role(user)


def _active_membership_q(user) -> Q:
    return Q(
        members__user_id=user.id,
        members__is_active=True,
        members__is_deleted=False,
    )


def _assigned_task_q(user) -> Q:
    return Q(
        tasks__person_in_charge_id=user.id,
        tasks__is_deleted=False,
    ) & ~Q(tasks__status__in=WORKSPACE_TASK_EXCLUDE_STATUSES)


def can_access_project_workspace(user, project) -> bool:
    """Reusable authorization: tenant + member OR PIC of non-cancelled task."""
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    if getattr(project, "is_deleted", False):
        return False
    if not user_can_access_tenant(user, project.tenant_id):
        return False
    if user_has_broad_project_scope(user):
        return True

    if ProjectMember.objects.filter(
        project_id=project.id,
        user_id=user.id,
        is_active=True,
        is_deleted=False,
    ).exists():
        return True

    if ProjectTask.objects.filter(
        project_id=project.id,
        person_in_charge_id=user.id,
        is_deleted=False,
    ).exclude(status=ProjectTask.Status.CANCELLED).exists():
        return True

    # Non-technician viewers with projects.view keep tenant-wide access.
    if not user_has_technician_role(user):
        return True

    return False


def apply_project_workspace_scope(queryset, user):
    """Narrow queryset for Technician workspace users only."""
    if not user_uses_project_workspace_scope(user):
        return queryset
    return queryset.filter(
        _active_membership_q(user) | _assigned_task_q(user)
    ).distinct()


def can_edit_assigned_project_task(user, task) -> bool:
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    if not user_uses_project_workspace_scope(user):
        return True
    return (
        task.person_in_charge_id == user.id
        and not task.is_deleted
        and task.status != ProjectTask.Status.CANCELLED
    )


def filter_timeline_actions_for_audience(actions, user):
    """Exclude administrative timeline actions for Technician workspace users."""
    if not user_uses_project_workspace_scope(user):
        return actions
    return [
        action
        for action in actions
        if action not in TECHNICIAN_TIMELINE_HIDDEN_ACTIONS
    ]
