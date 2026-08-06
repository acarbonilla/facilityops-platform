from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ProjectDependencyViewSet,
    ProjectIssueViewSet,
    ProjectNoteViewSet,
    ProjectTaskViewSet,
    ProjectTimelineViewSet,
    ProjectViewSet,
)

router = DefaultRouter()
router.register(r"", ProjectViewSet, basename="project")

task_list = ProjectTaskViewSet.as_view({"get": "list", "post": "create"})
task_detail = ProjectTaskViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
task_assign = ProjectTaskViewSet.as_view({"post": "assign"})
task_reorder = ProjectTaskViewSet.as_view({"post": "reorder"})
task_checklist = ProjectTaskViewSet.as_view({"get": "checklist", "post": "checklist"})
task_checklist_item = ProjectTaskViewSet.as_view(
    {"patch": "checklist_item", "delete": "checklist_item"}
)
task_comments = ProjectTaskViewSet.as_view({"get": "comments", "post": "comments"})
task_comment_detail = ProjectTaskViewSet.as_view({"delete": "destroy_comment"})
task_predecessors = ProjectTaskViewSet.as_view({"get": "predecessors"})
task_successors = ProjectTaskViewSet.as_view({"get": "successors"})
task_dependency_readiness = ProjectTaskViewSet.as_view(
    {"get": "dependency_readiness"}
)

dependency_list = ProjectDependencyViewSet.as_view(
    {"get": "list", "post": "create"}
)
dependency_detail = ProjectDependencyViewSet.as_view(
    {"get": "retrieve", "delete": "destroy"}
)

timeline_list = ProjectTimelineViewSet.as_view({"get": "list"})

note_list = ProjectNoteViewSet.as_view({"get": "list", "post": "create"})
note_detail = ProjectNoteViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)

issue_list = ProjectIssueViewSet.as_view({"get": "list", "post": "create"})
issue_detail = ProjectIssueViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
issue_comments = ProjectIssueViewSet.as_view({"get": "comments", "post": "comments"})
issue_comment_detail = ProjectIssueViewSet.as_view({"delete": "destroy_comment"})

urlpatterns = [
    path(
        "<uuid:project_id>/timeline/",
        timeline_list,
        name="project-timeline-list",
    ),
    path(
        "<uuid:project_id>/notes/",
        note_list,
        name="project-note-list",
    ),
    path(
        "<uuid:project_id>/notes/<uuid:pk>/",
        note_detail,
        name="project-note-detail",
    ),
    path(
        "<uuid:project_id>/issues/",
        issue_list,
        name="project-issue-list",
    ),
    path(
        "<uuid:project_id>/issues/<uuid:pk>/",
        issue_detail,
        name="project-issue-detail",
    ),
    path(
        "<uuid:project_id>/issues/<uuid:pk>/comments/",
        issue_comments,
        name="project-issue-comments",
    ),
    path(
        "<uuid:project_id>/issues/<uuid:pk>/comments/<uuid:comment_id>/",
        issue_comment_detail,
        name="project-issue-comment-detail",
    ),
    path(
        "<uuid:project_id>/dependencies/",
        dependency_list,
        name="project-dependency-list",
    ),
    path(
        "<uuid:project_id>/dependencies/<uuid:pk>/",
        dependency_detail,
        name="project-dependency-detail",
    ),
    path(
        "<uuid:project_id>/tasks/reorder/",
        task_reorder,
        name="project-task-reorder",
    ),
    path(
        "<uuid:project_id>/tasks/",
        task_list,
        name="project-task-list",
    ),
    path(
        "<uuid:project_id>/tasks/<uuid:pk>/",
        task_detail,
        name="project-task-detail",
    ),
    path(
        "<uuid:project_id>/tasks/<uuid:pk>/assign/",
        task_assign,
        name="project-task-assign",
    ),
    path(
        "<uuid:project_id>/tasks/<uuid:pk>/checklist/",
        task_checklist,
        name="project-task-checklist",
    ),
    path(
        "<uuid:project_id>/tasks/<uuid:pk>/checklist/<uuid:item_id>/",
        task_checklist_item,
        name="project-task-checklist-item",
    ),
    path(
        "<uuid:project_id>/tasks/<uuid:pk>/comments/",
        task_comments,
        name="project-task-comments",
    ),
    path(
        "<uuid:project_id>/tasks/<uuid:pk>/comments/<uuid:comment_id>/",
        task_comment_detail,
        name="project-task-comment-detail",
    ),
    path(
        "<uuid:project_id>/tasks/<uuid:pk>/predecessors/",
        task_predecessors,
        name="project-task-predecessors",
    ),
    path(
        "<uuid:project_id>/tasks/<uuid:pk>/successors/",
        task_successors,
        name="project-task-successors",
    ),
    path(
        "<uuid:project_id>/tasks/<uuid:pk>/dependency-readiness/",
        task_dependency_readiness,
        name="project-task-dependency-readiness",
    ),
] + router.urls
