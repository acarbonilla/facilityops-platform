from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework.exceptions import (
    NotAuthenticated,
    PermissionDenied,
    ValidationError,
)

from apps.access_control.models import Role, UserRole
from apps.access_control.services import get_user_roles, user_has_permission

from .models import User


def has_global_user_scope(user):
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    if user.is_superuser:
        return True
    return get_user_roles(user).filter(code="system_admin").exists()


def scope_users_to_actor(queryset, actor):
    if has_global_user_scope(actor):
        return queryset
    tenant_id = getattr(actor, "tenant_id", None)
    if not tenant_id:
        return queryset.none()
    return queryset.filter(tenant_id=tenant_id)


def _validate_target_tenant(actor, tenant):
    if has_global_user_scope(actor):
        return
    if not actor.tenant_id or tenant is None or tenant.id != actor.tenant_id:
        raise ValidationError(
            {"tenant": "You cannot manage users in another tenant."}
        )


def _validate_actor_can_manage_user(actor, user):
    if has_global_user_scope(actor):
        return
    if not actor.tenant_id or user.tenant_id != actor.tenant_id:
        raise ValidationError(
            {"tenant": "You cannot manage users in another tenant."}
        )


def _validate_authenticated_active_actor(actor):
    if not getattr(actor, "is_authenticated", False):
        raise NotAuthenticated()
    if not actor.is_active:
        raise PermissionDenied("Inactive users may not manage role assignments.")


def _validate_actor_permission(actor, permission_code):
    if not user_has_permission(actor, permission_code):
        raise PermissionDenied(
            "You do not have permission to perform this action."
        )


def _get_manageable_roles(actor):
    queryset = Role.objects.filter(is_active=True).order_by("name")
    if has_global_user_scope(actor):
        return queryset
    return queryset.filter(is_system_role=False)


def _build_user_role_assignment_data(*, actor, user):
    assigned_roles = Role.objects.filter(
        is_active=True,
        user_roles__user=user,
        user_roles__is_active=True,
    ).order_by("name")
    if not has_global_user_scope(actor):
        assigned_roles = assigned_roles.filter(is_system_role=False)

    available_roles = Role.objects.none()
    if user_has_permission(actor, "roles.manage"):
        available_roles = _get_manageable_roles(actor)

    return {
        "user": user,
        "assigned_roles": assigned_roles,
        "available_roles": available_roles,
    }


def _validate_requested_role_ids(actor, role_ids):
    normalized_role_ids = list(dict.fromkeys(str(role_id) for role_id in role_ids))
    if len(normalized_role_ids) != len(role_ids):
        raise ValidationError({"role_ids": ["Duplicate role IDs are not allowed."]})

    all_roles = {
        str(role.id): role
        for role in Role.objects.filter(id__in=normalized_role_ids)
    }
    if len(all_roles) != len(normalized_role_ids):
        raise ValidationError({"role_ids": ["One or more roles do not exist."]})

    inactive_roles = [role.name for role in all_roles.values() if not role.is_active]
    if inactive_roles:
        raise ValidationError(
            {"role_ids": ["Only active roles may be assigned."]}
        )

    if not has_global_user_scope(actor):
        restricted_roles = [
            role.name for role in all_roles.values() if role.is_system_role
        ]
        if restricted_roles:
            raise ValidationError(
                {
                    "role_ids": [
                        "Only global administrators may manage system roles."
                    ]
                }
            )

    manageable_roles = list(
        _get_manageable_roles(actor).filter(id__in=normalized_role_ids)
    )
    manageable_role_ids = {str(role.id) for role in manageable_roles}
    if manageable_role_ids != set(normalized_role_ids):
        raise ValidationError(
            {"role_ids": ["One or more roles cannot be managed by this actor."]}
        )

    return manageable_roles


def _validate_self_system_admin_removal(actor, user, role_ids):
    if actor.pk != user.pk or actor.is_superuser:
        return

    active_system_admin_assignments = UserRole.objects.filter(
        user=user,
        is_active=True,
        role__is_active=True,
        role__code="system_admin",
    )
    if not active_system_admin_assignments.exists():
        return

    if not any(role.code == "system_admin" for role in role_ids):
        raise ValidationError(
            {
                "role_ids": [
                    "You cannot remove your own final active system_admin role."
                ]
            }
        )


def _validate_organization(tenant, organization):
    if organization and (
        tenant is None or organization.tenant_id != tenant.id
    ):
        raise ValidationError(
            {
                "organization": (
                    "Organization must belong to the selected tenant."
                )
            }
        )


def _lock_and_validate_master_data_hierarchy(
    tenant,
    organization,
    *,
    require_active,
):
    if tenant is not None:
        tenant = type(tenant).objects.select_for_update(of=("self",)).get(
            pk=tenant.pk
        )
        if tenant.is_deleted:
            raise ValidationError(
                {"tenant": "Deleted tenants cannot be assigned to users."}
            )
        if require_active and not tenant.is_active:
            raise ValidationError(
                {"tenant": "Inactive tenants cannot be assigned to active users."}
            )

    if organization is not None:
        organization = type(organization).objects.select_for_update(
            of=("self",)
        ).get(pk=organization.pk)
        if organization.is_deleted:
            raise ValidationError(
                {
                    "organization": (
                        "Deleted organizations cannot be assigned to users."
                    )
                }
            )
        if require_active and not organization.is_active:
            raise ValidationError(
                {
                    "organization": (
                        "Inactive organizations cannot be assigned to active users."
                    )
                }
            )

    _validate_organization(tenant, organization)
    return tenant, organization


