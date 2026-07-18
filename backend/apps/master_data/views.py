from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from apps.access_control.permissions import HasPermissionCode
from common.pagination import StandardResultsSetPagination

from .filters import apply_query_param_filters
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
    scope_master_data_queryset,
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
        return apply_query_param_filters(
            queryset,
            self.request.query_params,
            self.filter_fields,
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
        serializer.save()

    def perform_destroy(self, instance):
        require_global_master_data_scope(
            self.request.user,
            operation="delete",
        )
        super().perform_destroy(instance)


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
