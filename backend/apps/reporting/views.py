from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.access_control.permissions import HasPermissionCode
from apps.fm_tickets.ai_analytics_service import build_ai_recommendation_analytics
from apps.fm_tickets.ai_attention_center_service import build_ai_attention_center
from apps.fm_tickets.ai_operational_insights_service import (
    build_ai_operational_insights,
)
from apps.fm_tickets.ai_similar_case_service import build_ai_similar_cases
from apps.fm_tickets.executive_ai_dashboard_service import (
    build_executive_ai_dashboard,
)

from .serializers import (
    AIAttentionCenterSerializer,
    AIOperationalInsightsSerializer,
    AIRecommendationAnalyticsSerializer,
    AISimilarCasesSerializer,
    ExecutiveAIDashboardSerializer,
    OperationalOverviewSerializer,
    ReportingFilterOptionsSerializer,
)
from .services import build_operational_overview, build_reporting_filter_options


class OperationalOverviewView(APIView):
    """Tenant-scoped cross-module operational reporting overview.

    Requires ``reporting.view``. Aggregations are computed in the service
    layer and never trust frontend-only filters for isolation.
    """

    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = "reporting.view"

    def get(self, request):
        payload = build_operational_overview(request.user, request.query_params)
        serializer = OperationalOverviewSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class ReportingFilterOptionsView(APIView):
    """Read-only Organization/Building options for Reporting filters.

    Requires ``reporting.view`` and does not require ``settings.view``.
    """

    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = "reporting.view"

    def get(self, request):
        payload = build_reporting_filter_options(request.user)
        serializer = ReportingFilterOptionsSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class AIRecommendationInsightsView(APIView):
    """FO-088 tenant-scoped AI recommendation analytics (informational only).

    Requires ``reporting.view``. Aggregations live in
    ``AIRecommendationAnalyticsService`` and never mutate tickets or models.
    Employee requesters without ``reporting.view`` are denied.
    """

    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = "reporting.view"

    def get(self, request):
        payload = build_ai_recommendation_analytics(
            request.user, request.query_params
        )
        serializer = AIRecommendationAnalyticsSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class AIOperationalInsightsView(APIView):
    """FO-089 tenant-scoped AI operational insights (informational only).

    Requires ``reporting.view``. Builds on FO-088 analytics; never mutates
    tickets, prompts, models, or assignments.
    """

    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = "reporting.view"

    def get(self, request):
        payload = build_ai_operational_insights(request.user, request.query_params)
        serializer = AIOperationalInsightsSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class AIAttentionCenterView(APIView):
    """FO-090 tenant-scoped AI Attention Center (informational only).

    Requires ``reporting.view``. Reuses FO-089 insights / FO-088 analytics.
    Never mutates tickets, prompts, models, or assignments.
    """

    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = "reporting.view"

    def get(self, request):
        payload = build_ai_attention_center(request.user, request.query_params)
        serializer = AIAttentionCenterSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class AISimilarCasesView(APIView):
    """FO-091 tenant-scoped AI Knowledge Base similar cases (read-only).

    Requires ``reporting.view``. Rule-based Version 1 matcher; never mutates
    tickets, prompts, models, or assignments. Never exposes attachments,
    prompts, raw Gemini output, or identities.
    """

    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = "reporting.view"

    def get(self, request):
        payload = build_ai_similar_cases(request.user, request.query_params)
        serializer = AISimilarCasesSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class ExecutiveAIDashboardView(APIView):
    """FO-092 tenant-scoped Executive AI Dashboard (informational only).

    Requires ``reporting.view``. Orchestrates FO-088/089/090 services.
    Never mutates tickets, prompts, models, or assignments.
    """

    permission_classes = [IsAuthenticated, HasPermissionCode]
    required_permission = "reporting.view"

    def get(self, request):
        payload = build_executive_ai_dashboard(request.user, request.query_params)
        serializer = ExecutiveAIDashboardSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)
