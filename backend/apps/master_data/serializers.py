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

    hierarchy_fields = ()

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
            if self.instance is None or submitted_tenant is not None:
                attrs["tenant"] = selected_tenant

        self.validate_tenant_relationships(attrs, selected_tenant)
        require_active = self.requires_active_hierarchy(attrs)
        if require_active or self.requires_locked_hierarchy(attrs):
            self.validate_lifecycle_hierarchy(
                attrs,
                selected_tenant,
                require_active=require_active,
            )
        return attrs

    def related_value(self, attrs, field_name):
        if field_name in attrs:
            return attrs[field_name]
        return getattr(self.instance, field_name, None)

    def validate_tenant_relationships(self, attrs, tenant):
        return None

    def validate_lifecycle_hierarchy(self, attrs, tenant, *, require_active):
        return self.require_lifecycle_parent(
            "tenant",
            tenant,
            require_active=require_active,
        )

    def requires_locked_hierarchy(self, attrs):
        if self.instance is None:
            return True
        return any(field_name in attrs for field_name in self.hierarchy_fields)

    def requires_active_hierarchy(self, attrs):
        current_active = getattr(self.instance, "is_active", True)
        resulting_active = attrs.get("is_active", current_active)
        if not resulting_active:
            return False
        if self.instance is None or not current_active:
            return True
        return any(field_name in attrs for field_name in self.hierarchy_fields)

    def require_same_tenant(self, field_name, value, tenant):
        if value is not None and value.tenant_id != tenant.id:
            label = field_name.replace("_", " ").title()
            raise serializers.ValidationError(
                {field_name: f"{label} must belong to the selected tenant."}
            )

    def require_lifecycle_parent(self, field_name, value, *, require_active):
        if value is None:
            return None
        locked = type(value).objects.select_for_update().get(pk=value.pk)
        if locked.is_deleted:
            raise serializers.ValidationError(
                {field_name: "Deleted records cannot be used in a hierarchy."}
            )
        if require_active and not locked.is_active:
            raise serializers.ValidationError(
                {field_name: "Inactive records cannot be used in an active hierarchy."}
            )
        return locked


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
    hierarchy_fields = ("tenant",)

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
    hierarchy_fields = ("tenant", "organization")

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

    def validate_lifecycle_hierarchy(self, attrs, tenant, *, require_active):
        tenant = super().validate_lifecycle_hierarchy(
            attrs,
            tenant,
            require_active=require_active,
        )
        organization = self.require_lifecycle_parent(
            "organization",
            self.related_value(attrs, "organization"),
            require_active=require_active,
        )
        self.require_same_tenant("organization", organization, tenant)


class BuildingSerializer(TenantBoundMasterDataSerializer):
    hierarchy_fields = ("tenant", "organization")

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

    def validate_lifecycle_hierarchy(self, attrs, tenant, *, require_active):
        tenant = super().validate_lifecycle_hierarchy(
            attrs,
            tenant,
            require_active=require_active,
        )
        organization = self.require_lifecycle_parent(
            "organization",
            self.related_value(attrs, "organization"),
            require_active=require_active,
        )
        self.require_same_tenant("organization", organization, tenant)


class FloorSerializer(TenantBoundMasterDataSerializer):
    hierarchy_fields = ("tenant", "building")

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

    def validate_lifecycle_hierarchy(self, attrs, tenant, *, require_active):
        tenant = super().validate_lifecycle_hierarchy(
            attrs,
            tenant,
            require_active=require_active,
        )
        building = self.require_lifecycle_parent(
            "building",
            self.related_value(attrs, "building"),
            require_active=require_active,
        )
        self.require_same_tenant("building", building, tenant)


class AreaSerializer(TenantBoundMasterDataSerializer):
    hierarchy_fields = ("tenant", "building", "floor")

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

    def validate_lifecycle_hierarchy(self, attrs, tenant, *, require_active):
        tenant = super().validate_lifecycle_hierarchy(
            attrs,
            tenant,
            require_active=require_active,
        )
        building = self.require_lifecycle_parent(
            "building",
            self.related_value(attrs, "building"),
            require_active=require_active,
        )
        floor = self.require_lifecycle_parent(
            "floor",
            self.related_value(attrs, "floor"),
            require_active=require_active,
        )
        self.require_same_tenant("building", building, tenant)
        self.require_same_tenant("floor", floor, tenant)
        if floor.building_id != building.id:
            raise serializers.ValidationError(
                {"floor": "Floor must belong to the selected building."}
            )


class AssetTypeSerializer(TenantBoundMasterDataSerializer):
    hierarchy_fields = ("tenant",)

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
    hierarchy_fields = (
        "tenant",
        "organization",
        "building",
        "floor",
        "area",
        "asset_type",
    )

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

    def validate_lifecycle_hierarchy(self, attrs, tenant, *, require_active):
        tenant = super().validate_lifecycle_hierarchy(
            attrs,
            tenant,
            require_active=require_active,
        )
        parents = {}
        for field_name in (
            "organization",
            "building",
            "floor",
            "area",
            "asset_type",
        ):
            parents[field_name] = self.require_lifecycle_parent(
                field_name,
                self.related_value(attrs, field_name),
                require_active=require_active,
            )
            self.require_same_tenant(field_name, parents[field_name], tenant)

        organization = parents["organization"]
        building = parents["building"]
        floor = parents["floor"]
        area = parents["area"]
        if building.organization_id != organization.id:
            raise serializers.ValidationError(
                {"building": "Building must belong to the selected organization."}
            )
        if floor is not None and floor.building_id != building.id:
            raise serializers.ValidationError(
                {"floor": "Floor must belong to the selected building."}
            )
        if area is not None:
            if area.building_id != building.id:
                raise serializers.ValidationError(
                    {"area": "Area must belong to the selected building."}
                )
            if floor is None or area.floor_id != floor.id:
                raise serializers.ValidationError(
                    {"area": "Area must belong to the selected floor."}
                )
