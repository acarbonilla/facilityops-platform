from django.urls import include, path

urlpatterns = [
    path("", include("apps.accounts.user_urls")),
    path("access-control/", include("apps.access_control.urls")),
    path("admin/ai/", include("apps.fm_tickets.ai_admin_urls")),
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.attachments.urls")),
    path("dashboard/", include("apps.dashboard.urls")),
    path("fm-tickets/", include("apps.fm_tickets.urls")),
    path("health/", include("apps.core.urls")),
    path("inspection/", include("apps.inspection.urls")),
    path("maintenance/", include("apps.maintenance.urls")),
    path("projects/", include("apps.projects.urls")),
    path("master-data/", include("apps.master_data.urls")),
    path("reporting/", include("apps.reporting.urls")),
]
