from django.contrib import admin

from .models import (
    Inspection,
    InspectionAIAnalysis,
    InspectionAssignment,
    InspectionAttachment,
    InspectionComment,
    InspectionCorrectiveAction,
    InspectionEscalation,
    InspectionFinding,
    InspectionHistory,
    InspectionItem,
    InspectionSLA,
    InspectionStatusHistory,
)

AUDIT_READONLY_FIELDS = (
    "created_at",
    "updated_at",
    "created_by",
    "updated_by",
    "deleted_at",
    "deleted_by",
)


@admin.register(Inspection)
class InspectionAdmin(admin.ModelAdmin):
    list_display = (
        "inspection_number",
        "title",
        "tenant",
        "building",
        "status",
        "priority",
        "inspector",
        "supervisor",
        "scheduled_date",
        "score",
    )
    search_fields = (
        "inspection_number",
        "title",
        "remarks",
        "inspector__email",
        "supervisor__email",
        "building__name",
        "area__name",
    )
    list_filter = (
        "status",
        "priority",
        "inspection_type",
        "five_s_category",
        "tenant",
        "organization",
        "building",
        "scheduled_date",
    )
    readonly_fields = (
        "inspection_number",
        "started_date",
        "completed_date",
        "verified_date",
        "score",
    ) + AUDIT_READONLY_FIELDS


@admin.register(InspectionItem)
class InspectionItemAdmin(admin.ModelAdmin):
    list_display = ("inspection", "sequence", "checklist_item", "score", "is_pass")
    search_fields = ("inspection__inspection_number", "checklist_item", "category")
    list_filter = ("is_pass", "category")
    readonly_fields = AUDIT_READONLY_FIELDS


@admin.register(InspectionFinding)
class InspectionFindingAdmin(admin.ModelAdmin):
    list_display = ("inspection", "finding_type", "severity", "status", "created_at")
    search_fields = ("inspection__inspection_number", "description", "recommendation")
    list_filter = ("finding_type", "severity", "status")
    readonly_fields = AUDIT_READONLY_FIELDS


@admin.register(InspectionCorrectiveAction)
class InspectionCorrectiveActionAdmin(admin.ModelAdmin):
    list_display = (
        "inspection",
        "assigned_to",
        "due_date",
        "status",
        "verification_status",
        "completion_date",
    )
    search_fields = ("inspection__inspection_number", "finding__description", "notes")
    list_filter = ("status", "verification_status", "due_date")
    readonly_fields = AUDIT_READONLY_FIELDS
    actions = ("mark_cancelled",)

    @admin.action(description="Mark selected corrective actions as cancelled")
    def mark_cancelled(self, request, queryset):
        queryset.update(status=InspectionCorrectiveAction.Status.CANCELLED)


@admin.register(InspectionHistory)
class InspectionHistoryAdmin(admin.ModelAdmin):
    list_display = ("inspection", "action", "actor", "created_at")
    search_fields = ("inspection__inspection_number", "description", "actor__email")
    list_filter = ("action", "created_at")
    readonly_fields = AUDIT_READONLY_FIELDS


@admin.register(InspectionStatusHistory)
class InspectionStatusHistoryAdmin(admin.ModelAdmin):
    list_display = (
        "inspection",
        "action",
        "from_status",
        "to_status",
        "changed_by",
        "changed_at",
    )
    search_fields = ("inspection__inspection_number", "changed_by__email", "note")
    list_filter = ("action", "from_status", "to_status", "changed_at")
    readonly_fields = ("changed_at",) + AUDIT_READONLY_FIELDS


@admin.register(InspectionAttachment)
class InspectionAttachmentAdmin(admin.ModelAdmin):
    list_display = ("inspection", "file_name", "uploaded_by", "created_at")
    search_fields = ("inspection__inspection_number", "file_name", "uploaded_by__email")
    list_filter = ("content_type", "created_at")
    readonly_fields = AUDIT_READONLY_FIELDS


@admin.register(InspectionComment)
class InspectionCommentAdmin(admin.ModelAdmin):
    list_display = ("inspection", "author", "is_internal", "created_at")
    search_fields = ("inspection__inspection_number", "author__email", "body")
    list_filter = ("is_internal", "created_at")
    readonly_fields = AUDIT_READONLY_FIELDS


@admin.register(InspectionAssignment)
class InspectionAssignmentAdmin(admin.ModelAdmin):
    list_display = (
        "inspection",
        "assigned_to",
        "assigned_by",
        "role",
        "assignment_status",
        "assigned_at",
        "is_active",
    )
    search_fields = (
        "inspection__inspection_number",
        "assigned_to__email",
        "assigned_by__email",
        "note",
    )
    list_filter = ("role", "assignment_status", "is_active", "assigned_at")
    readonly_fields = ("assigned_at", "unassigned_at") + AUDIT_READONLY_FIELDS


@admin.register(InspectionAIAnalysis)
class InspectionAIAnalysisAdmin(admin.ModelAdmin):
    list_display = ("inspection", "model_name", "generated_at")
    search_fields = ("inspection__inspection_number", "summary", "analysis")
    list_filter = ("generated_at",)
    readonly_fields = ("generated_at",) + AUDIT_READONLY_FIELDS


@admin.register(InspectionSLA)
class InspectionSLAAdmin(admin.ModelAdmin):
    list_display = (
        "inspection",
        "sla_status",
        "target_minutes",
        "warning_minutes",
        "due_at",
        "verification_due_at",
        "completion_breached",
        "verification_breached",
    )
    search_fields = ("inspection__inspection_number",)
    list_filter = ("sla_status", "completion_breached", "verification_breached")
    readonly_fields = AUDIT_READONLY_FIELDS


@admin.register(InspectionEscalation)
class InspectionEscalationAdmin(admin.ModelAdmin):
    list_display = (
        "inspection",
        "escalation_type",
        "level",
        "status",
        "escalated_to",
        "is_active",
        "created_at",
        "resolved_at",
    )
    search_fields = ("inspection__inspection_number", "reason", "notes")
    list_filter = ("escalation_type", "level", "status", "is_active")
    readonly_fields = ("acknowledged_at", "resolved_at") + AUDIT_READONLY_FIELDS

