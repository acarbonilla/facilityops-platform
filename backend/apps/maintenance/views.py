from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.pagination import StandardResultsSetPagination

from .filters import apply_query_param_filters
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
        queryset = super().get_queryset()
        return apply_query_param_filters(
            queryset,
            self.request.query_params,
            self.filter_fields,
        )

    def get_permissions(self):
        self.required_permission = None
        self.required_permissions_any = None

        if self.action in ("list", "retrieve", "history"):
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
