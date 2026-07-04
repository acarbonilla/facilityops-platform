from django.contrib import admin

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


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "is_active")
    search_fields = ("name", "code", "description")
    list_filter = ("is_active",)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "tenant", "is_active")
    search_fields = ("name", "code", "description", "tenant__name")
    list_filter = ("tenant", "is_active")


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "tenant", "organization", "is_active")
    search_fields = ("name", "code", "description")
    list_filter = ("tenant", "organization", "is_active")


@admin.register(Building)
class BuildingAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "tenant", "organization", "is_active")
    search_fields = ("name", "code", "address", "description")
    list_filter = ("tenant", "organization", "is_active")


@admin.register(Floor)
class FloorAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "tenant", "building", "level_number", "is_active")
    search_fields = ("name", "code", "description")
    list_filter = ("tenant", "building", "is_active")


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "tenant", "building", "floor", "is_active")
    search_fields = ("name", "code", "description")
    list_filter = ("tenant", "building", "floor", "is_active")


@admin.register(AssetType)
class AssetTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "tenant", "is_active")
    search_fields = ("name", "code", "description")
    list_filter = ("tenant", "is_active")


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "tenant",
        "organization",
        "building",
        "asset_type",
        "is_active",
    )
    search_fields = ("name", "code", "serial_number", "description")
    list_filter = (
        "tenant",
        "organization",
        "building",
        "asset_type",
        "is_active",
    )
