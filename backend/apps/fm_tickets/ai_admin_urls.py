"""FO-093 AI Administration URL routes."""

from django.urls import path

from apps.fm_tickets.ai_admin_views import (
    AIAdminAuditView,
    AIAdminConfigView,
    AIAdminHealthView,
    AIAdminPoliciesView,
    AIAdminPromptsView,
)

urlpatterns = [
    path("config/", AIAdminConfigView.as_view(), name="admin-ai-config"),
    path("prompts/", AIAdminPromptsView.as_view(), name="admin-ai-prompts"),
    path("policies/", AIAdminPoliciesView.as_view(), name="admin-ai-policies"),
    path("health/", AIAdminHealthView.as_view(), name="admin-ai-health"),
    path("audit/", AIAdminAuditView.as_view(), name="admin-ai-audit"),
]
