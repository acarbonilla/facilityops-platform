from rest_framework import serializers

from .models import Notification
from .preference_services import normalize_channel, normalize_source_module


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id",
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
        read_only_fields = fields


class UnreadCountSerializer(serializers.Serializer):
    unread_count = serializers.IntegerField(min_value=0)


class UpdatedCountSerializer(serializers.Serializer):
    updated_count = serializers.IntegerField(min_value=0)


class NotificationBulkStateSerializer(serializers.Serializer):
    notification_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False,
        min_length=1,
        max_length=100,
    )
    is_read = serializers.BooleanField()


class NotificationBulkStateResponseSerializer(serializers.Serializer):
    updated_count = serializers.IntegerField(min_value=0)
    is_read = serializers.BooleanField()


class NotificationPreferenceItemSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    source_module = serializers.CharField(max_length=100, allow_blank=True)
    channel = serializers.CharField(max_length=20)
    is_enabled = serializers.BooleanField()
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)


class NotificationPreferencesResponseSerializer(serializers.Serializer):
    defaults = serializers.DictField(child=serializers.BooleanField())
    preferences = NotificationPreferenceItemSerializer(many=True)


class NotificationPreferenceUpdateItemSerializer(serializers.Serializer):
    source_module = serializers.CharField(max_length=100, allow_blank=True, default="")
    channel = serializers.CharField(max_length=20)
    is_enabled = serializers.BooleanField(allow_null=True)

    def validate_source_module(self, value):
        return normalize_source_module(value)

    def validate_channel(self, value):
        return normalize_channel(value)


class NotificationPreferencesUpdateSerializer(serializers.Serializer):
    preferences = NotificationPreferenceUpdateItemSerializer(many=True)
