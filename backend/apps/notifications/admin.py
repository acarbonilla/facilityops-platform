from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    actions = None
    list_display = (
        "id",
        "recipient",
        "tenant",
        "event_code",
        "severity",
        "is_read",
        "created_at",
        "read_at",
    )
    search_fields = (
        "recipient__email",
        "event_code",
        "title",
        "message",
        "source_module",
        "source_object_id",
    )
    list_filter = ("is_read", "severity", "source_module", "tenant", "created_at")
    ordering = ("-created_at",)
    readonly_fields = (
        "id",
        "tenant",
        "recipient",
        "event_code",
        "title",
        "message",
        "severity",
        "target_url",
        "source_module",
        "source_object_id",
        "metadata",
        "is_read",
        "read_at",
        "created_at",
        "updated_at",
    )
