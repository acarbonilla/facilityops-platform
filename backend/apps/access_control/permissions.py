from rest_framework.permissions import BasePermission

from .services import user_has_permission


class HasPermissionCode(BasePermission):
    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        required_permission = getattr(view, "required_permission", None)
        if not required_permission:
            return False
        return user_has_permission(request.user, required_permission)
