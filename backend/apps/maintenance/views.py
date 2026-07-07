from datetime import timedelta

from django.db.models import Case, Count, IntegerField, Value, When
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.pagination import StandardResultsSetPagination

from .filters import (
    apply_maintenance_boolean_filters,
    apply_maintenance_date_filters,
    apply_maintenance_ordering,
    apply_maintenance_people_filters,
    apply_maintenance_search,
    apply_query_param_filters,
)
from .models import MaintenanceWorkOrder
from .permissions import HasMaintenancePermission
from .serializers import (
    HistorySerializer,
    WorkOrderAssignSerializer,
    WorkOrderCompleteSerializer,
    WorkOrderCreateSerializer,
    WorkOrderListSerializer,
    WorkOrderSerializer,
    WorkOrderStatusSerializer,
    WorkOrderUpdateSerializer,
)
from .services import change_status


class MaintenanceWorkOrderViewSet(viewsets.ModelViewSet):
    queryset = MaintenanceWorkOrder.objects.select_related(
        "tenant",
        "organization",
        "department",
        "building",
        "floor",
        "area",
        "asset",
        "requester",
        "assignee",
        "sla_record",
        "completion_record",
        "ai_summary",
        "supervisor_approval",
    ).prefetch_related(
        "assignments",
        "tasks",
        "materials",
        "labor_entries",
        "status_history_entries",
        "escalations",
        "attachments",
    )
    permission_classes = [IsAuthenticated, HasMaintenancePermission]
    pagination_class = StandardResultsSetPagination
    http_method_names = ["get", "post", "patch", "head", "options"]
    filter_fields = (
        "status",
        "priority",
        "tenant",
        "organization",
        "department",
        "building",
        "floor",
        "area",
        "asset",
        "requester",
        "assignee",
    )

    def get_queryset(self):
        queryset = (
            super()
            .get_queryset()
            .annotate(
                attachments_count=Count("attachments", distinct=True),
                priority_rank=Case(
                    When(priority=MaintenanceWorkOrder.Priority.LOW, then=Value(1)),
                    When(priority=MaintenanceWorkOrder.Priority.MEDIUM, then=Value(2)),
                    When(priority=MaintenanceWorkOrder.Priority.HIGH, then=Value(3)),
                    When(priority=MaintenanceWorkOrder.Priority.CRITICAL, then=Value(4)),
                    default=Value(0),
                    output_field=IntegerField(),
                ),
                status_rank=Case(
                    When(status=MaintenanceWorkOrder.Status.DRAFT, then=Value(1)),
                    When(status=MaintenanceWorkOrder.Status.OPEN, then=Value(2)),
                    When(status=MaintenanceWorkOrder.Status.ASSIGNED, then=Value(3)),
                    When(
                        status=MaintenanceWorkOrder.Status.IN_PROGRESS,
                        then=Value(4),
                    ),
                    When(status=MaintenanceWorkOrder.Status.ON_HOLD, then=Value(5)),
                    When(status=MaintenanceWorkOrder.Status.COMPLETED, then=Value(6)),
                    When(status=MaintenanceWorkOrder.Status.CANCELLED, then=Value(7)),
                    When(status=MaintenanceWorkOrder.Status.CLOSED, then=Value(8)),
                    default=Value(0),
                    output_field=IntegerField(),
                ),
            )
            .distinct()
        )
        queryset = apply_query_param_filters(
            queryset,
            self.request.query_params,
            self.filter_fields,
        )
        queryset = apply_maintenance_search(
            queryset,
            self.request.query_params.get("search"),
        )
        queryset = apply_maintenance_boolean_filters(
            queryset,
            self.request.query_params,
        )
        queryset = apply_maintenance_people_filters(
            queryset,
            self.request.query_params,
        )
        queryset = apply_maintenance_date_filters(
            queryset,
            self.request.query_params,
        )
        queryset = apply_maintenance_ordering(
            queryset,
            self.request.query_params.get("ordering"),
        )
        return queryset

    def get_permissions(self):
        self.required_permission = None
        self.required_permissions_any = None

        if self.action in ("list", "retrieve", "history", "dashboard"):
            self.required_permission = "maintenance.view"
        elif self.action == "create":
            self.required_permission = "maintenance.create"
        elif self.action in ("partial_update", "update"):
            self.required_permission = "maintenance.update"
        elif self.action == "assign":
            self.required_permission = "maintenance.assign"
        elif self.action == "complete":
            self.required_permissions_any = (
                "maintenance.complete",
                "maintenance.manage",
            )
        elif self.action == "change_status":
            target_status = self.request.data.get("status")
            if target_status in {
                MaintenanceWorkOrder.Status.COMPLETED,
                MaintenanceWorkOrder.Status.CLOSED,
            }:
                self.required_permissions_any = (
                    "maintenance.complete",
                    "maintenance.manage",
                )
            else:
                self.required_permissions_any = (
                    "maintenance.update",
                    "maintenance.manage",
                )
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "list":
            return WorkOrderListSerializer
        if self.action == "create":
            return WorkOrderCreateSerializer
        if self.action in ("partial_update", "update"):
            return WorkOrderUpdateSerializer
        if self.action == "assign":
            return WorkOrderAssignSerializer
        if self.action == "change_status":
            return WorkOrderStatusSerializer
        if self.action == "complete":
            return WorkOrderCompleteSerializer
        if self.action == "history":
            return HistorySerializer
        return WorkOrderSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        work_order = serializer.save()
        response_serializer = WorkOrderSerializer(
            work_order,
            context=self.get_serializer_context(),
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        work_order = self.get_object()
        serializer = self.get_serializer(work_order, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        work_order = serializer.save()
        response_serializer = WorkOrderSerializer(
            work_order,
            context=self.get_serializer_context(),
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        work_order = self.get_object()
        queryset = work_order.history_entries.select_related("actor")
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = HistorySerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = HistorySerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        now = timezone.now()
        recently_updated_since = now - timedelta(days=7)
        overdue_queryset = queryset.filter(due_at__lt=now).exclude(
            status__in=(
                MaintenanceWorkOrder.Status.COMPLETED,
                MaintenanceWorkOrder.Status.CANCELLED,
                MaintenanceWorkOrder.Status.CLOSED,
            )
        )
        payload = {
            "total_work_orders": queryset.count(),
            "open": queryset.filter(status=MaintenanceWorkOrder.Status.OPEN).count(),
            "assigned": queryset.filter(
                status=MaintenanceWorkOrder.Status.ASSIGNED
            ).count(),
            "in_progress": queryset.filter(
                status=MaintenanceWorkOrder.Status.IN_PROGRESS
            ).count(),
            "completed": queryset.filter(
                status=MaintenanceWorkOrder.Status.COMPLETED
            ).count(),
            "cancelled": queryset.filter(
                status=MaintenanceWorkOrder.Status.CANCELLED
            ).count(),
            "overdue": overdue_queryset.count(),
            "high_priority": queryset.filter(
                priority=MaintenanceWorkOrder.Priority.HIGH
            ).count(),
            "critical": queryset.filter(
                priority=MaintenanceWorkOrder.Priority.CRITICAL
            ).count(),
            "recently_updated": queryset.filter(
                updated_at__gte=recently_updated_since
            ).count(),
        }
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        work_order = self.get_object()
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request, "work_order": work_order},
        )
        serializer.is_valid(raise_exception=True)
        work_order = serializer.save()
        response_serializer = WorkOrderSerializer(
            work_order,
            context=self.get_serializer_context(),
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, pk=None):
        work_order = self.get_object()
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request, "work_order": work_order},
        )
        serializer.is_valid(raise_exception=True)
        work_order = change_status(
            work_order=work_order,
            to_status=serializer.validated_data["status"],
            changed_by=request.user,
            note=serializer.validated_data.get("note", ""),
            cancellation_reason=serializer.validated_data.get(
                "cancellation_reason",
                "",
            ),
        )
        response_serializer = WorkOrderSerializer(
            work_order,
            context=self.get_serializer_context(),
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        work_order = self.get_object()
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request, "work_order": work_order},
        )
        serializer.is_valid(raise_exception=True)
        work_order = serializer.save()
        response_serializer = WorkOrderSerializer(
            work_order,
            context=self.get_serializer_context(),
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)
