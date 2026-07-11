from django.db.models import Case, Count, IntegerField, Prefetch, Q, Value, When
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from common.pagination import StandardResultsSetPagination

from .filters import (
    apply_corrective_action_filters,
    apply_finding_filters,
    apply_inspection_date_filters,
    apply_inspection_numeric_filters,
    apply_inspection_ordering,
    apply_inspection_search,
    apply_query_param_filters,
)
from .models import (
    Inspection,
    InspectionAttachment,
    InspectionComment,
    InspectionCorrectiveAction,
    InspectionFinding,
    InspectionItem,
)
from .permissions import HasInspectionPermission
from .serializers import (
    InspectionAISerializer,
    InspectionAssignmentActionSerializer,
    InspectionAttachmentSerializer,
    InspectionCancelSerializer,
    InspectionCommentSerializer,
    InspectionCompleteSerializer,
    InspectionCorrectiveActionSerializer,
    InspectionCreateSerializer,
    InspectionDetailSerializer,
    InspectionFindingSerializer,
    InspectionHistorySerializer,
    InspectionItemCreateSerializer,
    InspectionItemSerializer,
    InspectionListSerializer,
    InspectionReopenSerializer,
    InspectionSerializer,
    InspectionStartSerializer,
    InspectionUpdateSerializer,
    InspectionVerifySerializer,
)
from .services.inspection_service import (
    soft_delete_inspection,
    soft_delete_inspection_corrective_action,
    soft_delete_inspection_finding,
)
from .tenant_scope import scope_queryset_to_user