def _validate_staff_change(actor, requested_is_staff, current_is_staff=False):
    if (
        requested_is_staff != current_is_staff
        and not has_global_user_scope(actor)
    ):
        raise ValidationError(
            {"is_staff": "Only system administrators may change staff status."}
        )


def _set_validated_password(user, password):
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise ValidationError({"password": exc.messages}) from exc
    user.set_password(password)


def _save_validated(user):
    try:
        user.full_clean()
    except DjangoValidationError as exc:
        raise ValidationError(exc.message_dict) from exc
    user.save()


def _lock_user(user):
    return (
        type(user)
        .objects.select_for_update(of=("self",))
        .select_related("tenant", "organization")
        .get(pk=user.pk)
    )


@transaction.atomic
def create_user(*, actor, validated_data):
    data = dict(validated_data)
    password = data.pop("password")
    if not has_global_user_scope(actor):
        data.setdefault("tenant", actor.tenant)

    tenant = data.get("tenant")
    organization = data.get("organization")
    _validate_target_tenant(actor, tenant)
    tenant, organization = _lock_and_validate_master_data_hierarchy(
        tenant,
        organization,
        require_active=data.get("is_active", True),
    )
    data["tenant"] = tenant
    data["organization"] = organization
    _validate_staff_change(actor, data.get("is_staff", False))

    user = User(**data)
    _set_validated_password(user, password)
    _save_validated(user)
    return user


@transaction.atomic
def update_user(*, actor, user, validated_data):
    user = _lock_user(user)
    data = dict(validated_data)
    password = data.pop("password", None)
    _validate_actor_can_manage_user(actor, user)
    tenant = data.get("tenant", user.tenant)
    organization = data.get("organization", user.organization)

    _validate_target_tenant(actor, tenant)
    hierarchy_changed = "tenant" in data or "organization" in data
    reactivating = data.get("is_active") is True and not user.is_active
    if hierarchy_changed or reactivating:
        tenant, organization = _lock_and_validate_master_data_hierarchy(
            tenant,
            organization,
            require_active=data.get("is_active", user.is_active),
        )
    if "tenant" in data:
        data["tenant"] = tenant
    if "organization" in data:
        data["organization"] = organization
    _validate_staff_change(
        actor,
        data.get("is_staff", user.is_staff),
        user.is_staff,
    )
    if data.get("is_active") is False and user.pk == actor.pk:
        raise ValidationError(
            {"is_active": "You cannot deactivate your own account."}
        )

    for field, value in data.items():
        setattr(user, field, value)
    if password is not None:
        _set_validated_password(user, password)
    _save_validated(user)
    return user


@transaction.atomic
def deactivate_user(*, actor, user):
    user = _lock_user(user)
    _validate_actor_can_manage_user(actor, user)
    if user.pk == actor.pk:
        raise ValidationError(
            {"is_active": "You cannot deactivate your own account."}
        )
    if user.is_active:
        user.is_active = False
        user.save(update_fields=("is_active", "updated_at"))
    return user


def get_user_role_assignment_data(*, actor, user):
    _validate_authenticated_active_actor(actor)
    _validate_actor_permission(actor, "users.view")
    _validate_actor_permission(actor, "roles.view")
    _validate_actor_can_manage_user(actor, user)
    return _build_user_role_assignment_data(actor=actor, user=user)


@transaction.atomic
def replace_user_role_assignments(*, actor, user, role_ids):
    _validate_authenticated_active_actor(actor)
    _validate_actor_permission(actor, "roles.manage")
    _validate_actor_can_manage_user(actor, user)

    manageable_roles = _validate_requested_role_ids(actor, role_ids)
    _validate_self_system_admin_removal(actor, user, manageable_roles)

    manageable_role_ids = {role.id for role in _get_manageable_roles(actor)}
    requested_roles_by_id = {role.id: role for role in manageable_roles}

    existing_assignments = {
        assignment.role_id: assignment
        for assignment in UserRole.objects.select_related("role").filter(
            user=user,
            role_id__in=manageable_role_ids,
        )
    }

    active_assignments = {
        role_id: assignment
        for role_id, assignment in existing_assignments.items()
        if assignment.is_active
    }

    for role in manageable_roles:
        assignment = existing_assignments.get(role.id)
        if assignment is None:
            UserRole.objects.create(user=user, role=role, is_active=True)
            continue
        if not assignment.is_active:
            assignment.is_active = True
            assignment.save(update_fields=("is_active", "updated_at"))

    for role_id, assignment in active_assignments.items():
        if role_id not in requested_roles_by_id:
            assignment.is_active = False
            assignment.save(update_fields=("is_active", "updated_at"))

    return _build_user_role_assignment_data(actor=actor, user=user)
