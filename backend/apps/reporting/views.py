from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.access_control.permissions import HasPermissionCode

from .serializers import OperationalOverviewSerializer
from .services import build_operational_overview


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
