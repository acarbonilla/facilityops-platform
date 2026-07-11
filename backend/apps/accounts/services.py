from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.access_control.services import get_user_roles

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


def _validate_staff_change(actor, requested_is_staff, current_is_staff=False):
    if (
        requested_is_staff != current_is_staff
        and not has_global_user_scope(actor)
    ):
        raise ValidationError(
            {"is_staff": "Only system administrators may change staff status."}
        )


def _save_validated(user):
    try:
        user.full_clean()
    except DjangoValidationError as exc:
        raise ValidationError(exc.message_dict) from exc
    user.save()


@transaction.atomic
def create_user(*, actor, validated_data):
    data = dict(validated_data)
    password = data.pop("password")
    if not has_global_user_scope(actor):
        data.setdefault("tenant", actor.tenant)

    tenant = data.get("tenant")
    organization = data.get("organization")
    _validate_target_tenant(actor, tenant)
    _validate_organization(tenant, organization)
    _validate_staff_change(actor, data.get("is_staff", False))

    user = User(**data)
    user.set_password(password)
    _save_validated(user)
    return user


@transaction.atomic
def update_user(*, actor, user, validated_data):
    data = dict(validated_data)
    password = data.pop("password", None)
    tenant = data.get("tenant", user.tenant)
    organization = data.get("organization", user.organization)

    _validate_target_tenant(actor, tenant)
    _validate_organization(tenant, organization)
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
        user.set_password(password)
    _save_validated(user)
    return user


@transaction.atomic
def deactivate_user(*, actor, user):
    if user.pk == actor.pk:
        raise ValidationError(
            {"is_active": "You cannot deactivate your own account."}
        )
    if user.is_active:
        user.is_active = False
        user.save(update_fields=("is_active", "updated_at"))
    return user
