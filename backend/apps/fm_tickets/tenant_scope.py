from apps.access_control.services import get_user_roles


def has_global_fm_ticket_scope(user):
    """Return True only for approved global FM Ticket administrators."""
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    if user.is_superuser:
        return True
    return get_user_roles(user).filter(code="system_admin").exists()


def scope_fm_ticket_queryset(queryset, user):
    """Apply authoritative tenant scope to an FM Ticket queryset."""
    if has_global_fm_ticket_scope(user):
        return queryset

    tenant_id = getattr(user, "tenant_id", None)
    if not tenant_id:
        return queryset.none()
    return queryset.filter(tenant_id=tenant_id)
