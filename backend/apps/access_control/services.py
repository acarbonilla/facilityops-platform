from apps.access_control.models import Permission, Role


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
