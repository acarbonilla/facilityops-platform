from rest_framework.exceptions import PermissionDenied

from apps.access_control.services import get_user_roles


def has_global_master_data_scope(user):
    """Return True only for approved global Master Data administrators."""
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    if user.is_superuser:
        return True
    return get_user_roles(user).filter(code="system_admin").exists()


def scope_master_data_queryset(queryset, user, *, tenant_field="tenant_id"):
    """Apply backend-authoritative tenant scope to a child entity queryset."""
    queryset = scope_master_data_lifecycle_queryset(
        queryset,
        user,
        tenant_field=tenant_field,
    )
    return queryset.filter(is_deleted=False)


def scope_master_data_lifecycle_queryset(
    queryset,
    user,
    *,
    tenant_field="tenant_id",
):
    """Apply tenant scope without hiding lifecycle states."""
    if has_global_master_data_scope(user):
        return queryset

    tenant_id = getattr(user, "tenant_id", None)
    if not tenant_id:
        return queryset.none()
    return queryset.filter(**{tenant_field: tenant_id})


def scope_tenant_queryset(queryset, user):
    """Scope Tenant rows to own tenant, global scope, or fail-closed none."""
    queryset = scope_tenant_lifecycle_queryset(queryset, user)
    return queryset.filter(is_deleted=False)


def scope_tenant_lifecycle_queryset(queryset, user):
    """Scope Tenant rows without hiding lifecycle states."""
    if has_global_master_data_scope(user):
        return queryset

    tenant_id = getattr(user, "tenant_id", None)
    if not tenant_id:
        return queryset.none()
    return queryset.filter(id=tenant_id)


def require_global_master_data_scope(user, *, operation):
    if not has_global_master_data_scope(user):
        raise PermissionDenied(
            f"Only global administrators may {operation} Tenant records."
        )
