from datetime import timedelta

from common.pagination import StandardResultsSetPagination
from django.contrib.auth import get_user_model
from django.db.models import Case, Count, IntegerField, Prefetch, Q, Value, When
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .filters import (
    apply_maintenance_boolean_filters,
    apply_maintenance_date_filters,
    apply_maintenance_ordering,
    apply_maintenance_people_filters,
    apply_maintenance_search,
    apply_query_param_filters,
)
from .models import (
    MaintenanceAssignment,
    MaintenanceAttachment,
    MaintenanceEscalation,
    MaintenanceLabor,
    MaintenanceStatusHistory,
    MaintenanceTask,
    MaintenanceWorkOrder,
)
from .permissions import HasMaintenancePermission
from .serializers import (
    EscalationSerializer,
    HistorySerializer,
    MaintenanceAssignmentCandidateSerializer,
    MaintenanceAssignmentHistorySerializer,
    MaintenanceEscalationAcknowledgeSerializer,
    MaintenanceEscalationResolveSerializer,
    MaintenanceReassignSerializer,
    MaintenanceSLARecalculateSerializer,
    MaintenanceUnassignSerializer,
    SLASerializer,
    WorkOrderAssignSerializer,
    WorkOrderCancelSerializer,
    WorkOrderCompleteSerializer,
    WorkOrderCreateSerializer,
    WorkOrderHoldSerializer,
    WorkOrderListSerializer,
    WorkOrderReopenSerializer,
    WorkOrderResumeSerializer,
    WorkOrderSerializer,
    WorkOrderStartSerializer,
    WorkOrderSubmitSerializer,
    WorkOrderUpdateSerializer,
)
from .tenant_scope import scope_work_orders_to_user
from .work_order_sla_service import recalculate_work_order_sla

