"""FO-115C Project Manager and Task PIC assignment eligibility.

Authoritative rules (server-side):
- Project Manager: active same-tenant user with Facility Manager role
  and/or `projects.manage` capability (covers System Admin when tenant-bound).
- Task PIC: active same-tenant Technician, or the Project's current
  Project Manager (self-assignment). Not Employee/Viewer by membership alone.
- PIC assignment does not create ProjectMember (FO-110 implicit workspace).
"""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db.models import Q, Prefetch

from apps.access_control.models import UserRole
from apps.access_control.services import get_user_roles, user_has_permission

from .models import ProjectMember
from .workspace_access import TECHNICIAN_ROLE_CODE, user_has_technician_role

User = get_user_model()

FACILITY_MANAGER_ROLE_CODE = "facility_manager"
PROJECT_MANAGE_PERMISSION = "projects.manage"

INVALID_PROJECT_MANAGER = "invalid_project_manager"
INVALID_TASK_PIC = "invalid_task_pic"

DEFAULT_OPTIONS_LIMIT = 50


def _display_name(user) -> str:
    first = (getattr(user, "first_name", "") or "").strip()
    last = (getattr(user, "last_name", "") or "").strip()
    full = f"{first} {last}".strip()
    return full or (getattr(user, "email", "") or str(user.pk))


def _primary_role_label(user) -> str:
    roles = list(get_user_roles(user))
    if not roles:
        return "User"
    # Prefer management / technician labels when present.
    by_code = {role.code: role.name for role in roles}
    for code in (
        "system_admin",
        FACILITY_MANAGER_ROLE_CODE,
        TECHNICIAN_ROLE_CODE,
        "viewer",
        "employee",
        "inspector",
    ):
        if code in by_code:
            return by_code[code]
    return roles[0].name


def user_is_eligible_project_manager(user) -> bool:
    """Facility Manager role and/or projects.manage (tenant-scoped user)."""
    if not getattr(user, "is_authenticated", False) and not getattr(
        user, "pk", None
    ):
        return False
    if not getattr(user, "is_active", False):
        return False
    if user_has_permission(user, PROJECT_MANAGE_PERMISSION):
        return True
    return get_user_roles(user).filter(code=FACILITY_MANAGER_ROLE_CODE).exists()


def user_is_eligible_task_pic(user, project) -> bool:
    """Technician or this Project's Project Manager (self-assignment)."""
    if user is None or project is None:
        return False
    if not getattr(user, "is_active", False):
        return False
    if getattr(user, "tenant_id", None) != getattr(project, "tenant_id", None):
        return False
    if project.project_manager_id and user.id == project.project_manager_id:
        return True
    return user_has_technician_role(user)


def validate_project_manager(
    user,
    *,
    tenant_id,
    field="project_manager",
    allow_legacy_unchanged=False,
    previous_manager_id=None,
):
    """Raise ValidationError when user is not an eligible Project Manager."""
    if user is None:
        return
    if getattr(user, "tenant_id", None) != tenant_id:
        raise ValidationError(
            {
                field: ValidationError(
                    "Project manager must belong to the selected tenant.",
                    code=INVALID_PROJECT_MANAGER,
                )
            }
        )
    if not user.is_active:
        raise ValidationError(
            {
                field: ValidationError(
                    "Project manager must be an active user.",
                    code=INVALID_PROJECT_MANAGER,
                )
            }
        )
    if user_is_eligible_project_manager(user):
        return
    if (
        allow_legacy_unchanged
        and previous_manager_id is not None
        and previous_manager_id == user.id
    ):
        # Legacy Project keeps existing invalid manager until next change.
        return
    raise ValidationError(
        {
            field: ValidationError(
                "Project manager must be an eligible Facility Manager "
                "or Project management user.",
                code=INVALID_PROJECT_MANAGER,
            )
        }
    )


