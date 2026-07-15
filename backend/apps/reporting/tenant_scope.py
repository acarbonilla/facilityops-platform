from apps.access_control.services import get_user_roles


def has_global_reporting_scope(user):
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    if user.is_superuser:
        return True
    return get_user_roles(user).filter(code="system_admin").exists()


def user_can_access_tenant(user, tenant_id):
    if has_global_reporting_scope(user):
        return True
    return bool(getattr(user, "tenant_id", None) == tenant_id)


def scope_queryset_to_user(queryset, user, *, tenant_field="tenant_id"):
    """Restrict operational reporting querysets to the actor's tenant.

    Superusers and system_admin roles retain global read scope. All other
    authenticated users are limited to their own tenant_id. Users without a
    tenant never see aggregate rows.
    """
    if has_global_reporting_scope(user):
        return queryset
    tenant_id = getattr(user, "tenant_id", None)
    if not tenant_id:
        return queryset.none()
    return queryset.filter(**{tenant_field: tenant_id})