class InspectionViewSet(viewsets.ModelViewSet):
    queryset = Inspection.objects.select_related(
        "tenant",
        "organization",
        "department",
        "building",
        "floor",
        "area",
        "inspector",
        "supervisor",
    )
    permission_classes = [IsAuthenticated, HasInspectionPermission]
    pagination_class = StandardResultsSetPagination
    http_method_names = ["get", "post", "patch", "put", "delete", "head", "options"]
    filter_fields = (
        "status",
        "priority",
        "tenant",
        "organization",
        "department",
        "building",
        "floor",
        "area",
        "inspection_type",
        "five_s_category",
        "inspector",
        "supervisor",
    )

    def get_queryset(self):
        queryset = (
            super()
            .get_queryset()
            .filter(is_deleted=False)
            .annotate(
                item_count=Count("items", distinct=True),
                finding_count=Count(
                    "findings",
                    filter=Q(findings__is_deleted=False),
                    distinct=True,
                ),
                open_corrective_action_count=Count(
                    "corrective_actions",
                    filter=Q(
                        corrective_actions__is_deleted=False,
                        corrective_actions__finding__is_deleted=False,
                        corrective_actions__status__in=("open", "in_progress", "overdue")
                    ),
                    distinct=True,
                ),
                priority_rank=Case(
                    When(priority=Inspection.Priority.LOW, then=Value(1)),
                    When(priority=Inspection.Priority.MEDIUM, then=Value(2)),
                    When(priority=Inspection.Priority.HIGH, then=Value(3)),
                    When(priority=Inspection.Priority.CRITICAL, then=Value(4)),
                    default=Value(0),
                    output_field=IntegerField(),
                ),
                status_rank=Case(
                    When(status=Inspection.Status.DRAFT, then=Value(1)),
                    When(status=Inspection.Status.SCHEDULED, then=Value(2)),
                    When(status=Inspection.Status.IN_PROGRESS, then=Value(3)),
                    When(status=Inspection.Status.COMPLETED, then=Value(4)),
                    When(status=Inspection.Status.VERIFIED, then=Value(5)),
                    When(status=Inspection.Status.CANCELLED, then=Value(6)),
                    When(status=Inspection.Status.REOPENED, then=Value(7)),
                    default=Value(0),
                    output_field=IntegerField(),
                ),
            )
            .distinct()
        )
        queryset = scope_queryset_to_user(queryset, self.request.user)
        if self.action == "retrieve":
            queryset = queryset.prefetch_related(
                Prefetch("items", queryset=InspectionItem.objects.order_by("sequence")),
                Prefetch(
                    "findings",
                    queryset=InspectionFinding.objects.filter(is_deleted=False).select_related("item"),
                ),
                Prefetch(
                    "attachments",
                    queryset=InspectionAttachment.objects.select_related(
                        "uploaded_by",
                        "finding",
                    ),
                ),
                Prefetch(
                    "comments",
                    queryset=InspectionComment.objects.select_related("author"),
                ),
                "assignments",
                "history_entries",
                "status_history_entries",
                Prefetch(
                    "corrective_actions",
                    queryset=InspectionCorrectiveAction.objects.filter(
                        is_deleted=False,
                        finding__is_deleted=False,
                    ).select_related("assigned_to", "finding"),
                ),
                "escalations",
            )
        queryset = apply_query_param_filters(
            queryset,
            self.request.query_params,
            self.filter_fields,
        )
        queryset = apply_inspection_search(
            queryset,
            self.request.query_params.get("search"),
        )
        queryset = apply_inspection_date_filters(queryset, self.request.query_params)
        queryset = apply_inspection_numeric_filters(queryset, self.request.query_params)
        queryset = apply_inspection_ordering(
            queryset,
            self.request.query_params.get("ordering"),
        )
        return queryset

    def get_permissions(self):
        self.required_permission = None
        self.required_permissions_any = None

        if self.action in (
            "list",
            "retrieve",
            "history",
            "findings",
            "corrective_actions",
        ):
            self.required_permissions_any = ("inspection.view", "inspection.manage")
        elif self.action in ("items", "attachments", "comments"):
            if self.request.method == "GET":
                self.required_permissions_any = (
                    "inspection.view",
                    "inspection.manage",
                )
            else:
                self.required_permissions_any = (
                    "inspection.update",
                    "inspection.manage",
                )
        elif self.action == "ai_analysis":
            if self.request.method == "GET":
                self.required_permissions_any = (
                    "inspection.view_ai",
                    "inspection.manage",
                )
            else:
                self.required_permissions_any = (
                    "inspection.update",
                    "inspection.manage",
                )
        elif self.action == "create":
            self.required_permissions_any = ("inspection.create", "inspection.manage")
        elif self.action in ("partial_update", "update", "start", "cancel", "reopen"):
            self.required_permissions_any = ("inspection.update", "inspection.manage")
        elif self.action == "destroy":
            self.required_permissions_any = ("inspection.delete", "inspection.manage")
        elif self.action == "assign":
            self.required_permissions_any = ("inspection.assign", "inspection.manage")
        elif self.action == "complete":
            self.required_permissions_any = ("inspection.complete", "inspection.manage")
        elif self.action == "verify":
            self.required_permissions_any = ("inspection.verify", "inspection.manage")
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "list":
            return InspectionListSerializer
        if self.action == "create":
            return InspectionCreateSerializer
        if self.action in ("partial_update", "update"):
            return InspectionUpdateSerializer
        if self.action == "items" and self.request.method == "POST":
            return InspectionItemCreateSerializer
        if self.action == "items":
            return InspectionItemSerializer
        if self.action == "attachments":
            return InspectionAttachmentSerializer
        if self.action == "comments":
            return InspectionCommentSerializer
        if self.action == "history":
            return InspectionHistorySerializer
        if self.action == "assign":
            return InspectionAssignmentActionSerializer
        if self.action == "start":
            return InspectionStartSerializer
        if self.action == "complete":
            return InspectionCompleteSerializer
        if self.action == "verify":
            return InspectionVerifySerializer
        if self.action == "cancel":
            return InspectionCancelSerializer
        if self.action == "reopen":
            return InspectionReopenSerializer
        if self.action == "ai_analysis":
            return InspectionAISerializer
        return InspectionDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        inspection = serializer.save()
        response_serializer = InspectionSerializer(
            inspection,
            context=self.get_serializer_context(),
        )
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        inspection = self.get_object()
        serializer = self.get_serializer(inspection, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        inspection = serializer.save()
        response_serializer = InspectionSerializer(
            inspection,
            context=self.get_serializer_context(),
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        inspection = self.get_object()
        serializer = self.get_serializer(inspection, data=request.data)
        serializer.is_valid(raise_exception=True)
        inspection = serializer.save()
        response_serializer = InspectionSerializer(
            inspection,
            context=self.get_serializer_context(),
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def perform_destroy(self, instance):
        soft_delete_inspection(inspection=instance, actor=self.request.user)

    @action(detail=True, methods=["get", "post"], url_path="items")
    def items(self, request, pk=None):
        inspection = self.get_object()
        if request.method == "GET":
            queryset = inspection.items.order_by("sequence", "created_at")
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = InspectionItemSerializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            return Response(InspectionItemSerializer(queryset, many=True).data)

        serializer = self.get_serializer(
            data=request.data,
            context={"request": request, "inspection": inspection},
        )
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        return Response(InspectionItemSerializer(item).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="findings")
    def findings(self, request, pk=None):
        queryset = self.get_object().findings.filter(is_deleted=False).select_related("item")
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = InspectionFindingSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(InspectionFindingSerializer(queryset, many=True).data)

    @action(detail=True, methods=["get", "post"], url_path="attachments")
    def attachments(self, request, pk=None):
        inspection = self.get_object()
        if request.method == "GET":
            queryset = inspection.attachments.select_related("uploaded_by", "finding")
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = InspectionAttachmentSerializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            return Response(InspectionAttachmentSerializer(queryset, many=True).data)

        serializer = self.get_serializer(
            data=request.data,
            context={"request": request, "inspection": inspection},
        )
        serializer.is_valid(raise_exception=True)
        attachment = serializer.save()
        return Response(
            InspectionAttachmentSerializer(attachment).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        inspection = self.get_object()
        if request.method == "GET":
            queryset = inspection.comments.select_related("author")
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = InspectionCommentSerializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            return Response(InspectionCommentSerializer(queryset, many=True).data)

        serializer = self.get_serializer(
            data=request.data,
            context={"request": request, "inspection": inspection},
        )
        serializer.is_valid(raise_exception=True)
        comment = serializer.save()
        return Response(InspectionCommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        queryset = self.get_object().history_entries.select_related("actor")
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = InspectionHistorySerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(InspectionHistorySerializer(queryset, many=True).data)

    @action(detail=True, methods=["get"], url_path="corrective-actions")
    def corrective_actions(self, request, pk=None):
        queryset = self.get_object().corrective_actions.filter(
            is_deleted=False,
            finding__is_deleted=False,
        ).select_related("assigned_to", "finding")
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = InspectionCorrectiveActionSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(InspectionCorrectiveActionSerializer(queryset, many=True).data)

    @action(detail=True, methods=["get", "post"], url_path="ai-analysis")
    def ai_analysis(self, request, pk=None):
        inspection = self.get_object()
        if request.method == "GET":
            serializer = InspectionAISerializer(
                getattr(inspection, "ai_analysis", None),
                context=self.get_serializer_context(),
            )
            return Response(serializer.data if serializer.instance else {}, status=status.HTTP_200_OK)

        serializer = self.get_serializer(
            data=request.data,
            context={"request": request, "inspection": inspection},
        )
        serializer.is_valid(raise_exception=True)
        ai_analysis = serializer.save()
        return Response(
            InspectionAISerializer(
                ai_analysis,
                context=self.get_serializer_context(),
            ).data,
            status=status.HTTP_201_CREATED,
        )

    def _run_action(self, request, serializer_class):
        inspection = self.get_object()
        serializer = serializer_class(
            data=request.data,
            context={"request": request, "inspection": inspection},
        )
        serializer.is_valid(raise_exception=True)
        inspection = serializer.save()
        return Response(
            InspectionSerializer(
                inspection,
                context=self.get_serializer_context(),
            ).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        return self._run_action(request, InspectionAssignmentActionSerializer)

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        return self._run_action(request, InspectionStartSerializer)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        return self._run_action(request, InspectionCompleteSerializer)

    @action(detail=True, methods=["post"], url_path="verify")
    def verify(self, request, pk=None):
        return self._run_action(request, InspectionVerifySerializer)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        return self._run_action(request, InspectionCancelSerializer)

    @action(detail=True, methods=["post"], url_path="reopen")
    def reopen(self, request, pk=None):
        return self._run_action(request, InspectionReopenSerializer)


class InspectionFindingViewSet(viewsets.ModelViewSet):
    queryset = InspectionFinding.objects.select_related("inspection", "item")
    permission_classes = [IsAuthenticated, HasInspectionPermission]
    pagination_class = StandardResultsSetPagination
    http_method_names = ["get", "post", "patch", "put", "delete", "head", "options"]

    def get_queryset(self):
        queryset = scope_queryset_to_user(
            super().get_queryset().filter(
                is_deleted=False,
                inspection__is_deleted=False,
            ),
            self.request.user,
            tenant_field="inspection__tenant_id",
        )
        return apply_finding_filters(queryset, self.request.query_params)

    def get_permissions(self):
        self.required_permission = None
        self.required_permissions_any = None
        if self.action in ("list", "retrieve"):
            self.required_permissions_any = ("inspection.view", "inspection.manage")
        elif self.action == "destroy":
            self.required_permissions_any = ("inspection.delete", "inspection.manage")
        else:
            self.required_permissions_any = ("inspection.update", "inspection.manage")
        return super().get_permissions()

    def get_serializer_class(self):
        return InspectionFindingSerializer

    def perform_create(self, serializer):
        serializer.save(
            created_by=str(self.request.user.id),
            updated_by=str(self.request.user.id),
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=str(self.request.user.id))

    def perform_destroy(self, instance):
        soft_delete_inspection_finding(finding=instance, actor=self.request.user)


class InspectionCorrectiveActionViewSet(viewsets.ModelViewSet):
    queryset = InspectionCorrectiveAction.objects.select_related(
        "inspection",
        "finding",
        "assigned_to",
    )
    permission_classes = [IsAuthenticated, HasInspectionPermission]
    pagination_class = StandardResultsSetPagination
    http_method_names = ["get", "post", "patch", "put", "delete", "head", "options"]

    def get_queryset(self):
        queryset = scope_queryset_to_user(
            super().get_queryset().filter(
                is_deleted=False,
                inspection__is_deleted=False,
                finding__is_deleted=False,
            ),
            self.request.user,
            tenant_field="inspection__tenant_id",
        )
        return apply_corrective_action_filters(queryset, self.request.query_params)

    def get_permissions(self):
        self.required_permission = None
        self.required_permissions_any = None
        if self.action in ("list", "retrieve"):
            self.required_permissions_any = ("inspection.view", "inspection.manage")
        elif self.action == "destroy":
            self.required_permissions_any = ("inspection.delete", "inspection.manage")
        else:
            self.required_permissions_any = (
                "inspection.manage_corrective_action",
                "inspection.manage",
            )
        return super().get_permissions()

    def get_serializer_class(self):
        return InspectionCorrectiveActionSerializer

    def perform_destroy(self, instance):
        soft_delete_inspection_corrective_action(
            corrective_action=instance,
            actor=self.request.user,
        )
