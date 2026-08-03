from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.access_control.permissions import HasPermissionCode
from apps.fm_tickets.ai_analytics_service import build_ai_recommendation_analytics

from .serializers import (
    AIRecommendationAnalyticsSerializer,
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
