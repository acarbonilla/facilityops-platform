from django.contrib import admin

from .models import Project, ProjectHistory, ProjectMember

AUDIT_READONLY_FIELDS = (
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
    "deleted_at",
    "deleted_by",
)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = (
        "project_code",
        "name",
        "tenant",
        "organization",
        "status",
        "priority",
        "project_manager",
        "is_deleted",
    )
    search_fields = ("project_code", "name", "description")
    list_filter = ("status", "priority", "is_deleted")
    readonly_fields = AUDIT_READONLY_FIELDS + ("completion_percentage",)


@admin.register(ProjectMember)
class ProjectMemberAdmin(admin.ModelAdmin):
    list_display = (
        "project",
        "user",
        "role",
        "is_active",
        "tenant",
        "is_deleted",
    )
    search_fields = ("user__email", "project__name", "project__project_code")
    list_filter = ("role", "is_active", "is_deleted")
    readonly_fields = AUDIT_READONLY_FIELDS


@admin.register(ProjectHistory)
class ProjectHistoryAdmin(admin.ModelAdmin):
    list_display = ("project", "action", "actor", "created_at")
    search_fields = ("project__project_code", "action", "description")
    readonly_fields = AUDIT_READONLY_FIELDS
