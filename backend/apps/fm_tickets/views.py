from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from apps.access_control.services import user_has_permission
from common.pagination import StandardResultsSetPagination
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404

from .filters import apply_query_param_filters
from .models import FmTicket
from .serializers import (
    FmTicketAssignSerializer,
    FmTicketCommentSerializer,
    FmTicketCreateSerializer,
    FmTicketDetailSerializer,
    FmTicketEscalationCreateSerializer,
    FmTicketEscalationSerializer,
    FmTicketHistorySerializer,
    FmTicketListSerializer,
    FmTicketStatusChangeSerializer,
    FmTicketUpdateSerializer,
    GeneratedWorkOrderSummarySerializer,
)
from .services import assign_ticket, change_ticket_status
from .tenant_scope import scope_fm_ticket_queryset
from .work_order_service import (
    WorkOrderAlreadyLinked,
    generate_work_order_from_ticket,
)


class HasTicketPermission(BasePermission):
    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        required_permission = getattr(view, "required_permission", None)
        if required_permission:
            return user_has_permission(request.user, required_permission)

        required_permissions_any = getattr(view, "required_permissions_any", None)
        if required_permissions_any:
            return any(
                user_has_permission(request.user, permission_code)
                for permission_code in required_permissions_any
            )

        return False


class FmTicketViewSet(viewsets.ModelViewSet):
    queryset = FmTicket.objects.select_related(
        "tenant",
        "organization",
        "department",
        "building",
        "floor",
        "area",
        "asset",
        "requester",
        "assignee",
        "maintenance_work_order",
    )
    permission_classes = [IsAuthenticated, HasTicketPermission]
    pagination_class = StandardResultsSetPagination
    http_method_names = ["get", "post", "patch", "head", "options"]
    filter_fields = (
        "status",
        "priority",
        "category",
        "source",
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
        queryset = scope_fm_ticket_queryset(
            super().get_queryset(),
            self.request.user,
        ).filter(is_deleted=False)
        return apply_query_param_filters(
            queryset,
            self.request.query_params,
            self.filter_fields,
        )

    def get_permissions(self):
        self.required_permission = None
        self.required_permissions_any = None

        if self.action in ("list", "retrieve", "history", "escalations"):
            self.required_permission = "fm_tickets.view"
        elif self.action == "create":
            self.required_permission = "fm_tickets.create"
        elif self.action in ("partial_update", "update"):
            self.required_permission = "fm_tickets.update"
        elif self.action == "comments":
            self.required_permission = (
                "fm_tickets.view"
                if self.request.method == "GET"
                else "fm_tickets.update"
            )
        elif self.action == "assign":
            self.required_permission = "fm_tickets.assign"
        elif self.action == "generate_work_order":
            self.required_permissions_any = (
                "fm_tickets.assign",
                "fm_tickets.manage",
            )
        elif self.action == "escalate":
            self.required_permission = "fm_tickets.manage"
        elif self.action == "change_status":
            target_status = self.request.data.get("status")
            if target_status in {
                FmTicket.Status.RESOLVED,
                FmTicket.Status.CLOSED,
                FmTicket.Status.CANCELLED,
            }:
                self.required_permissions_any = (
                    "fm_tickets.close",
                    "fm_tickets.manage",
                )
            else:
                self.required_permissions_any = (
                    "fm_tickets.update",
                    "fm_tickets.manage",
                )
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "list":
            return FmTicketListSerializer
        if self.action == "create":
            return FmTicketCreateSerializer
        if self.action in ("partial_update", "update"):
            return FmTicketUpdateSerializer
        if self.action == "comments":
            return FmTicketCommentSerializer
        if self.action == "history":
            return FmTicketHistorySerializer
        if self.action == "escalations":
            return FmTicketEscalationSerializer
        if self.action == "escalate":
            return FmTicketEscalationCreateSerializer
        return FmTicketDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
        response_serializer = FmTicketDetailSerializer(ticket, context=self.get_serializer_context())
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        ticket = self.get_object()
        serializer = self.get_serializer(ticket, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        ticket = serializer.save()
        response_serializer = FmTicketDetailSerializer(ticket, context=self.get_serializer_context())
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        ticket = self.get_object()

        if request.method == "GET":
            queryset = ticket.comments.select_related("author")
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = FmTicketCommentSerializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            serializer = FmTicketCommentSerializer(queryset, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = FmTicketCommentSerializer(
            data=request.data,
            context={"request": request, "ticket": ticket},
        )
        serializer.is_valid(raise_exception=True)
        comment = serializer.save()
        response_serializer = FmTicketCommentSerializer(comment)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        ticket = self.get_object()
        queryset = ticket.history_entries.select_related("actor")
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = FmTicketHistorySerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = FmTicketHistorySerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="escalations")
    def escalations(self, request, pk=None):
        ticket = self.get_object()
        queryset = ticket.escalations.select_related(
            "escalated_by",
            "escalated_to",
            "resolved_by",
        )
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = FmTicketEscalationSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = FmTicketEscalationSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        ticket = self.get_object()
        caller_tenant_id = getattr(request.user, "tenant_id", None)
        if caller_tenant_id is None or ticket.tenant_id != caller_tenant_id:
            raise Http404()

        serializer = FmTicketAssignSerializer(
            data=request.data,
            context={"ticket": ticket},
        )
        serializer.is_valid(raise_exception=True)
        try:
            ticket = assign_ticket(
                ticket=ticket,
                assigned_to=serializer.validated_data["assignee"],
                assigned_by=request.user,
                note=serializer.validated_data.get("note", ""),
            )
        except DjangoValidationError as exc:
            detail = getattr(exc, "message_dict", None) or exc.messages
            raise DRFValidationError(detail) from exc
        response_serializer = FmTicketDetailSerializer(ticket)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="generate-work-order")
    def generate_work_order(self, request, pk=None):
        ticket = self.get_object()
        caller_tenant_id = getattr(request.user, "tenant_id", None)
        if caller_tenant_id is None or ticket.tenant_id != caller_tenant_id:
            raise Http404()

        try:
            work_order = generate_work_order_from_ticket(
                ticket=ticket,
                generated_by=request.user,
            )
        except FmTicket.DoesNotExist as exc:
            raise Http404() from exc
        except WorkOrderAlreadyLinked:
            raise
        except DjangoValidationError as exc:
            detail = getattr(exc, "message_dict", None) or exc.messages
            raise DRFValidationError(detail) from exc

        response_serializer = GeneratedWorkOrderSummarySerializer(work_order)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="escalate")
    def escalate(self, request, pk=None):
        ticket = self.get_object()
        serializer = FmTicketEscalationCreateSerializer(
            data=request.data,
            context={"request": request, "ticket": ticket},
        )
        serializer.is_valid(raise_exception=True)
        escalation = serializer.save()
        response_serializer = FmTicketEscalationSerializer(escalation)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="change-status")
    def change_status(self, request, pk=None):
        ticket = self.get_object()
        serializer = FmTicketStatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ticket = change_ticket_status(
            ticket=ticket,
            to_status=serializer.validated_data["status"],
            changed_by=request.user,
            note=serializer.validated_data.get("note", ""),
        )
        response_serializer = FmTicketDetailSerializer(ticket)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
