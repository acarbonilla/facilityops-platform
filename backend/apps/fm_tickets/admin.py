from django.contrib import admin

from .models import (
    FmTicket,
    FmTicketComment,
    FmTicketEscalation,
    FmTicketHistory,
    FmTicketStatusHistory,
)


@admin.register(FmTicket)
class FmTicketAdmin(admin.ModelAdmin):
    list_display = (
        "ticket_number",
        "title",
        "tenant",
        "organization",
        "building",
        "status",
        "priority",
        "requester",
        "assignee",
        "reported_at",
        "response_due_at",
        "resolution_due_at",
    )
    search_fields = (
        "ticket_number",
        "title",
        "description",
        "requester__email",
        "assignee__email",
    )
    list_filter = (
        "status",
        "priority",
        "category",
        "source",
        "tenant",
        "organization",
        "building",
    )
    readonly_fields = (
        "ticket_number",
        "reported_at",
        "response_due_at",
        "resolution_due_at",
        "first_responded_at",
        "response_met",
        "resolution_met",
        "resolved_at",
        "closed_at",
        "created_at",
        "updated_at",
    )


@admin.register(FmTicketComment)
class FmTicketCommentAdmin(admin.ModelAdmin):
    list_display = ("ticket", "author", "is_internal", "created_at")
    search_fields = ("ticket__ticket_number", "ticket__title", "author__email", "body")
    list_filter = ("is_internal", "created_at")
    readonly_fields = ("created_at", "updated_at")


@admin.register(FmTicketHistory)
class FmTicketHistoryAdmin(admin.ModelAdmin):
    list_display = ("ticket", "action", "actor", "created_at")
    search_fields = (
        "ticket__ticket_number",
        "ticket__title",
        "action",
        "description",
        "actor__email",
    )
    list_filter = ("action", "created_at")
    readonly_fields = ("created_at", "updated_at")


@admin.register(FmTicketStatusHistory)
class FmTicketStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ("ticket", "from_status", "to_status", "changed_by", "changed_at")
    search_fields = ("ticket__ticket_number", "ticket__title", "changed_by__email", "note")
    list_filter = ("from_status", "to_status", "changed_at")
    readonly_fields = ("changed_at", "created_at", "updated_at")


@admin.register(FmTicketEscalation)
class FmTicketEscalationAdmin(admin.ModelAdmin):
    list_display = (
        "ticket",
        "level",
        "escalated_by",
        "escalated_to",
        "is_active",
        "created_at",
        "resolved_at",
    )
    search_fields = (
        "ticket__ticket_number",
        "ticket__title",
        "escalated_by__email",
        "escalated_to__email",
        "reason",
    )
    list_filter = ("level", "is_active", "created_at")
    readonly_fields = ("created_at", "updated_at", "resolved_at")
