from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

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
from .tenant_scope import has_global_master_data_scope


TENANT_RELATION_FIELDS = (
    "tenant",
    "organization",
    "building",
    "floor",
    "area",
    "asset_type",
)


class TenantBoundMasterDataSerializer(serializers.ModelSerializer):
    """Bind child records and related choices to the actor's allowed scope."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None:
            return

        is_global = has_global_master_data_scope(user)
        tenant_id = getattr(user, "tenant_id", None)
        for field_name in TENANT_RELATION_FIELDS:
            field = self.fields.get(field_name)
            queryset = getattr(field, "queryset", None)
            if queryset is None:
                continue

            queryset = queryset.filter(is_deleted=False)
            if not is_global:
                if not tenant_id:
                    queryset = queryset.none()
                elif field_name == "tenant":
                    queryset = queryset.filter(id=tenant_id)
                else:
                    queryset = queryset.filter(tenant_id=tenant_id)
            field.queryset = queryset

        tenant_field = self.fields.get("tenant")
        if tenant_field is not None and not is_global:
            tenant_field.required = False

    def to_internal_value(self, data):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if (
            self.instance is None
            and user is not None
            and not has_global_master_data_scope(user)
            and getattr(user, "tenant_id", None)
            and "tenant" not in data
        ):
            data = data.copy()
            data["tenant"] = str(user.tenant_id)
        return super().to_internal_value(data)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return attrs

        instance_tenant = getattr(self.instance, "tenant", None)
        selected_tenant = attrs.get("tenant", instance_tenant)
        if has_global_master_data_scope(user):
            if selected_tenant is None:
                raise serializers.ValidationError(
                    {"tenant": "A tenant is required."}
                )
        else:
            if not getattr(user, "tenant_id", None):
                raise PermissionDenied(
                    "Tenantless accounts cannot manage Master Data records."
                )
            submitted_tenant = attrs.get("tenant")
            if (
                submitted_tenant is not None
                and submitted_tenant.id != user.tenant_id
            ):
                raise serializers.ValidationError(
                    {"tenant": "You cannot manage records in another tenant."}
                )
            selected_tenant = user.tenant
            attrs["tenant"] = selected_tenant

        self.validate_tenant_relationships(attrs, selected_tenant)
        return attrs

    def related_value(self, attrs, field_name):
        if field_name in attrs:
            return attrs[field_name]
        return getattr(self.instance, field_name, None)

    def validate_tenant_relationships(self, attrs, tenant):
        return None

    def require_same_tenant(self, field_name, value, tenant):
        if value is not None and value.tenant_id != tenant.id:
            label = field_name.replace("_", " ").title()
            raise serializers.ValidationError(
                {field_name: f"{label} must belong to the selected tenant."}
            )


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = (
            "id",
            "name",
            "code",
            "description",
            "is_active",
        )


class OrganizationSerializer(TenantBoundMasterDataSerializer):
    class Meta:
        model = Organization
        fields = (
            "id",
            "tenant",
            "name",
            "code",
            "description",
            "is_active",
        )


class DepartmentSerializer(TenantBoundMasterDataSerializer):
    class Meta:
        model = Department
        fields = (
            "id",
            "tenant",
            "organization",
            "name",
            "code",
            "description",
            "is_active",
        )

    def validate_tenant_relationships(self, attrs, tenant):
        self.require_same_tenant(
            "organization",
            self.related_value(attrs, "organization"),
            tenant,
        )


class BuildingSerializer(TenantBoundMasterDataSerializer):
    class Meta:
        model = Building
        fields = (
            "id",
            "tenant",
            "organization",
            "name",
            "code",
            "address",
            "description",
            "is_active",
        )

    def validate_tenant_relationships(self, attrs, tenant):
        self.require_same_tenant(
            "organization",
            self.related_value(attrs, "organization"),
            tenant,
        )


class FloorSerializer(TenantBoundMasterDataSerializer):
    class Meta:
        model = Floor
        fields = (
            "id",
            "tenant",
            "building",
            "name",
            "code",
            "level_number",
            "description",
            "is_active",
        )

    def validate_tenant_relationships(self, attrs, tenant):
        self.require_same_tenant(
            "building",
            self.related_value(attrs, "building"),
            tenant,
        )


class AreaSerializer(TenantBoundMasterDataSerializer):
    class Meta:
        model = Area
        fields = (
            "id",
            "tenant",
            "building",
            "floor",
            "name",
            "code",
            "description",
            "is_active",
        )

    def validate_tenant_relationships(self, attrs, tenant):
        building = self.related_value(attrs, "building")
        floor = self.related_value(attrs, "floor")
        self.require_same_tenant("building", building, tenant)
        self.require_same_tenant("floor", floor, tenant)
        if (
            building is not None
            and floor is not None
            and floor.building_id != building.id
        ):
            raise serializers.ValidationError(
                {"floor": "Floor must belong to the selected building."}
            )


class AssetTypeSerializer(TenantBoundMasterDataSerializer):
    class Meta:
        model = AssetType
        fields = (
            "id",
            "tenant",
            "name",
            "code",
            "description",
            "is_active",
        )


class AssetSerializer(TenantBoundMasterDataSerializer):
    class Meta:
        model = Asset
        fields = (
            "id",
            "tenant",
            "organization",
            "building",
            "floor",
            "area",
            "asset_type",
            "name",
            "code",
            "serial_number",
            "description",
            "is_active",
        )

    def validate_tenant_relationships(self, attrs, tenant):
        organization = self.related_value(attrs, "organization")
        building = self.related_value(attrs, "building")
        floor = self.related_value(attrs, "floor")
        area = self.related_value(attrs, "area")
        asset_type = self.related_value(attrs, "asset_type")

        for field_name, value in (
            ("organization", organization),
            ("building", building),
            ("floor", floor),
            ("area", area),
            ("asset_type", asset_type),
        ):
            self.require_same_tenant(field_name, value, tenant)

        if (
            organization is not None
            and building is not None
            and building.organization_id != organization.id
        ):
            raise serializers.ValidationError(
                {"building": "Building must belong to the selected organization."}
            )
        if (
            floor is not None
            and building is not None
            and floor.building_id != building.id
        ):
            raise serializers.ValidationError(
                {"floor": "Floor must belong to the selected building."}
            )
        if area is not None:
            if building is not None and area.building_id != building.id:
                raise serializers.ValidationError(
                    {"area": "Area must belong to the selected building."}
                )
            if floor is None or area.floor_id != floor.id:
                raise serializers.ValidationError(
                    {"area": "Area must belong to the selected floor."}
                )
