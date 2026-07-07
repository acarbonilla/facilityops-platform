from django.urls import include, path

urlpatterns = [
    path("access-control/", include("apps.access_control.urls")),
    path("auth/", include("apps.accounts.urls")),
    path("dashboard/", include("apps.dashboard.urls")),
    path("fm-tickets/", include("apps.fm_tickets.urls")),
    path("health/", include("apps.core.urls")),
    path("maintenance/", include("apps.maintenance.urls")),
    path("master-data/", include("apps.master_data.urls")),
]
