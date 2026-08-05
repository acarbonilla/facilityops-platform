"""FO-093 AI Administration API views."""

from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.access_control.permissions import HasPermissionCode
from apps.fm_tickets.ai_administration_service import (
    AI_ADMIN_PERMISSION,
    get_ai_config,
    get_ai_health,
    list_ai_audit,
    list_ai_policies,
    list_ai_prompts,
    update_ai_config,
)
from apps.fm_tickets.ai_production_monitoring_service import (
    get_monitoring_alerts,
    get_monitoring_overview,
    get_monitoring_queue,
    get_monitoring_runtime,
)


class AIAdminConfigView(APIView):
    """GET/PATCH /api/admin/ai/config/ — settings.manage only."""

    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = AI_ADMIN_PERMISSION

    def get(self, request):
        return Response(get_ai_config(request.user))

    def patch(self, request):
        payload = request.data if isinstance(request.data, dict) else {}
        return Response(update_ai_config(request.user, payload))


class AIAdminPromptsView(APIView):
    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = AI_ADMIN_PERMISSION

    def get(self, request):
        return Response(list_ai_prompts(request.user))


class AIAdminPoliciesView(APIView):
    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = AI_ADMIN_PERMISSION

    def get(self, request):
        return Response(list_ai_policies(request.user))


class AIAdminHealthView(APIView):
    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = AI_ADMIN_PERMISSION

    def get(self, request):
        return Response(get_ai_health(request.user))


class AIAdminAuditView(APIView):
    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = AI_ADMIN_PERMISSION

    def get(self, request):
        limit = request.query_params.get("limit", 50)
        return Response(list_ai_audit(request.user, limit=limit))


class AIMonitoringOverviewView(APIView):
    """GET /api/admin/ai/monitoring/ — FO-094 production monitoring overview."""

    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = AI_ADMIN_PERMISSION

    def get(self, request):
        return Response(get_monitoring_overview(request.user))


class AIMonitoringRuntimeView(APIView):
    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = AI_ADMIN_PERMISSION

    def get(self, request):
        return Response(get_monitoring_runtime(request.user))


class AIMonitoringQueueView(APIView):
    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = AI_ADMIN_PERMISSION

    def get(self, request):
        return Response(get_monitoring_queue(request.user))


class AIMonitoringAlertsView(APIView):
    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = AI_ADMIN_PERMISSION

    def get(self, request):
        return Response(get_monitoring_alerts(request.user))