User = get_user_model()


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
                active_escalation_count=Count(
                    "escalations",
                    filter=Q(escalations__status__in=("open", "acknowledged")),
                    distinct=True,
                ),
                priority_rank=Case(
                    When(priority=MaintenanceWorkOrder.Priority.LOW, then=Value(1)),
                    When(priority=MaintenanceWorkOrder.Priority.MEDIUM, then=Value(2)),
                    When(priority=MaintenanceWorkOrder.Priority.HIGH, then=Value(3)),
                    When(
                        priority=MaintenanceWorkOrder.Priority.CRITICAL, then=Value(4)
                    ),
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
                    When(status=MaintenanceWorkOrder.Status.REOPENED, then=Value(8)),
                    When(status=MaintenanceWorkOrder.Status.CLOSED, then=Value(9)),
                    default=Value(0),
                    output_field=IntegerField(),
                ),
            )
            .distinct()
        )
        queryset = scope_work_orders_to_user(queryset, self.request.user)
        if self.action == "retrieve":
            queryset = queryset.prefetch_related(
                Prefetch(
                    "assignments",
                    queryset=MaintenanceAssignment.objects.select_related(
                        "tenant",
                        "assigned_to",
                        "supervisor",
                        "previous_assigned_to",
                        "previous_supervisor",
                        "assigned_by",
                    ),
                ),
                Prefetch(
                    "tasks",
                    queryset=MaintenanceTask.objects.select_related("assigned_to"),
                ),
                "materials",
                Prefetch(
                    "labor_entries",
                    queryset=MaintenanceLabor.objects.select_related("performed_by"),
                ),
                Prefetch(
                    "status_history_entries",
                    queryset=MaintenanceStatusHistory.objects.select_related(
                        "changed_by"
                    ),
                ),
                Prefetch(
                    "escalations",
                    queryset=MaintenanceEscalation.objects.select_related(
                        "tenant",
                        "sla",
                        "escalated_by",
                        "escalated_to",
                        "acknowledged_by",
                        "resolved_by",
                    ),
                ),
                Prefetch(
                    "attachments",
                    queryset=MaintenanceAttachment.objects.select_related(
                        "uploaded_by"
                    ),
                ),
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
            self.required_permissions_any = (
                "maintenance.work_order.view",
                "maintenance.view",
                "maintenance.manage",
            )
        elif self.action == "assignments":
            self.required_permissions_any = (
                "maintenance.work_order.view_assignment",
                "maintenance.view_assignment",
                "maintenance.manage",
            )
        elif self.action == "sla":
            self.required_permissions_any = (
                "maintenance.work_order.view_sla",
                "maintenance.view_sla",
                "maintenance.manage",
            )
        elif self.action == "recalculate_sla":
            self.required_permissions_any = (
                "maintenance.work_order.recalculate_sla",
                "maintenance.recalculate_sla",
                "maintenance.manage",
            )
        elif self.action == "escalations":
            self.required_permissions_any = (
                "maintenance.work_order.view_escalation",
                "maintenance.view_escalation",
                "maintenance.manage",
            )
        elif self.action in ("acknowledge_escalation", "resolve_escalation"):
            action_code = self.action.removesuffix("_escalation") + "_escalation"
            self.required_permissions_any = (
                f"maintenance.work_order.{action_code}",
                f"maintenance.{action_code}",
                "maintenance.manage",
            )
        elif self.action == "assignment_candidates":
            self.required_permissions_any = (
                "maintenance.work_order.view_assignment",
                "maintenance.view_assignment",
                "maintenance.work_order.assign",
                "maintenance.assign",
                "maintenance.work_order.reassign",
                "maintenance.reassign",
                "maintenance.manage",
            )
        elif self.action == "create":
            self.required_permissions_any = (
                "maintenance.work_order.create",
                "maintenance.create",
                "maintenance.manage",
            )
        elif self.action in ("partial_update", "update"):
            self.required_permissions_any = (
                "maintenance.work_order.update",
                "maintenance.update",
                "maintenance.manage",
            )
        elif self.action in {
            "submit",
            "assign",
            "reassign",
            "unassign",
            "start",
            "hold",
            "resume",
            "complete",
            "cancel",
            "reopen",
        }:
            self.required_permissions_any = (
                f"maintenance.work_order.{self.action}",
                f"maintenance.{self.action}",
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
        if self.action == "submit":
            return WorkOrderSubmitSerializer
        if self.action == "assign":
            return WorkOrderAssignSerializer
        if self.action == "reassign":
            return MaintenanceReassignSerializer
        if self.action == "unassign":
            return MaintenanceUnassignSerializer
        if self.action == "assignments":
            return MaintenanceAssignmentHistorySerializer
        if self.action == "assignment_candidates":
            return MaintenanceAssignmentCandidateSerializer
        if self.action == "sla":
            return SLASerializer
        if self.action == "recalculate_sla":
            return MaintenanceSLARecalculateSerializer
        if self.action == "escalations":
            return EscalationSerializer
        if self.action == "acknowledge_escalation":
            return MaintenanceEscalationAcknowledgeSerializer
        if self.action == "resolve_escalation":
            return MaintenanceEscalationResolveSerializer
        if self.action == "start":
            return WorkOrderStartSerializer
        if self.action == "hold":
            return WorkOrderHoldSerializer
        if self.action == "resume":
            return WorkOrderResumeSerializer
        if self.action == "complete":
            return WorkOrderCompleteSerializer
        if self.action == "cancel":
            return WorkOrderCancelSerializer
        if self.action == "reopen":
            return WorkOrderReopenSerializer
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
        return self._run_workflow_action(request, work_order)

    @action(detail=True, methods=["post"], url_path="reassign")
    def reassign(self, request, pk=None):
        return self._run_workflow_action(request, self.get_object())

    @action(detail=True, methods=["post"], url_path="unassign")
    def unassign(self, request, pk=None):
        return self._run_workflow_action(request, self.get_object())

    @action(detail=True, methods=["get"], url_path="assignments")
    def assignments(self, request, pk=None):
        queryset = self.get_object().assignments.select_related(
            "tenant",
            "assigned_to",
            "supervisor",
            "previous_assigned_to",
            "previous_supervisor",
            "assigned_by",
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="assignment-candidates")
    def assignment_candidates(self, request, pk=None):
        work_order = self.get_object()
        queryset = (
            User.objects.filter(
                is_active=True,
                tenant=work_order.tenant,
            )
            .prefetch_related("user_roles__role")
            .order_by("first_name", "last_name", "email")
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="sla")
    def sla(self, request, pk=None):
        sla = recalculate_work_order_sla(work_order=self.get_object())
        return Response(self.get_serializer(sla).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="sla/recalculate")
    def recalculate_sla(self, request, pk=None):
        work_order = self.get_object()
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request, "work_order": work_order},
        )
        serializer.is_valid(raise_exception=True)
        sla = serializer.save()
        return Response(SLASerializer(sla).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="escalations")
    def escalations(self, request, pk=None):
        queryset = self.get_object().escalations.select_related(
            "tenant",
            "sla",
            "escalated_by",
            "escalated_to",
            "acknowledged_by",
            "resolved_by",
        )
        return Response(self.get_serializer(queryset, many=True).data)

    def _run_escalation_action(self, request, escalation_id):
        work_order = self.get_object()
        escalation = get_object_or_404(
            MaintenanceEscalation,
            pk=escalation_id,
            work_order=work_order,
            tenant=work_order.tenant,
        )
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request, "escalation": escalation},
        )
        serializer.is_valid(raise_exception=True)
        escalation = serializer.save()
        return Response(EscalationSerializer(escalation).data)

    @action(
        detail=True,
        methods=["post"],
        url_path=r"escalations/(?P<escalation_id>[^/.]+)/acknowledge",
    )
    def acknowledge_escalation(self, request, pk=None, escalation_id=None):
        return self._run_escalation_action(request, escalation_id)

    @action(
        detail=True,
        methods=["post"],
        url_path=r"escalations/(?P<escalation_id>[^/.]+)/resolve",
    )
    def resolve_escalation(self, request, pk=None, escalation_id=None):
        return self._run_escalation_action(request, escalation_id)

    def _run_workflow_action(self, request, work_order):
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request, "work_order": work_order},
        )
        serializer.is_valid(raise_exception=True)
        updated_work_order = serializer.save()
        response_serializer = WorkOrderSerializer(
            updated_work_order,
            context=self.get_serializer_context(),
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        work_order = self.get_object()
        return self._run_workflow_action(request, work_order)

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        work_order = self.get_object()
        return self._run_workflow_action(request, work_order)

    @action(detail=True, methods=["post"], url_path="hold")
    def hold(self, request, pk=None):
        work_order = self.get_object()
        return self._run_workflow_action(request, work_order)

    @action(detail=True, methods=["post"], url_path="resume")
    def resume(self, request, pk=None):
        work_order = self.get_object()
        return self._run_workflow_action(request, work_order)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        work_order = self.get_object()
        return self._run_workflow_action(request, work_order)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        work_order = self.get_object()
        return self._run_workflow_action(request, work_order)

    @action(detail=True, methods=["post"], url_path="reopen")
    def reopen(self, request, pk=None):
        work_order = self.get_object()
        return self._run_workflow_action(request, work_order)
