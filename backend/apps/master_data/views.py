from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.access_control.permissions import HasPermissionCode
from common.pagination import StandardResultsSetPagination

from .filters import apply_query_param_filters
from .lifecycle import (
    require_safe_deactivation,
    restore_master_data,
    soft_delete_master_data,
)
from .models import (
    Area,
    Asset,
    AssetType,
    Building,
    Department,
    Floor,
    Organization,
    Tenant,
)
from .serializers import (
    AreaSerializer,
    AssetSerializer,
    AssetTypeSerializer,
    BuildingSerializer,
    DepartmentSerializer,
    FloorSerializer,
    OrganizationSerializer,
    TenantSerializer,
)
from .tenant_scope import (
    require_global_master_data_scope,
    scope_master_data_lifecycle_queryset,
    scope_master_data_queryset,
    scope_tenant_lifecycle_queryset,
    scope_tenant_queryset,
)


class MasterDataPermissionMixin:
    permission_classes = [IsAuthenticated, HasPermissionCode]
    pagination_class = StandardResultsSetPagination
    read_permission = "settings.view"
    write_permission = "settings.manage"
    filter_fields = ()
    tenant_model = False

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            self.required_permission = self.read_permission
        else:
            self.required_permission = self.write_permission
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.tenant_model:
            queryset = scope_tenant_queryset(queryset, self.request.user)
        else:
            queryset = scope_master_data_queryset(queryset, self.request.user)
        queryset = apply_query_param_filters(
            queryset,
            self.request.query_params,
            self.filter_fields,
        )
        if self.action in ("update", "partial_update"):
            queryset = queryset.select_for_update(of=("self",))
        return queryset

    def get_lifecycle_queryset(self):
        queryset = self.queryset.all()
        if self.tenant_model:
            return scope_tenant_lifecycle_queryset(queryset, self.request.user)
        return scope_master_data_lifecycle_queryset(queryset, self.request.user)

    def perform_create(self, serializer):
        actor_id = self.request.user.id
        serializer.save(created_by=actor_id, updated_by=actor_id)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    def perform_update(self, serializer):
        instance = serializer.instance
        if (
            instance.is_active
            and serializer.validated_data.get("is_active") is False
        ):
            require_safe_deactivation(
                self.get_lifecycle_queryset(),
                pk=instance.pk,
            )
        serializer.save(updated_by=self.request.user.id)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        soft_delete_master_data(
            self.get_lifecycle_queryset(),
            pk=instance.pk,
            actor=self.request.user,
        )

    def check_restore_permission(self):
        return None

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, pk=None):
        self.check_restore_permission()
        instance = restore_master_data(
            self.get_lifecycle_queryset(),
            pk=pk,
            actor=request.user,
        )
        return Response(
            self.get_serializer(instance).data,
            status=status.HTTP_200_OK,
        )


class TenantViewSet(MasterDataPermissionMixin, viewsets.ModelViewSet):
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    filter_fields = ("is_active",)
    tenant_model = True

    def perform_create(self, serializer):
        require_global_master_data_scope(
            self.request.user,
            operation="create",
        )
        super().perform_create(serializer)

    def perform_destroy(self, instance):
        require_global_master_data_scope(
            self.request.user,
            operation="delete",
        )
        super().perform_destroy(instance)

    def perform_update(self, serializer):
        if (
            not serializer.instance.is_active
            and serializer.validated_data.get("is_active") is True
        ):
            require_global_master_data_scope(
                self.request.user,
                operation="reactivate",
            )
        super().perform_update(serializer)

    def check_restore_permission(self):
        require_global_master_data_scope(
            self.request.user,
            operation="restore",
        )


class OrganizationViewSet(MasterDataPermissionMixin, viewsets.ModelViewSet):
    queryset = Organization.objects.select_related("tenant")
    serializer_class = OrganizationSerializer
    filter_fields = ("tenant", "is_active")


class DepartmentViewSet(MasterDataPermissionMixin, viewsets.ModelViewSet):
    queryset = Department.objects.select_related("tenant", "organization")
    serializer_class = DepartmentSerializer
    filter_fields = ("tenant", "organization", "is_active")


class BuildingViewSet(MasterDataPermissionMixin, viewsets.ModelViewSet):
    queryset = Building.objects.select_related("tenant", "organization")
    serializer_class = BuildingSerializer
    filter_fields = ("tenant", "organization", "is_active")


class FloorViewSet(MasterDataPermissionMixin, viewsets.ModelViewSet):
    queryset = Floor.objects.select_related("tenant", "building")
    serializer_class = FloorSerializer
    filter_fields = ("tenant", "building", "is_active")


class AreaViewSet(MasterDataPermissionMixin, viewsets.ModelViewSet):
    queryset = Area.objects.select_related("tenant", "building", "floor")
    serializer_class = AreaSerializer
    filter_fields = ("tenant", "building", "floor", "is_active")


class AssetTypeViewSet(MasterDataPermissionMixin, viewsets.ModelViewSet):
    queryset = AssetType.objects.select_related("tenant")
    serializer_class = AssetTypeSerializer
    filter_fields = ("tenant", "is_active")


class AssetViewSet(MasterDataPermissionMixin, viewsets.ModelViewSet):
    queryset = Asset.objects.select_related(
        "tenant",
        "organization",
        "building",
        "floor",
        "area",
        "asset_type",
    )
    serializer_class = AssetSerializer
    filter_fields = (
        "tenant",
        "organization",
        "building",
        "floor",
        "area",
        "asset_type",
        "is_active",
    )
