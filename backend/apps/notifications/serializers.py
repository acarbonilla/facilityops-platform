from rest_framework import serializers

from .models import Notification


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
