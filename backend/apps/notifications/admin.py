from django.contrib import admin

from .models import Notification, NotificationDelivery, NotificationPreference


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


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    actions = None
    list_display = (
        "id",
        "recipient",
        "tenant",
        "source_module",
        "channel",
        "is_enabled",
        "created_at",
        "updated_at",
    )
    search_fields = ("recipient__email", "source_module")
    list_filter = ("channel", "is_enabled", "source_module", "tenant", "created_at")
    ordering = ("recipient__email", "source_module", "channel")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(NotificationDelivery)
class NotificationDeliveryAdmin(admin.ModelAdmin):
    actions = None
    list_display = (
        "id",
        "notification",
        "recipient",
        "tenant",
        "channel",
        "status",
        "attempt_count",
        "delivered_at",
        "created_at",
    )
    search_fields = (
        "recipient__email",
        "notification__event_code",
        "provider_reference",
    )
    list_filter = ("channel", "status", "tenant", "created_at")
    ordering = ("-created_at",)
    readonly_fields = (
        "id",
        "notification",
        "recipient",
        "tenant",
        "channel",
        "status",
        "attempt_count",
        "last_attempt_at",
        "delivered_at",
        "failure_code",
        "failure_message",
        "provider_reference",
        "metadata",
        "created_at",
        "updated_at",
    )
