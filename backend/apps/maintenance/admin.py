from django.contrib import admin

from .models import (
    MaintenanceAISummary,
    MaintenanceAssignment,
    MaintenanceAttachment,
    MaintenanceCompletion,
    MaintenanceEscalation,
    MaintenanceHistory,
    MaintenanceLabor,
    MaintenanceMaterial,
    MaintenanceSLA,
    MaintenanceStatusHistory,
    MaintenanceSupervisorApproval,
    MaintenanceTask,
    MaintenanceWorkOrder,
)


AUDIT_READONLY_FIELDS = (
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
    "deleted_at",
    "deleted_by",
)


@admin.register(MaintenanceWorkOrder)
class MaintenanceWorkOrderAdmin(admin.ModelAdmin):
    list_display = (
        "work_order_number",
        "title",
        "tenant",
        "organization",
        "asset",
        "status",
        "priority",
        "requester",
        "assignee",
        "requested_at",
        "due_at",
    )
    search_fields = (
        "work_order_number",
        "title",
        "description",
        "requester__email",
        "assignee__email",
        "asset__name",
    )
    list_filter = (
        "status",
        "priority",
        "tenant",
        "organization",
        "building",
        "requested_at",
    )
    readonly_fields = (
        "work_order_number",
        "requested_at",
        "started_at",
        "completed_at",
        "closed_at",
    ) + AUDIT_READONLY_FIELDS


@admin.register(MaintenanceAssignment)
class MaintenanceAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        "work_order",
        "assigned_to",
        "assigned_by",
        "is_active",
        "assigned_at",
        "unassigned_at",
    )
    search_fields = (
        "work_order__work_order_number",
        "assigned_to__email",
        "assigned_by__email",
        "note",
    )
    list_filter = ("is_active", "assigned_at")
    readonly_fields = ("assigned_at", "unassigned_at") + AUDIT_READONLY_FIELDS


@admin.register(MaintenanceTask)
class MaintenanceTaskAdmin(admin.ModelAdmin):
    list_display = ("work_order", "sequence", "title", "status", "assigned_to", "completed_at")
    search_fields = ("work_order__work_order_number", "title", "assigned_to__email")
    list_filter = ("status", "completed_at")
    readonly_fields = ("completed_at",) + AUDIT_READONLY_FIELDS


@admin.register(MaintenanceMaterial)
class MaintenanceMaterialAdmin(admin.ModelAdmin):
    list_display = ("work_order", "task", "name", "quantity", "unit")
    search_fields = ("work_order__work_order_number", "name", "unit")
    list_filter = ("unit",)
    readonly_fields = AUDIT_READONLY_FIELDS


@admin.register(MaintenanceLabor)
class MaintenanceLaborAdmin(admin.ModelAdmin):
    list_display = ("work_order", "performed_by", "hours", "labor_date")
    search_fields = ("work_order__work_order_number", "performed_by__email", "description")
    list_filter = ("labor_date",)
    readonly_fields = AUDIT_READONLY_FIELDS


@admin.register(MaintenanceAttachment)
class MaintenanceAttachmentAdmin(admin.ModelAdmin):
    list_display = ("work_order", "file_name", "uploaded_by", "created_at")
    search_fields = ("work_order__work_order_number", "file_name", "uploaded_by__email")
    list_filter = ("content_type", "created_at")
    readonly_fields = AUDIT_READONLY_FIELDS


@admin.register(MaintenanceAISummary)
class MaintenanceAISummaryAdmin(admin.ModelAdmin):
    list_display = ("work_order", "model_name", "generated_at")
    search_fields = ("work_order__work_order_number", "summary", "model_name")
    list_filter = ("generated_at",)
    readonly_fields = ("generated_at",) + AUDIT_READONLY_FIELDS


@admin.register(MaintenanceSupervisorApproval)
class MaintenanceSupervisorApprovalAdmin(admin.ModelAdmin):
    list_display = ("work_order", "status", "approved_by", "approved_at")
    search_fields = ("work_order__work_order_number", "approved_by__email", "comments")
    list_filter = ("status", "approved_at")
    readonly_fields = ("approved_at",) + AUDIT_READONLY_FIELDS


@admin.register(MaintenanceCompletion)
class MaintenanceCompletionAdmin(admin.ModelAdmin):
    list_display = ("work_order", "completed_by", "completed_at", "follow_up_required")
    search_fields = (
        "work_order__work_order_number",
        "completed_by__email",
        "completion_notes",
        "resolution_summary",
    )
    list_filter = ("follow_up_required", "completed_at")
    readonly_fields = ("completed_at",) + AUDIT_READONLY_FIELDS


@admin.register(MaintenanceHistory)
class MaintenanceHistoryAdmin(admin.ModelAdmin):
    list_display = ("work_order", "action", "actor", "created_at")
    search_fields = (
        "work_order__work_order_number",
        "action",
        "description",
        "actor__email",
    )
    list_filter = ("action", "created_at")
    readonly_fields = AUDIT_READONLY_FIELDS


@admin.register(MaintenanceStatusHistory)
class MaintenanceStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("work_order", "from_status", "to_status", "changed_by", "changed_at")
    search_fields = (
        "work_order__work_order_number",
        "changed_by__email",
        "note",
    )
    list_filter = ("from_status", "to_status", "changed_at")
    readonly_fields = ("changed_at",) + AUDIT_READONLY_FIELDS


@admin.register(MaintenanceEscalation)
class MaintenanceEscalationAdmin(admin.ModelAdmin):
    list_display = (
        "work_order",
        "level",
        "escalated_by",
        "escalated_to",
        "is_active",
        "created_at",
        "resolved_at",
    )
    search_fields = (
        "work_order__work_order_number",
        "escalated_by__email",
        "escalated_to__email",
        "reason",
    )
    list_filter = ("level", "is_active", "created_at")
    readonly_fields = ("resolved_at",) + AUDIT_READONLY_FIELDS


@admin.register(MaintenanceSLA)
class MaintenanceSLAAdmin(admin.ModelAdmin):
    list_display = (
        "work_order",
        "sla_status",
        "response_due_at",
        "resolution_due_at",
        "response_met",
        "resolution_met",
    )
    search_fields = ("work_order__work_order_number",)
    list_filter = ("sla_status", "response_met", "resolution_met")
    readonly_fields = AUDIT_READONLY_FIELDS
