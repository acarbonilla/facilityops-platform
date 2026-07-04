from django.contrib import admin

from .models import Permission, Role, RolePermission, UserRole


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "is_system_role", "is_active")
    search_fields = ("name", "code", "description")
    list_filter = ("is_system_role", "is_active")


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "module", "action", "is_active")
    search_fields = ("name", "code", "module", "action", "description")
    list_filter = ("module", "action", "is_active")


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ("role", "permission", "is_active")
    search_fields = ("role__name", "role__code", "permission__code")
    list_filter = ("is_active",)


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "is_active")
    search_fields = ("user__email", "role__name", "role__code")
    list_filter = ("is_active",)
