import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils.text import slugify
from rest_framework.exceptions import (
    NotAuthenticated,
    PermissionDenied,
    ValidationError,
)

from apps.access_control.models import Permission, Role, RolePermission, UserRole


def get_user_roles(user):
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return Role.objects.none()

    return Role.objects.filter(
        is_active=True,
        user_roles__user=user,
        user_roles__is_active=True,
    ).distinct()


def get_user_permission_codes(user):
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return set()

    active_permissions = Permission.objects.filter(is_active=True)
    if user.is_superuser:
        return set(active_permissions.values_list("code", flat=True))

    permission_codes = active_permissions.filter(
        role_permissions__is_active=True,
        role_permissions__role__is_active=True,
        role_permissions__role__user_roles__user=user,
        role_permissions__role__user_roles__is_active=True,
    ).values_list("code", flat=True)
    return set(permission_codes)


def user_has_permission(user, permission_code):
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    if user.is_superuser:
        return True
    return permission_code in get_user_permission_codes(user)


def _validate_role_actor(actor):
    if not getattr(actor, "is_authenticated", False):
        raise NotAuthenticated()
    if not actor.is_active:
        raise PermissionDenied("Inactive users may not manage roles.")
    if not user_has_permission(actor, "roles.manage"):
        raise PermissionDenied("You do not have permission to perform this action.")

    # Imported here to reuse User Management's scope contract without creating
    # an import cycle (accounts.services already imports this module).
    from apps.accounts.services import has_global_user_scope

    if not has_global_user_scope(actor):
        raise PermissionDenied(
            "Only global administrators may manage the role catalog."
        )


def _validate_role_assignment_read_actor(actor):
    if not getattr(actor, "is_authenticated", False):
        raise NotAuthenticated()
    if not actor.is_active:
        raise PermissionDenied("Inactive users may not manage roles.")
    if not user_has_permission(actor, "roles.view"):
        raise PermissionDenied("You do not have permission to perform this action.")


def _build_role_permission_assignment_data(role):
    assigned_permissions = Permission.objects.filter(
        is_active=True,
        role_permissions__role=role,
        role_permissions__is_active=True,
    ).order_by("module", "action", "name")
    return {
        "role": role,
        "assigned_permissions": assigned_permissions,
    }


def _save_role(role):
    try:
        role.full_clean()
        role.save()
    except DjangoValidationError as exc:
        detail = getattr(exc, "message_dict", None) or {
            "non_field_errors": exc.messages
        }
        raise ValidationError(detail) from exc
    except IntegrityError as exc:
        raise ValidationError(
            {"code": ["A role with this code already exists."]}
        ) from exc


def _normalize_role_code(value):
    raw_code = str(value or "").strip()
    if not raw_code or not re.fullmatch(r"[A-Za-z0-9_\s-]+", raw_code):
        raise ValidationError(
            {
                "code": [
                    "Enter a valid role code using letters, numbers, spaces, "
                    "underscores, or hyphens."
                ]
            }
        )
    normalized_code = slugify(raw_code)
    if not normalized_code:
        raise ValidationError({"code": ["Role code cannot be blank."]})
    return normalized_code


@transaction.atomic
def create_role(*, actor, validated_data):
    _validate_role_actor(actor)
    data = dict(validated_data)
    protected_fields = {
        field: ["This field is read-only."]
        for field in ("is_system_role", "is_active")
        if field in data
    }
    if protected_fields:
        raise ValidationError(protected_fields)
    data["code"] = _normalize_role_code(data.get("code"))
    if "name" in data:
        data["name"] = str(data["name"]).strip()
    role = Role(**data, is_system_role=False, is_active=True)
    _save_role(role)
    return role


@transaction.atomic
def update_role(*, actor, role, validated_data):
    _validate_role_actor(actor)
    if role.is_system_role:
        raise ValidationError({"role": ["System roles cannot be modified."]})

    data = dict(validated_data)
    if "code" in data and data["code"] != role.code:
        raise ValidationError({"code": ["Role code cannot be changed."]})
    data.pop("code", None)
    if "is_system_role" in data:
        raise ValidationError({"is_system_role": ["This field cannot be changed."]})
    if "is_active" in data:
        raise ValidationError({"is_active": ["Use DELETE to deactivate a role."]})

    for field in ("name", "description"):
        if field in data:
            value = data[field]
            if field == "name":
                value = str(value).strip()
                if not value:
                    raise ValidationError({"name": ["Role name cannot be blank."]})
            setattr(role, field, value)
    _save_role(role)
    return role


@transaction.atomic
def deactivate_role(*, actor, role):
    _validate_role_actor(actor)
    if role.is_system_role:
        raise ValidationError({"role": ["System roles cannot be deactivated."]})

    if role.is_active:
        role.is_active = False
        role.save(update_fields=("is_active", "updated_at"))
    RolePermission.objects.filter(role=role, is_active=True).update(is_active=False)
    UserRole.objects.filter(role=role, is_active=True).update(is_active=False)
    return role


def get_role_permission_assignment_data(*, actor, role):
    _validate_role_assignment_read_actor(actor)
    return _build_role_permission_assignment_data(role)


@transaction.atomic
def replace_role_permissions(*, actor, role, permission_ids):
    _validate_role_actor(actor)
    if role.is_system_role:
        raise ValidationError({"role": ["System roles cannot be modified."]})
    if not role.is_active:
        raise ValidationError(
            {"role": ["Inactive roles cannot be modified."]}
        )

    normalized_ids = [str(permission_id) for permission_id in permission_ids]
    if len(normalized_ids) != len(set(normalized_ids)):
        raise ValidationError(
            {"permission_ids": ["Duplicate permission IDs are not allowed."]}
        )

    permissions = {
        str(permission.id): permission
        for permission in Permission.objects.filter(id__in=normalized_ids)
    }
    if len(permissions) != len(normalized_ids):
        raise ValidationError(
            {"permission_ids": ["One or more permissions do not exist."]}
        )

    if any(not permission.is_active for permission in permissions.values()):
        raise ValidationError(
            {"permission_ids": ["Only active permissions may be assigned."]}
        )

    existing_assignments = {
        str(assignment.permission_id): assignment
        for assignment in RolePermission.objects.select_for_update().filter(role=role)
    }
    requested_ids = set(normalized_ids)
    reactivate_assignment_ids = []
    new_assignments = []

    for permission_id in requested_ids:
        assignment = existing_assignments.get(permission_id)
        if assignment is None:
            new_assignments.append(
                RolePermission(
                    role=role,
                    permission_id=permission_id,
                    is_active=True,
                )
            )
            continue
        if not assignment.is_active:
            reactivate_assignment_ids.append(assignment.id)

    deactivate_assignment_ids = [
        assignment.id
        for permission_id, assignment in existing_assignments.items()
        if assignment.is_active and permission_id not in requested_ids
    ]

    if reactivate_assignment_ids:
        RolePermission.objects.filter(id__in=reactivate_assignment_ids).update(
            is_active=True
        )
    if deactivate_assignment_ids:
        RolePermission.objects.filter(id__in=deactivate_assignment_ids).update(
            is_active=False
        )
    if new_assignments:
        RolePermission.objects.bulk_create(new_assignments)

    return _build_role_permission_assignment_data(role)
