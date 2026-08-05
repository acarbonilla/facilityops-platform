"""FO-093 AI Administration URL routes."""

from django.urls import path

from apps.fm_tickets.ai_admin_views import (
    AIAdminAuditView,
    AIAdminConfigView,
    AIAdminHealthView,
    AIAdminPoliciesView,
    AIAdminPromptsView,
    AIMonitoringAlertsView,
    AIMonitoringOverviewView,
    AIMonitoringQueueView,
    AIMonitoringRuntimeView,
)

urlpatterns = [
    path("config/", AIAdminConfigView.as_view(), name="admin-ai-config"),
    path("prompts/", AIAdminPromptsView.as_view(), name="admin-ai-prompts"),
    path("policies/", AIAdminPoliciesView.as_view(), name="admin-ai-policies"),
    path("health/", AIAdminHealthView.as_view(), name="admin-ai-health"),
    path("audit/", AIAdminAuditView.as_view(), name="admin-ai-audit"),
    path("monitoring/", AIMonitoringOverviewView.as_view(), name="admin-ai-monitoring"),
    path(
        "monitoring/runtime/",
        AIMonitoringRuntimeView.as_view(),
        name="admin-ai-monitoring-runtime",
    ),
    path(
        "monitoring/queue/",
        AIMonitoringQueueView.as_view(),
        name="admin-ai-monitoring-queue",
    ),
    path(
        "monitoring/alerts/",
        AIMonitoringAlertsView.as_view(),
        name="admin-ai-monitoring-alerts",
    ),
]
