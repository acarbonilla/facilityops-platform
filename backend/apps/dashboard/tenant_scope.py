from apps.access_control.services import get_user_roles


def has_global_dashboard_scope(user):
    """Return True for approved global Dashboard actors only.

    Global scope matches the established repository definition:
    active authenticated superusers, or users with an active
    ``system_admin`` role assignment.
    """
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    if user.is_superuser:
        return True
    return get_user_roles(user).filter(code="system_admin").exists()


def scope_master_data_to_user(queryset, user, *, tenant_field="tenant_id"):
    """Restrict master-data querysets for Foundation Dashboard counts.

    Superusers and active system_admin roles retain global read scope.
    Tenant-bound users are limited to their own tenant_id. Tenantless
    non-global users receive an empty queryset.
    """
    if has_global_dashboard_scope(user):
        return queryset
    tenant_id = getattr(user, "tenant_id", None)
    if not tenant_id:
        return queryset.none()
    return queryset.filter(**{tenant_field: tenant_id})


def scope_tenants_to_user(queryset, user):
    """Restrict Tenant rows for the Dashboard tenants metric."""
    if has_global_dashboard_scope(user):
        return queryset
    tenant_id = getattr(user, "tenant_id", None)
    if not tenant_id:
        return queryset.none()
    return queryset.filter(id=tenant_id)
