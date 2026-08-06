from common.pagination import StandardResultsSetPagination
from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .filters import (
    apply_project_date_filters,
    apply_project_ordering,
    apply_project_search,
    apply_query_param_filters,
)
from .models import Project, ProjectMember
from .permissions import HasProjectPermission
from .serializers import (
    ProjectCreateSerializer,
    ProjectDetailSerializer,
    ProjectHistorySerializer,
    ProjectListSerializer,
    ProjectMemberCreateSerializer,
    ProjectMemberSerializer,
    ProjectUpdateSerializer,
)
from .services import remove_project_member, soft_delete_project
from .tenant_scope import scope_projects_to_user


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.select_related(
        "tenant",
        "organization",
        "building",
        "project_manager",
    )
    permission_classes = [IsAuthenticated, HasProjectPermission]
    pagination_class = StandardResultsSetPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filter_fields = (
        "status",
        "priority",
        "organization",
        "building",
        "project_manager",
    )

    def get_queryset(self):
        queryset = super().get_queryset().filter(is_deleted=False)
        queryset = scope_projects_to_user(queryset, self.request.user)
        queryset = apply_query_param_filters(
            queryset,
            self.request.query_params,
            self.filter_fields,
        )
        queryset = apply_project_search(
            queryset,
            self.request.query_params.get("search"),
        )
        queryset = apply_project_date_filters(
            queryset,
            self.request.query_params,
        )
        queryset = apply_project_ordering(
            queryset,
            self.request.query_params.get("ordering"),
        )
        return queryset

    def get_permissions(self):
        self.required_permission = None
        self.required_permissions_any = None

        if self.action in ("list", "retrieve", "history", "metrics"):
            self.required_permissions_any = ("projects.view", "projects.manage")
        elif self.action == "create":
            self.required_permissions_any = ("projects.create", "projects.manage")
        elif self.action in ("partial_update", "update"):
            self.required_permissions_any = ("projects.update", "projects.manage")
        elif self.action == "destroy":
            self.required_permissions_any = ("projects.delete", "projects.manage")
        elif self.action in ("members", "destroy_member"):
            if self.request.method == "GET":
                self.required_permissions_any = (
                    "projects.view",
                    "projects.manage",
                )
            else:
                self.required_permissions_any = (
                    "projects.members.manage",
                    "projects.manage",
                )
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "list":
            return ProjectListSerializer
        if self.action == "create":
            return ProjectCreateSerializer
        if self.action in ("partial_update", "update"):
            return ProjectUpdateSerializer
        if self.action == "history":
            return ProjectHistorySerializer
        if self.action == "members" and self.request.method == "POST":
            return ProjectMemberCreateSerializer
        if self.action in ("members", "destroy_member"):
            return ProjectMemberSerializer
        return ProjectDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project = serializer.save()
        return Response(
            ProjectDetailSerializer(project, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        project = self.get_object()
        serializer = self.get_serializer(project, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        project = serializer.save()
        return Response(
            ProjectDetailSerializer(project, context=self.get_serializer_context()).data
        )

    def perform_destroy(self, instance):
        try:
            soft_delete_project(project=instance, actor=self.request.user)
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise ValidationError(exc.message_dict) from exc
            raise ValidationError(exc.messages) from exc

    @action(detail=False, methods=["get"], url_path="metrics")
    def metrics(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        payload = {
            "total": queryset.count(),
            "draft": queryset.filter(status=Project.Status.DRAFT).count(),
            "planned": queryset.filter(status=Project.Status.PLANNED).count(),
            "in_progress": queryset.filter(status=Project.Status.IN_PROGRESS).count(),
            "on_hold": queryset.filter(status=Project.Status.ON_HOLD).count(),
            "delayed": queryset.filter(status=Project.Status.DELAYED).count(),
            "completed": queryset.filter(status=Project.Status.COMPLETED).count(),
            "cancelled": queryset.filter(status=Project.Status.CANCELLED).count(),
        }
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get", "post"], url_path="members")
    def members(self, request, pk=None):
        project = self.get_object()
        if request.method == "GET":
            queryset = project.members.filter(is_deleted=False).select_related(
                "user", "added_by"
            )
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = ProjectMemberSerializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            serializer = ProjectMemberSerializer(queryset, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        serializer = ProjectMemberCreateSerializer(
            data=request.data,
            context={**self.get_serializer_context(), "project": project},
        )
        serializer.is_valid(raise_exception=True)
        try:
            member = serializer.save()
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise ValidationError(exc.message_dict) from exc
            raise ValidationError(exc.messages) from exc
        return Response(
            ProjectMemberSerializer(member).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"members/(?P<member_id>[^/.]+)",
    )
    def destroy_member(self, request, pk=None, member_id=None):
        project = self.get_object()
        member = get_object_or_404(
            ProjectMember,
            pk=member_id,
            project=project,
            is_deleted=False,
        )
        remove_project_member(member=member, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        project = self.get_object()
        queryset = project.history_entries.select_related("actor").order_by(
            "-created_at"
        )
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = ProjectHistorySerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = ProjectHistorySerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
