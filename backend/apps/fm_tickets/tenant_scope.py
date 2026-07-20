from apps.access_control.services import get_user_roles


EMPLOYEE_ROLE_CODE = "employee"


def has_global_fm_ticket_scope(user):
    """Return True only for approved global FM Ticket administrators."""
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    if user.is_superuser:
        return True
    return get_user_roles(user).filter(code="system_admin").exists()


def has_employee_role(user):
    """Return True for active users with an active Employee role assignment."""
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    return get_user_roles(user).filter(code=EMPLOYEE_ROLE_CODE).exists()


def _has_broader_fm_ticket_permission(user, permission_code):
    return (
        get_user_roles(user)
        .exclude(code=EMPLOYEE_ROLE_CODE)
        .filter(
            role_permissions__is_active=True,
            role_permissions__permission__is_active=True,
            role_permissions__permission__code=permission_code,
        )
        .exists()
    )


def uses_employee_requester_scope(user):
    """Return True when Employee ownership is the user's broadest Ticket scope."""
    if has_global_fm_ticket_scope(user) or not has_employee_role(user):
        return False
    return not _has_broader_fm_ticket_permission(user, "fm_tickets.view")


def uses_employee_requester_creation(user):
    """Return True when Employee is the user's only Ticket creation authority."""
    if has_global_fm_ticket_scope(user) or not has_employee_role(user):
        return False
    return not _has_broader_fm_ticket_permission(user, "fm_tickets.create")


def is_eligible_employee_requester(user):
    """Validate the active Tenant and Organization required for Employee requests."""
    if not has_employee_role(user):
        return False

    tenant = getattr(user, "tenant", None)
    organization = getattr(user, "organization", None)
    if tenant is None or organization is None:
        return False
    if not tenant.is_active or tenant.is_deleted:
        return False
    if not organization.is_active or organization.is_deleted:
        return False
    return organization.tenant_id == tenant.id


def scope_fm_ticket_queryset(queryset, user):
    """Apply authoritative tenant scope to an FM Ticket queryset."""
    if has_global_fm_ticket_scope(user):
        return queryset

    tenant_id = getattr(user, "tenant_id", None)
    if not tenant_id:
        return queryset.none()

    queryset = queryset.filter(tenant_id=tenant_id)
    if uses_employee_requester_scope(user):
        if not is_eligible_employee_requester(user):
            return queryset.none()
        return queryset.filter(requester_id=user.id)
    return queryset
