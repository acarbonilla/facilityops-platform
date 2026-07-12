from django.urls import path

from .views import (
    CurrentUserPermissionsView,
    PermissionListView,
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

urlpatterns = [
    path("roles/", role_list, name="rbac-roles"),
    path("roles/<uuid:pk>/", role_detail, name="rbac-role-detail"),
    path("permissions/", PermissionListView.as_view(), name="rbac-permissions"),
    path(
        "me/permissions/",
        CurrentUserPermissionsView.as_view(),
        name="rbac-me-permissions",
    ),
]
