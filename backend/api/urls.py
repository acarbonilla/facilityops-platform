from django.urls import include, path

urlpatterns = [
    path("access-control/", include("apps.access_control.urls")),
    path("auth/", include("apps.accounts.urls")),
    path("health/", include("apps.core.urls")),
]
