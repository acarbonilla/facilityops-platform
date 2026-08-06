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
    apply_task_date_filters,
    apply_task_ordering,
    apply_task_progress_filters,
    apply_task_search,
)
from .models import (
    Project,
    ProjectMember,
    ProjectTask,
    ProjectTaskChecklistItem,
    ProjectTaskComment,
)
from .permissions import HasProjectPermission
from .serializers import (
    ProjectCreateSerializer,
    ProjectDetailSerializer,
    ProjectHistorySerializer,
    ProjectListSerializer,
    ProjectMemberCreateSerializer,
    ProjectMemberSerializer,
    ProjectTaskAssignSerializer,
    ProjectTaskChecklistItemCreateSerializer,
    ProjectTaskChecklistItemSerializer,
    ProjectTaskChecklistItemUpdateSerializer,
    ProjectTaskCommentCreateSerializer,
    ProjectTaskCommentSerializer,
    ProjectTaskCreateSerializer,
    ProjectTaskDetailSerializer,
    ProjectTaskListSerializer,
    ProjectTaskReorderSerializer,
    ProjectTaskUpdateSerializer,
    ProjectUpdateSerializer,
)
from .services import (
    build_task_summary,
    remove_project_member,
    reorder_tasks,
    soft_delete_checklist_item,
    soft_delete_project,
    soft_delete_task,
    soft_delete_task_comment,
)
from .tenant_scope import scope_projects_to_user


def _raise_validation(exc):
    if hasattr(exc, "message_dict"):
        raise ValidationError(exc.message_dict) from exc
    raise ValidationError(exc.messages) from exc


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

        if self.action in ("list", "retrieve", "history", "metrics", "task_summary"):
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
            _raise_validation(exc)

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

    @action(detail=True, methods=["get"], url_path="task-summary")
    def task_summary(self, request, pk=None):
        project = self.get_object()
        return Response(build_task_summary(project), status=status.HTTP_200_OK)

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
            _raise_validation(exc)
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


