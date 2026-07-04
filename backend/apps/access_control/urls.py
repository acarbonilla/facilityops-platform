from django.urls import path

from .views import (
    CurrentUserPermissionsView,
    PermissionListView,
    RoleListView,
)

urlpatterns = [
    path("roles/", RoleListView.as_view(), name="rbac-roles"),
    path("permissions/", PermissionListView.as_view(), name="rbac-permissions"),
    path(
        "me/permissions/",
        CurrentUserPermissionsView.as_view(),
        name="rbac-me-permissions",
    ),
]