def validate_task_pic(
    user,
    project,
    *,
    field="person_in_charge",
    allow_legacy_unchanged=False,
    previous_pic_id=None,
):
    """Raise ValidationError when user is not an eligible Task PIC."""
    if user is None:
        return
    if getattr(user, "tenant_id", None) != getattr(project, "tenant_id", None):
        raise ValidationError(
            {
                field: ValidationError(
                    "Person in charge must belong to the project tenant.",
                    code=INVALID_TASK_PIC,
                )
            }
        )
    if not user.is_active:
        raise ValidationError(
            {
                field: ValidationError(
                    "Person in charge must be an active user.",
                    code=INVALID_TASK_PIC,
                )
            }
        )
    if user_is_eligible_task_pic(user, project):
        return
    if (
        allow_legacy_unchanged
        and previous_pic_id is not None
        and previous_pic_id == user.id
    ):
        return
    raise ValidationError(
        {
            field: ValidationError(
                "Person in charge must be an active Technician or the "
                "Project Manager.",
                code=INVALID_TASK_PIC,
            )
        }
    )


def _apply_user_search(queryset, search: str):
    term = (search or "").strip()
    if not term:
        return queryset
    return queryset.filter(
        Q(email__icontains=term)
        | Q(first_name__icontains=term)
        | Q(last_name__icontains=term)
    )


def _users_base_qs(*, tenant_id):
    return (
        User.objects.filter(is_active=True, tenant_id=tenant_id)
        .prefetch_related(
            Prefetch(
                "user_roles",
                queryset=UserRole.objects.select_related("role").filter(
                    is_deleted=False
                ),
            )
        )
        .order_by("first_name", "last_name", "email")
    )


def eligible_project_managers(*, tenant_id, search="", limit=DEFAULT_OPTIONS_LIMIT):
    """Active same-tenant users eligible to own/manage Projects."""
    qs = _apply_user_search(_users_base_qs(tenant_id=tenant_id), search)
    qs = qs.filter(
        Q(
            user_roles__is_active=True,
            user_roles__is_deleted=False,
            user_roles__role__is_active=True,
            user_roles__role__code__in=(
                FACILITY_MANAGER_ROLE_CODE,
                "system_admin",
            ),
        )
        | Q(
            user_roles__is_active=True,
            user_roles__is_deleted=False,
            user_roles__role__is_active=True,
            user_roles__role__role_permissions__is_active=True,
            user_roles__role__role_permissions__permission__is_active=True,
            user_roles__role__role_permissions__permission__code=(
                PROJECT_MANAGE_PERMISSION
            ),
        )
    ).distinct()
    # Final capability gate (handles superuser edge cases consistently).
    eligible = [u for u in qs[: max(limit * 2, 50)] if user_is_eligible_project_manager(u)]
    return eligible[:limit]


def eligible_task_pic_users(
    *,
    project,
    search="",
    limit=DEFAULT_OPTIONS_LIMIT,
):
    """Technicians in tenant + current Project Manager (if set/active)."""
    tenant_id = project.tenant_id
    qs = _apply_user_search(_users_base_qs(tenant_id=tenant_id), search)
    tech_ids = set(
        UserRole.objects.filter(
            is_deleted=False,
            role__code=TECHNICIAN_ROLE_CODE,
            user__tenant_id=tenant_id,
            user__is_active=True,
        ).values_list("user_id", flat=True)
    )
    manager_id = project.project_manager_id
    allowed_ids = set(tech_ids)
    if manager_id:
        allowed_ids.add(manager_id)

    qs = qs.filter(id__in=allowed_ids)
    users = list(qs[:limit])

    # Ensure current manager appears even if search missed ordering edge cases.
    if (
        manager_id
        and not any(u.id == manager_id for u in users)
        and project.project_manager_id
    ):
        manager = (
            _users_base_qs(tenant_id=tenant_id).filter(pk=manager_id).first()
        )
        if manager and _apply_user_search(
            User.objects.filter(pk=manager.pk), search
        ).exists():
            users = [manager, *users][:limit]

    return users


def serialize_assignment_option(user, *, project=None) -> dict:
    member = False
    is_pm = False
    if project is not None:
        is_pm = project.project_manager_id == user.id
        member = ProjectMember.objects.filter(
            project_id=project.id,
            user_id=user.id,
            is_active=True,
            is_deleted=False,
        ).exists()
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": _display_name(user),
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "role_label": _primary_role_label(user),
        "is_project_manager": is_pm,
        "is_project_member": member,
        "is_active": bool(user.is_active),
    }
