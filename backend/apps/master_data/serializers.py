from rest_framework import serializers

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


class OrganizationSerializer(serializers.ModelSerializer):
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


class DepartmentSerializer(serializers.ModelSerializer):
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


class BuildingSerializer(serializers.ModelSerializer):
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


class FloorSerializer(serializers.ModelSerializer):
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


class AreaSerializer(serializers.ModelSerializer):
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


class AssetTypeSerializer(serializers.ModelSerializer):
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


class AssetSerializer(serializers.ModelSerializer):
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
