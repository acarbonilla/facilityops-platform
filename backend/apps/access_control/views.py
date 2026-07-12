from rest_framework import filters, serializers, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.pagination import StandardResultsSetPagination

from .models import Permission, Role
from .permissions import HasPermissionCode
from .serializers import (
    PermissionSerializer,
    RoleSerializer,
    RoleWriteSerializer,
    UserPermissionSerializer,
)
from .services import deactivate_role, get_user_permission_codes, get_user_roles


class RoleExactFilterBackend:
    fields = {
        "is_system_role": serializers.BooleanField(),
        "is_active": serializers.BooleanField(),
    }

    def filter_queryset(self, request, queryset, view):
        filters_to_apply = {
            field: serializer.run_validation(request.query_params[field])
            for field, serializer in self.fields.items()
            if field in request.query_params
        }
        return queryset.filter(**filters_to_apply)


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    permission_classes = [IsAuthenticated, HasPermissionCode]
    pagination_class = StandardResultsSetPagination
    filter_backends = (
        RoleExactFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    )
    search_fields = ("name", "code", "description")
    ordering_fields = (
        "name",
        "code",
        "is_system_role",
        "is_active",
        "created_at",
        "updated_at",
    )
    ordering = ("name",)
    permission_by_action = {
        "list": "roles.view",
        "retrieve": "roles.view",
        "create": "roles.manage",
        "update": "roles.manage",
        "partial_update": "roles.manage",
        "destroy": "roles.manage",
    }

    def get_permissions(self):
        self.required_permission = self.permission_by_action.get(self.action)
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return RoleWriteSerializer
        return RoleSerializer

    def _enforce_global_scope(self):
        from apps.accounts.services import has_global_user_scope

        if not has_global_user_scope(self.request.user):
            raise PermissionDenied(
                "Only global administrators may manage the role catalog."
            )

    def create(self, request, *args, **kwargs):
        self._enforce_global_scope()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = serializer.save()
        return Response(RoleSerializer(role).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        self._enforce_global_scope()
        partial = kwargs.pop("partial", False)
        role = self.get_object()
        serializer = self.get_serializer(role, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        role = serializer.save()
        return Response(RoleSerializer(role).data)

    def destroy(self, request, *args, **kwargs):
        self._enforce_global_scope()
        deactivate_role(actor=request.user, role=self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)


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
