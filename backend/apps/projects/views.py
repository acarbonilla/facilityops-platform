from common.pagination import StandardResultsSetPagination
from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .filters import (
    apply_issue_date_filters,
    apply_issue_ordering,
    apply_issue_search,
    apply_note_ordering,
    apply_note_search,
    apply_project_date_filters,
    apply_project_ordering,
    apply_project_search,
    apply_query_param_filters,
    apply_task_date_filters,
    apply_task_fo105_filters,
    apply_task_ordering,
    apply_task_progress_filters,
    apply_task_search,
)
from .models import (
    Project,
    ProjectIssue,
    ProjectIssueComment,
    ProjectMember,
    ProjectNote,
    ProjectOperationalLink,
    ProjectProgressSnapshot,
    ProjectTask,
    ProjectTaskChecklistItem,
    ProjectTaskComment,
    ProjectTaskDependency,
)
from .permissions import HasProjectPermission
from .serializers import (
    ProjectCreateSerializer,
    ProjectDetailSerializer,
    ProjectHistorySerializer,
    ProjectIssueCommentCreateSerializer,
    ProjectIssueCommentSerializer,
    ProjectIssueCreateSerializer,
    ProjectIssueDetailSerializer,
    ProjectIssueSerializer,
    ProjectIssueUpdateSerializer,
    ProjectLinkOptionSerializer,
    ProjectListSerializer,
    ProjectMemberCreateSerializer,
    ProjectMemberSerializer,
    ProjectNoteCreateSerializer,
    ProjectNoteSerializer,
    ProjectNoteUpdateSerializer,
    ProjectOperationalLinkCreateSerializer,
    ProjectOperationalLinkSerializer,
    ProjectOperationalLinkUpdateSerializer,
    ProjectProgressSnapshotSerializer,
    ProjectTaskAssignSerializer,
    ProjectTaskChecklistItemCreateSerializer,
    ProjectTaskChecklistItemSerializer,
    ProjectTaskChecklistItemUpdateSerializer,
    ProjectTaskCommentCreateSerializer,
    ProjectTaskCommentSerializer,
    ProjectTaskCreateSerializer,
    ProjectTaskDependencyCreateSerializer,
    ProjectTaskDependencySerializer,
    ProjectTaskDetailSerializer,
    ProjectTaskListSerializer,
    ProjectTaskReorderSerializer,
    ProjectTaskUpdateSerializer,
    ProjectTimelineEntrySerializer,
    ProjectUpdateSerializer,
)
from .services import (
    build_task_summary,
    remove_project_member,
    reorder_tasks,
    soft_delete_checklist_item,
    soft_delete_issue,
    soft_delete_issue_comment,
    soft_delete_note,
    soft_delete_project,
    soft_delete_task,
    soft_delete_task_comment,
)
from .link_service import (
    LINK_TYPE_FM,
    LINK_TYPE_INSPECTION,
    LINK_TYPE_MWO,
    build_safe_summary,
    link_options,
    serialize_link_option,
    soft_delete_link,
)
from .tenant_scope import scope_projects_to_user
from .timeline_service import build_timeline_queryset, history_entry_to_timeline_dto


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
        elif self.action in ("progress", "progress_history"):
            self.required_permissions_any = (
                "projects.progress.view",
                "projects.view",
                "projects.manage",
            )
        elif self.action == "recalculate_progress":
            self.required_permissions_any = (
                "projects.progress.recalculate",
                "projects.manage",
            )
        elif self.action == "gantt":
            self.required_permissions_any = (
                "projects.gantt.view",
                "projects.view",
                "projects.manage",
            )
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

    @action(detail=True, methods=["get"], url_path="gantt")
    def gantt(self, request, pk=None):
        from .dependency_service import build_gantt_payload

        project = self.get_object()
        return Response(
            build_gantt_payload(project),
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="progress")
    def progress(self, request, pk=None):
        from .progress_service import build_progress_summary

        project = self.get_object()
        return Response(
            build_progress_summary(project, actor=request.user),
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get"], url_path="progress-history")
    def progress_history(self, request, pk=None):
        from .progress_service import (
            build_progress_history_queryset,
            serialize_progress_snapshot,
        )

        project = self.get_object()
        queryset = build_progress_history_queryset(
            project=project,
            params=request.query_params,
        )
        page = self.paginate_queryset(queryset)
        entries = page if page is not None else list(queryset)
        payload = [serialize_progress_snapshot(item) for item in entries]
        serializer = ProjectProgressSnapshotSerializer(payload, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="recalculate-progress")
    def recalculate_progress(self, request, pk=None):
        from .progress_service import (
            build_progress_summary,
            recalculate_project_progress,
        )

        project = self.get_object()
        # No body percentage accepted — ignore any client payload.
        try:
            recalculate_project_progress(
                project,
                actor=request.user,
                source=ProjectProgressSnapshot.Source.MANUAL_RECALCULATION,
                related_task=None,
            )
        except DjangoValidationError as exc:
            _raise_validation(exc)
        project.refresh_from_db()
        return Response(
            build_progress_summary(project, actor=request.user),
            status=status.HTTP_200_OK,
        )

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
        queryset = apply_task_fo105_filters(queryset, self.request.query_params)
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

        if self.action in (
            "list",
            "retrieve",
            "predecessors",
            "successors",
            "dependency_readiness",
        ):
            if self.action in (
                "predecessors",
                "successors",
                "dependency_readiness",
            ):
                self.required_permissions_any = (
                    "projects.dependencies.view",
                    "projects.gantt.view",
                    "projects.tasks.view",
                    "projects.view",
                    manage,
                    tasks_manage,
                )
            else:
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
        elif self.action in (
            "start",
            "pause",
            "resume",
            "complete",
            "update_progress",
        ):
            self.required_permissions_any = (
                "projects.tasks.update",
                manage,
                tasks_manage,
            )
        elif self.action == "report_blocker":
            self.required_permissions_any = (
                "projects.issues.report",
                "projects.issues.manage",
                manage,
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

    def _task_serializer_context(self, tasks):
        from .dependency_service import (
            batch_dependency_readiness,
            compute_delay_flags,
        )

        task_list = list(tasks)
        context = self.get_serializer_context()
        context["dependency_readiness"] = batch_dependency_readiness(task_list)
        context["delay_flags"] = {
            str(task.id): compute_delay_flags(task) for task in task_list
        }
        return context

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        tasks = page if page is not None else list(queryset)
        context = self._task_serializer_context(tasks)
        serializer = ProjectTaskListSerializer(tasks, many=True, context=context)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        task = self.get_object()
        context = self._task_serializer_context([task])
        return Response(ProjectTaskDetailSerializer(task, context=context).data)

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
        context = self._task_serializer_context([task])
        return Response(
            ProjectTaskDetailSerializer(task, context=context).data,
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
        context = self._task_serializer_context([task])
        return Response(ProjectTaskDetailSerializer(task, context=context).data)

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
        context = self._task_serializer_context([task])
        return Response(ProjectTaskDetailSerializer(task, context=context).data)

    def _execute_task_action(self, request, handler, **handler_kwargs):
        from django.core.exceptions import PermissionDenied as DjangoPermissionDenied

        from .execution_service import report_task_blocker

        task = self.get_object()
        try:
            result = handler(task=task, actor=request.user, **handler_kwargs)
        except DjangoValidationError as exc:
            _raise_validation(exc)
        except DjangoPermissionDenied as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        if handler is report_task_blocker:
            return Response(
                ProjectIssueDetailSerializer(result).data,
                status=status.HTTP_201_CREATED,
            )
        context = self._task_serializer_context([result])
        return Response(ProjectTaskDetailSerializer(result, context=context).data)

    def start(self, request, project_id=None, pk=None):
        from .execution_service import start_task

        return self._execute_task_action(request, start_task)

    def pause(self, request, project_id=None, pk=None):
        from .execution_service import pause_task

        return self._execute_task_action(request, pause_task)

    def resume(self, request, project_id=None, pk=None):
        from .execution_service import resume_task

        return self._execute_task_action(request, resume_task)

    def complete(self, request, project_id=None, pk=None):
        from .execution_service import complete_task

        return self._execute_task_action(
            request,
            complete_task,
            actual_end=request.data.get("actual_end"),
        )

    def update_progress(self, request, project_id=None, pk=None):
        from .execution_service import update_task_progress

        if "progress_percentage" not in request.data:
            raise ValidationError(
                {"progress_percentage": "This field is required."}
            )
        return self._execute_task_action(
            request,
            update_task_progress,
            progress_percentage=request.data.get("progress_percentage"),
        )

    def report_blocker(self, request, project_id=None, pk=None):
        from .execution_service import report_task_blocker

        title = (request.data.get("title") or "").strip()
        if not title:
            raise ValidationError({"title": "This field is required."})
        return self._execute_task_action(
            request,
            report_task_blocker,
            title=title,
            description=request.data.get("description") or "",
            severity=request.data.get("severity"),
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
        context = self._task_serializer_context(tasks)
        return Response(
            ProjectTaskListSerializer(tasks, many=True, context=context).data,
            status=status.HTTP_200_OK,
        )

    def predecessors(self, request, project_id=None, pk=None):
        from .dependency_service import _active_dependency_qs

        task = self.get_object()
        deps = (
            _active_dependency_qs(project_id=self.project.id)
            .filter(successor_task_id=task.id)
            .select_related("predecessor_task", "successor_task")
        )
        return Response(
            ProjectTaskDependencySerializer(deps, many=True).data
        )

    def successors(self, request, project_id=None, pk=None):
        from .dependency_service import _active_dependency_qs

        task = self.get_object()
        deps = (
            _active_dependency_qs(project_id=self.project.id)
            .filter(predecessor_task_id=task.id)
            .select_related("predecessor_task", "successor_task")
        )
        return Response(
            ProjectTaskDependencySerializer(deps, many=True).data
        )

    def dependency_readiness(self, request, project_id=None, pk=None):
        from .dependency_service import get_dependency_readiness

        task = self.get_object()
        return Response(get_dependency_readiness(task))

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


class ProjectDependencyViewSet(viewsets.ViewSet):
    """Nested FO-105 dependencies under /projects/{project_id}/dependencies/."""

    permission_classes = [IsAuthenticated, HasProjectPermission]
    pagination_class = StandardResultsSetPagination
    http_method_names = ["get", "post", "delete", "head", "options"]

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

    def get_permissions(self):
        self.required_permission = None
        self.required_permissions_any = None
        manage = "projects.manage"
        tasks_manage = "projects.tasks.manage"

        if self.action in ("list", "retrieve"):
            self.required_permissions_any = (
                "projects.dependencies.view",
                "projects.gantt.view",
                "projects.view",
                manage,
            )
        elif self.action in ("create", "destroy"):
            self.required_permissions_any = (
                "projects.dependencies.manage",
                manage,
                tasks_manage,
            )
        return super().get_permissions()

    def get_queryset(self):
        from .dependency_service import _active_dependency_qs

        return (
            _active_dependency_qs(project_id=self.project.id)
            .select_related("predecessor_task", "successor_task", "project", "tenant")
            .order_by("created_at")
        )

    def list(self, request, project_id=None):
        queryset = self.get_queryset()
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        if page is not None:
            serializer = ProjectTaskDependencySerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        return Response(
            ProjectTaskDependencySerializer(queryset, many=True).data
        )

    def create(self, request, project_id=None):
        serializer = ProjectTaskDependencyCreateSerializer(
            data=request.data,
            context={"request": request, "project": self.project},
        )
        serializer.is_valid(raise_exception=True)
        try:
            dependency = serializer.save()
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(
            ProjectTaskDependencySerializer(dependency).data,
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request, project_id=None, pk=None):
        dependency = get_object_or_404(self.get_queryset(), pk=pk)
        return Response(ProjectTaskDependencySerializer(dependency).data)

    def destroy(self, request, project_id=None, pk=None):
        from .dependency_service import soft_delete_dependency

        dependency = get_object_or_404(
            ProjectTaskDependency.objects.filter(
                project=self.project,
                is_deleted=False,
                project__is_deleted=False,
            ),
            pk=pk,
        )
        try:
            soft_delete_dependency(dependency=dependency, actor=request.user)
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectTimelineViewSet(viewsets.ViewSet):
    """FO-106 timeline stream under /projects/{project_id}/timeline/."""

    permission_classes = [IsAuthenticated, HasProjectPermission]
    pagination_class = StandardResultsSetPagination
    http_method_names = ["get", "head", "options"]

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

    def get_permissions(self):
        self.required_permission = None
        self.required_permissions_any = (
            "projects.timeline.view",
            "projects.view",
            "projects.manage",
        )
        return super().get_permissions()

    def list(self, request, project_id=None):
        queryset = build_timeline_queryset(
            project=self.project,
            params=request.query_params,
            audience=request.user,
        )
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        entries = page if page is not None else list(queryset)
        payload = [history_entry_to_timeline_dto(entry) for entry in entries]
        serializer = ProjectTimelineEntrySerializer(payload, many=True)
        if page is not None:
            return paginator.get_paginated_response(serializer.data)
        return Response(serializer.data)


class ProjectNoteViewSet(viewsets.ModelViewSet):
    """Nested FO-106 notes under /projects/{project_id}/notes/."""

    permission_classes = [IsAuthenticated, HasProjectPermission]
    pagination_class = StandardResultsSetPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filter_fields = ("category", "author")
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
        queryset = ProjectNote.objects.filter(
            project=self.project,
            is_deleted=False,
        ).select_related("author", "project", "tenant")
        queryset = apply_query_param_filters(
            queryset,
            self.request.query_params,
            self.filter_fields,
        )
        queryset = apply_note_search(
            queryset,
            self.request.query_params.get("search"),
        )
        queryset = apply_note_ordering(
            queryset,
            self.request.query_params.get("ordering"),
        )
        return queryset

    def get_permissions(self):
        self.required_permission = None
        self.required_permissions_any = None
        manage = "projects.manage"
        notes_manage = "projects.notes.manage"

        if self.action in ("list", "retrieve"):
            self.required_permissions_any = (
                "projects.notes.view",
                "projects.view",
                manage,
                notes_manage,
            )
        elif self.action in ("create", "partial_update", "update", "destroy"):
            self.required_permissions_any = (
                notes_manage,
                manage,
            )
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "create":
            return ProjectNoteCreateSerializer
        if self.action in ("partial_update", "update"):
            return ProjectNoteUpdateSerializer
        return ProjectNoteSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["project"] = getattr(self, "project", None)
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            note = serializer.save()
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(
            ProjectNoteSerializer(note).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        note = self.get_object()
        serializer = self.get_serializer(note, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            note = serializer.save()
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(ProjectNoteSerializer(note).data)

    def perform_destroy(self, instance):
        soft_delete_note(note=instance, actor=self.request.user)


class ProjectIssueViewSet(viewsets.ModelViewSet):
    """Nested FO-106 issues under /projects/{project_id}/issues/."""

    permission_classes = [IsAuthenticated, HasProjectPermission]
    pagination_class = StandardResultsSetPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filter_fields = ("status", "severity", "owner")
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
        queryset = ProjectIssue.objects.filter(
            project=self.project,
            is_deleted=False,
        ).select_related("owner", "project", "tenant")
        queryset = apply_query_param_filters(
            queryset,
            self.request.query_params,
            self.filter_fields,
        )
        queryset = apply_issue_search(
            queryset,
            self.request.query_params.get("search"),
        )
        queryset = apply_issue_date_filters(queryset, self.request.query_params)
        queryset = apply_issue_ordering(
            queryset,
            self.request.query_params.get("ordering"),
        )
        return queryset

    def get_permissions(self):
        self.required_permission = None
        self.required_permissions_any = None
        manage = "projects.manage"
        issues_manage = "projects.issues.manage"

        if self.action in ("list", "retrieve"):
            self.required_permissions_any = (
                "projects.issues.view",
                "projects.view",
                manage,
                issues_manage,
            )
        elif self.action in ("create", "partial_update", "update", "destroy"):
            if self.action == "create":
                self.required_permissions_any = (
                    "projects.issues.report",
                    issues_manage,
                    manage,
                )
            else:
                self.required_permissions_any = (
                    issues_manage,
                    manage,
                    "projects.issues.report",
                )
        elif self.action == "comments":
            if self.request.method == "GET":
                self.required_permissions_any = (
                    "projects.issues.view",
                    "projects.view",
                    manage,
                    issues_manage,
                )
            else:
                self.required_permissions_any = (
                    "projects.issues.comment",
                    issues_manage,
                    manage,
                )
        elif self.action == "destroy_comment":
            self.required_permissions_any = (
                "projects.issues.comment",
                issues_manage,
                manage,
            )
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == "list":
            return ProjectIssueSerializer
        if self.action == "create":
            return ProjectIssueCreateSerializer
        if self.action in ("partial_update", "update"):
            return ProjectIssueUpdateSerializer
        if self.action == "comments" and self.request.method == "POST":
            return ProjectIssueCommentCreateSerializer
        if self.action in ("comments", "destroy_comment"):
            return ProjectIssueCommentSerializer
        return ProjectIssueDetailSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["project"] = getattr(self, "project", None)
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            issue = serializer.save()
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(
            ProjectIssueDetailSerializer(issue).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        issue = self.get_object()
        serializer = self.get_serializer(issue, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            issue = serializer.save()
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(ProjectIssueDetailSerializer(issue).data)

    def perform_destroy(self, instance):
        soft_delete_issue(issue=instance, actor=self.request.user)

    def comments(self, request, project_id=None, pk=None):
        issue = self.get_object()
        if request.method == "GET":
            queryset = issue.comments.filter(is_deleted=False).select_related("author")
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = ProjectIssueCommentSerializer(page, many=True)
                return self.get_paginated_response(serializer.data)
            return Response(
                ProjectIssueCommentSerializer(queryset, many=True).data
            )

        serializer = ProjectIssueCommentCreateSerializer(
            data=request.data,
            context={**self.get_serializer_context(), "issue": issue},
        )
        serializer.is_valid(raise_exception=True)
        try:
            comment = serializer.save()
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(
            ProjectIssueCommentSerializer(comment).data,
            status=status.HTTP_201_CREATED,
        )

    def destroy_comment(self, request, project_id=None, pk=None, comment_id=None):
        issue = self.get_object()
        comment = get_object_or_404(
            ProjectIssueComment,
            pk=comment_id,
            issue=issue,
            is_deleted=False,
        )
        soft_delete_issue_comment(comment=comment, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectLinkViewSet(viewsets.ViewSet):
    """Nested FO-108 links under /projects/{project_id}/links/."""

    permission_classes = [IsAuthenticated, HasProjectPermission]
    pagination_class = StandardResultsSetPagination
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

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

    def get_permissions(self):
        self.required_permission = None
        self.required_permissions_any = None
        manage = "projects.manage"
        links_manage = "projects.links.manage"

        if self.action in ("list", "retrieve"):
            self.required_permissions_any = (
                "projects.links.view",
                "projects.view",
                manage,
                links_manage,
            )
        elif self.action in ("create", "partial_update", "destroy"):
            self.required_permissions_any = (
                links_manage,
                manage,
            )
        return super().get_permissions()

    def _link_queryset(self):
        return ProjectOperationalLink.objects.filter(
            project=self.project,
            is_deleted=False,
        ).select_related(
            "project",
            "project_task",
            "fm_ticket",
            "maintenance_work_order",
            "inspection",
            "tenant",
        )

    def list(self, request, project_id=None):
        queryset = self._link_queryset().order_by("-created_at")
        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        entries = page if page is not None else list(queryset)
        payload = [
            build_safe_summary(request.user, link) for link in entries
        ]
        serializer = ProjectOperationalLinkSerializer(payload, many=True)
        if page is not None:
            return paginator.get_paginated_response(serializer.data)
        return Response(serializer.data)

    def retrieve(self, request, project_id=None, pk=None):
        link = get_object_or_404(self._link_queryset(), pk=pk)
        payload = build_safe_summary(request.user, link)
        return Response(ProjectOperationalLinkSerializer(payload).data)

    def create(self, request, project_id=None):
        serializer = ProjectOperationalLinkCreateSerializer(
            data=request.data,
            context={"request": request, "project": self.project},
        )
        serializer.is_valid(raise_exception=True)
        try:
            link = serializer.save()
        except DjangoValidationError as exc:
            _raise_validation(exc)
        payload = build_safe_summary(request.user, link)
        return Response(
            ProjectOperationalLinkSerializer(payload).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, project_id=None, pk=None):
        link = get_object_or_404(self._link_queryset(), pk=pk)
        serializer = ProjectOperationalLinkUpdateSerializer(
            link,
            data=request.data,
            partial=True,
            context={"request": request, "project": self.project},
        )
        serializer.is_valid(raise_exception=True)
        try:
            link = serializer.save()
        except DjangoValidationError as exc:
            _raise_validation(exc)
        payload = build_safe_summary(request.user, link)
        return Response(ProjectOperationalLinkSerializer(payload).data)

    def destroy(self, request, project_id=None, pk=None):
        link = get_object_or_404(self._link_queryset(), pk=pk)
        try:
            soft_delete_link(link=link, actor=request.user)
        except DjangoValidationError as exc:
            _raise_validation(exc)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectLinkOptionsView(viewsets.ViewSet):
    """GET /projects/{project_id}/link-options/?type=&search="""

    permission_classes = [IsAuthenticated, HasProjectPermission]
    http_method_names = ["get", "head", "options"]

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

    def get_permissions(self):
        self.required_permission = None
        self.required_permissions_any = (
            "projects.links.view",
            "projects.view",
            "projects.manage",
            "projects.links.manage",
        )
        return super().get_permissions()

    def list(self, request, project_id=None):
        link_type = request.query_params.get("type")
        search = request.query_params.get("search", "")
        if link_type not in (LINK_TYPE_FM, LINK_TYPE_MWO, LINK_TYPE_INSPECTION):
            raise ValidationError(
                {
                    "type": (
                        "type must be fm_ticket, maintenance_work_order, or "
                        "inspection."
                    )
                }
            )
        try:
            queryset = link_options(
                project=self.project,
                actor=request.user,
                link_type=link_type,
                search=search,
            )
        except DjangoValidationError as exc:
            _raise_validation(exc)

        paginator = StandardResultsSetPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        entries = page if page is not None else list(queryset)
        payload = [
            serialize_link_option(link_type, target) for target in entries
        ]
        serializer = ProjectLinkOptionSerializer(payload, many=True)
        if page is not None:
            return paginator.get_paginated_response(serializer.data)
        return Response(serializer.data)
