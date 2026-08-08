from apps.access_control.services import get_user_roles


def has_global_project_scope(user):
    if not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    if user.is_superuser:
        return True
    return get_user_roles(user).filter(code="system_admin").exists()


def user_can_access_tenant(user, tenant_id):
    if has_global_project_scope(user):
        return True
    return bool(getattr(user, "tenant_id", None) == tenant_id)


def scope_projects_to_user(queryset, user):
    if has_global_project_scope(user):
        return queryset
    tenant_id = getattr(user, "tenant_id", None)
    if not tenant_id:
        return queryset.none()
    queryset = queryset.filter(tenant_id=tenant_id)

    # FO-110: Technicians see only member / assigned-task Projects.
    from .workspace_access import apply_project_workspace_scope

    return apply_project_workspace_scope(queryset, user)
