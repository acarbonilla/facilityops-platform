from rest_framework.permissions import BasePermission

from apps.access_control.services import user_has_permission


class HasMaintenancePermission(BasePermission):
    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        required_permission = getattr(view, "required_permission", None)
        if required_permission:
            return user_has_permission(request.user, required_permission)

        required_permissions_any = getattr(view, "required_permissions_any", None)
        if required_permissions_any:
            return any(
                user_has_permission(request.user, permission_code)
                for permission_code in required_permissions_any
            )

        return False
