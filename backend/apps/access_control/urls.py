from django.urls import path

from .views import (
    CurrentUserPermissionsView,
    PermissionListView,
    RolePermissionAssignmentView,
    RoleViewSet,
)

role_list = RoleViewSet.as_view({"get": "list", "post": "create"})
role_detail = RoleViewSet.as_view(
    {
        "get": "retrieve",
        "put": "update",
        "patch": "partial_update",
        "delete": "destroy",
    }
)
role_duplicate = RoleViewSet.as_view({"post": "duplicate"})

urlpatterns = [
    path("roles/", role_list, name="rbac-roles"),
    path("roles/<uuid:pk>/", role_detail, name="rbac-role-detail"),
    path(
        "roles/<uuid:pk>/duplicate/",
        role_duplicate,
        name="rbac-role-duplicate",
    ),
    path(
        "roles/<uuid:role_id>/permissions/",
        RolePermissionAssignmentView.as_view(),
        name="rbac-role-permissions",
    ),
    path("permissions/", PermissionListView.as_view(), name="rbac-permissions"),
    path(
        "me/permissions/",
        CurrentUserPermissionsView.as_view(),
        name="rbac-me-permissions",
    ),
]
