from rest_framework import filters, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.mixins import ListModelMixin, RetrieveModelMixin
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.pagination import StandardResultsSetPagination

from .models import Notification
from .serializers import NotificationSerializer, UnreadCountSerializer


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
