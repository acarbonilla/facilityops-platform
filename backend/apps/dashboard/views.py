from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import FoundationSummarySerializer
from .services import build_foundation_summary


class FoundationSummaryView(APIView):
    """Auth-only Foundation Dashboard summary.

    Tenant isolation is enforced in the service layer. No Dashboard-specific
    permission code is required so the post-login Dashboard remains available
    to every authenticated user.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = FoundationSummarySerializer(
            data=build_foundation_summary(request.user)
        )
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)