class ProjectTaskViewSet(viewsets.ModelViewSet):
    """Nested FO-104 task CRUD under /projects/{project_id}/tasks/."""

    permission_classes = [IsAuthenticated, HasProjectPermission]
    pagination_class = StandardResultsSetPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filter_fields = ("status", "priority", "person_in_charge", "is_milestone")
    lookup_field = "pk"

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.project = self._get_project()

    def _get_project(self):
        project_id = self.kwargs["project_id"]
        queryset = scope_projects_to_user(
            Project.objects.filter(is_deleted=False),
            self.request.user,
        )
        return get_object_or_404(queryset, pk=project_id)

    def get_queryset(self):
        queryset = ProjectTask.objects.filter(
            project=self.project,
            is_deleted=False,
        ).select_related("person_in_charge", "project", "tenant")
        queryset = apply_query_param_filters(
            queryset,
            self.request.query_params,
            self.filter_fields,
        )
        queryset = apply_task_search(
            queryset,
            self.request.query_params.get("search"),
        )
        queryset = apply_task_date_filters(queryset, self.request.query_params)
        queryset = apply_task_progress_filters(queryset, self.request.query_params)
        queryset = apply_task_ordering(
            queryset,
            self.request.query_params.get("ordering"),
        )
        return queryset

    def get_permissions(self):
        self.required_permission = None
        self.required_permissions_any = None
        manage = "projects.manage"
        tasks_manage = "projects.tasks.manage"

        if self.action in ("list", "retrieve"):
            self.required_permissions_any = (
                "projects.tasks.view",
                "projects.view",
                manage,
                tasks_manage,
            )
        elif self.action == "create":
            self.required_permissions_any = (
                "projects.tasks.create",
                manage,
                tasks_manage,
            )
        elif self.action in ("partial_update", "update", "checklist", "checklist_item"):
            if self.action == "checklist" and self.request.method == "GET":
                self.required_permissions_any = (
                    "projects.tasks.view",
                    "projects.view",
                    manage,
                    tasks_manage,
                )
            elif self.action == "checklist_item" and self.request.method == "GET":
                self.required_permissions_any = (
                    "projects.tasks.view",
                    "projects.view",
                    manage,
                    tasks_manage,
                )
            else:
                self.required_permissions_any = (
                    "projects.tasks.update",
                    manage,
                    tasks_manage,
                )
        elif self.action == "destroy":
            self.required_permissions_any = (
                "projects.tasks.delete",
                manage,
                tasks_manage,
            )
        elif self.action == "assign":
            self.required_permissions_any = (
                "projects.tasks.assign",
                manage,
                tasks_manage,
            )
        elif self.action == "reorder":
            self.required_permissions_any = (
                "projects.tasks.update",
                manage,
                tasks_manage,
            )
        elif self.action == "comments":
            if self.request.method == "GET":
                self.required_permissions_any = (
                    "projects.tasks.view",
                    "projects.view",
                    manage,
                    tasks_manage,
                )
            else:
                self.required_permissions_any = (
                    "projects.tasks.comment",
                    "projects.tasks.update",
                    manage,
                    tasks_manage,
                )
        elif self.action == "destroy_comment":
            self.required_permissions_any = (
                "projects.tasks.comment",
                "projects.tasks.update",
                manage,
                tasks_manage,
            )
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "list":
            return ProjectTaskListSerializer
        if self.action == "create":
            return ProjectTaskCreateSerializer
        if self.action in ("partial_update", "update"):
            return ProjectTaskUpdateSerializer
        if self.action == "assign":
            return ProjectTaskAssignSerializer
        if self.action == "reorder":
            return ProjectTaskReorderSerializer
        if self.action == "checklist" and self.request.method == "POST":
            return ProjectTaskChecklistItemCreateSerializer
        if self.action == "checklist_item" and self.request.method == "PATCH":
            return ProjectTaskChecklistItemUpdateSerializer
        if self.action in ("checklist", "checklist_item"):
            return ProjectTaskChecklistItemSerializer
        if self.action == "comments" and self.request.method == "POST":
            return ProjectTaskCommentCreateSerializer
        if self.action in ("comments", "destroy_comment"):
            return ProjectTaskCommentSerializer
        return ProjectTaskDetailSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["project"] = getattr(self, "project", None)
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            task = serializer.save()
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(
            ProjectTaskDetailSerializer(
                task, context=self.get_serializer_context()
            ).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        task = self.get_object()
        serializer = self.get_serializer(task, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            task = serializer.save()
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(
            ProjectTaskDetailSerializer(
                task, context=self.get_serializer_context()
            ).data
        )

    def perform_destroy(self, instance):
        try:
            soft_delete_task(task=instance, actor=self.request.user)
        except DjangoValidationError as exc:
            _raise_validation(exc)

    def assign(self, request, project_id=None, pk=None):
        task = self.get_object()
        serializer = ProjectTaskAssignSerializer(
            data=request.data,
            context={**self.get_serializer_context(), "task": task},
        )
        serializer.is_valid(raise_exception=True)
        try:
            task = serializer.save()
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(
            ProjectTaskDetailSerializer(
                task, context=self.get_serializer_context()
            ).data
        )

    def reorder(self, request, project_id=None):
        serializer = ProjectTaskReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            tasks = reorder_tasks(
                project=self.project,
                task_ids=serializer.validated_data["task_ids"],
                actor=request.user,
            )
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(
            ProjectTaskListSerializer(tasks, many=True).data,
            status=status.HTTP_200_OK,
        )

    def checklist(self, request, project_id=None, pk=None):
        task = self.get_object()
        if request.method == "GET":
            queryset = task.checklist_items.filter(is_deleted=False).order_by(
                "sequence", "created_at"
            )
            return Response(
                ProjectTaskChecklistItemSerializer(queryset, many=True).data
            )

        serializer = ProjectTaskChecklistItemCreateSerializer(
            data=request.data,
            context={**self.get_serializer_context(), "task": task},
        )
        serializer.is_valid(raise_exception=True)
        try:
            item = serializer.save()
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(
            ProjectTaskChecklistItemSerializer(item).data,
            status=status.HTTP_201_CREATED,
        )

    def checklist_item(self, request, project_id=None, pk=None, item_id=None):
        task = self.get_object()
        item = get_object_or_404(
            ProjectTaskChecklistItem,
            pk=item_id,
            task=task,
            is_deleted=False,
        )
        if request.method == "PATCH":
            serializer = ProjectTaskChecklistItemUpdateSerializer(
                item,
                data=request.data,
                partial=True,
                context=self.get_serializer_context(),
            )
            serializer.is_valid(raise_exception=True)
            try:
                item = serializer.save()
            except DjangoValidationError as exc:
                _raise_validation(exc)
            return Response(ProjectTaskChecklistItemSerializer(item).data)

        soft_delete_checklist_item(item=item, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def comments(self, request, project_id=None, pk=None):
        task = self.get_object()
        if request.method == "GET":
            queryset = task.comments.filter(is_deleted=False).select_related("author")
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = ProjectTaskCommentSerializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            return Response(
                ProjectTaskCommentSerializer(queryset, many=True).data
            )

        serializer = ProjectTaskCommentCreateSerializer(
            data=request.data,
            context={**self.get_serializer_context(), "task": task},
        )
        serializer.is_valid(raise_exception=True)
        try:
            comment = serializer.save()
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(
            ProjectTaskCommentSerializer(comment).data,
            status=status.HTTP_201_CREATED,
        )

    def destroy_comment(self, request, project_id=None, pk=None, comment_id=None):
        task = self.get_object()
        comment = get_object_or_404(
            ProjectTaskComment,
            pk=comment_id,
            task=task,
            is_deleted=False,
        )
        soft_delete_task_comment(comment=comment, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
