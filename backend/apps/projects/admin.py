from django.contrib import admin

from .models import (
    Project,
    ProjectHistory,
    ProjectIssue,
    ProjectIssueComment,
    ProjectMember,
    ProjectNote,
    ProjectTask,
    ProjectTaskChecklistItem,
    ProjectTaskComment,
    ProjectTaskDependency,
)

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


@admin.register(ProjectTask)
class ProjectTaskAdmin(admin.ModelAdmin):
    list_display = (
        "task_code",
        "name",
        "project",
        "status",
        "priority",
        "person_in_charge",
        "progress_percentage",
        "is_milestone",
        "is_deleted",
    )
    search_fields = ("task_code", "name", "description", "project__project_code")
    list_filter = ("status", "priority", "is_milestone", "is_deleted")
    readonly_fields = AUDIT_READONLY_FIELDS + ("task_code",)


@admin.register(ProjectTaskChecklistItem)
class ProjectTaskChecklistItemAdmin(admin.ModelAdmin):
    list_display = ("text", "task", "is_completed", "sequence", "is_deleted")
    search_fields = ("text", "task__task_code")
    list_filter = ("is_completed", "is_deleted")
    readonly_fields = AUDIT_READONLY_FIELDS


@admin.register(ProjectTaskComment)
class ProjectTaskCommentAdmin(admin.ModelAdmin):
    list_display = ("task", "author", "is_internal", "created_at", "is_deleted")
    search_fields = ("body", "task__task_code", "author__email")
    list_filter = ("is_internal", "is_deleted")
    readonly_fields = AUDIT_READONLY_FIELDS


@admin.register(ProjectTaskDependency)
class ProjectTaskDependencyAdmin(admin.ModelAdmin):
    list_display = (
        "project",
        "predecessor_task",
        "successor_task",
        "dependency_type",
        "is_deleted",
    )
    search_fields = (
        "project__project_code",
        "predecessor_task__task_code",
        "successor_task__task_code",
    )
    list_filter = ("dependency_type", "is_deleted")
    readonly_fields = AUDIT_READONLY_FIELDS


@admin.register(ProjectNote)
class ProjectNoteAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "project",
        "category",
        "author",
        "is_deleted",
    )
    search_fields = ("title", "note", "project__project_code", "author__email")
    list_filter = ("category", "is_deleted")
    readonly_fields = AUDIT_READONLY_FIELDS


@admin.register(ProjectIssue)
class ProjectIssueAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "project",
        "status",
        "severity",
        "owner",
        "due_date",
        "is_deleted",
    )
    search_fields = ("title", "description", "project__project_code", "owner__email")
    list_filter = ("status", "severity", "is_deleted")
    readonly_fields = AUDIT_READONLY_FIELDS + ("resolved_at",)


@admin.register(ProjectIssueComment)
class ProjectIssueCommentAdmin(admin.ModelAdmin):
    list_display = ("issue", "author", "is_internal", "created_at", "is_deleted")
    search_fields = ("body", "issue__title", "author__email")
    list_filter = ("is_internal", "is_deleted")
    readonly_fields = AUDIT_READONLY_FIELDS
