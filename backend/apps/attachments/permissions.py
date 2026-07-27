from rest_framework.permissions import BasePermission

from apps.access_control.services import user_has_permission


class HasAttachmentPermission(BasePermission):
    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        required = getattr(view, "required_permission", None)
        if not required:
            return False
        return user_has_permission(request.user, required)
