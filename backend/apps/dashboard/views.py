from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.master_data.models import (
    Area,
    Asset,
    AssetType,
    Building,
    Department,
    Floor,
    Organization,
    Tenant,
)

from .serializers import FoundationSummarySerializer


def get_active_count(model):
    return model.objects.filter(is_deleted=False).count()


class FoundationSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = FoundationSummarySerializer(
            data={
                "tenants": get_active_count(Tenant),
                "organizations": get_active_count(Organization),
                "departments": get_active_count(Department),
                "buildings": get_active_count(Building),
                "floors": get_active_count(Floor),
                "areas": get_active_count(Area),
                "asset_types": get_active_count(AssetType),
                "assets": get_active_count(Asset),
                "service": "facilityops-backend",
            }
        )
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)

