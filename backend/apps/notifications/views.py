from rest_framework import filters, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.mixins import ListModelMixin, RetrieveModelMixin
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.pagination import StandardResultsSetPagination

from .models import Notification
from .serializers import (
    NotificationBulkStateResponseSerializer,
    NotificationBulkStateSerializer,
    NotificationSerializer,
    UnreadCountSerializer,
    UpdatedCountSerializer,
)
from .services import (
    bulk_update_notification_state,
    mark_all_notifications_read,
    mark_notification_read,
    mark_notification_unread,
)


class NotificationExactFilterBackend:
    fields = {
        "is_read": serializers.BooleanField(),
        "severity": serializers.ChoiceField(
            choices=[choice for choice, _label in Notification.Severity.choices]
        ),
        "source_module": serializers.CharField(max_length=100),
    }

    def filter_queryset(self, request, queryset, view):
        filters_to_apply = {
            field: serializer.run_validation(request.query_params[field])
            for field, serializer in self.fields.items()
            if field in request.query_params
        }
        return queryset.filter(**filters_to_apply)


class NotificationViewSet(ListModelMixin, RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = (NotificationExactFilterBackend, filters.OrderingFilter)
    ordering_fields = ("created_at",)
    ordering = ("-created_at", "-id")

    def get_queryset(self):
        base_queryset = Notification.objects.select_related(
            "tenant",
            "recipient",
        )
        user = self.request.user

        if user.tenant_id:
            return base_queryset.filter(
                recipient_id=user.id,
                tenant_id=user.tenant_id,
            )

        return base_queryset.filter(
            recipient_id=user.id,
            tenant__isnull=True,
        )

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        payload = {
            "unread_count": self.get_queryset().filter(is_read=False).count()
        }
        serializer = UnreadCountSerializer(payload)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = mark_notification_read(self.get_object())
        return Response(NotificationSerializer(notification).data)

    @action(detail=True, methods=["post"], url_path="mark-unread")
    def mark_unread(self, request, pk=None):
        notification = mark_notification_unread(self.get_object())
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        updated_count = mark_all_notifications_read(self.get_queryset())
        serializer = UpdatedCountSerializer({"updated_count": updated_count})
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="bulk-state")
    def bulk_state(self, request):
        serializer = NotificationBulkStateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated_count = bulk_update_notification_state(
            self.get_queryset(),
            serializer.validated_data["notification_ids"],
            serializer.validated_data["is_read"],
        )
        response = NotificationBulkStateResponseSerializer(
            {
                "updated_count": updated_count,
                "is_read": serializer.validated_data["is_read"],
            }
        )
        return Response(response.data)
