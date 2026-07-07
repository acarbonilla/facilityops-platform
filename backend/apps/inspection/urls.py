from rest_framework.routers import DefaultRouter

from .views import (
    InspectionCorrectiveActionViewSet,
    InspectionFindingViewSet,
    InspectionViewSet,
)

router = DefaultRouter()
router.register("inspections", InspectionViewSet, basename="inspection")
router.register("findings", InspectionFindingViewSet, basename="inspection-finding")
router.register(
    "corrective-actions",
    InspectionCorrectiveActionViewSet,
    basename="inspection-corrective-action",
)

urlpatterns = router.urls

