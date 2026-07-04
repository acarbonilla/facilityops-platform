from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Permission, Role
from .permissions import HasPermissionCode
from .serializers import (
    PermissionSerializer,
    RoleSerializer,
    UserPermissionSerializer,
)
from .services import get_user_permission_codes, get_user_roles


class RoleListView(APIView):
    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = "roles.view"

    def get(self, request):
        roles = Role.objects.filter(is_active=True)
        return Response(RoleSerializer(roles, many=True).data)


class PermissionListView(APIView):
    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = "roles.manage"

    def get(self, request):
        permissions = Permission.objects.filter(is_active=True)
        return Response(PermissionSerializer(permissions, many=True).data)


class CurrentUserPermissionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        payload = {
            "roles": sorted(role.code for role in get_user_roles(request.user)),
            "permissions": sorted(get_user_permission_codes(request.user)),
        }
        serializer = UserPermissionSerializer(payload)
        return Response(serializer.data)
