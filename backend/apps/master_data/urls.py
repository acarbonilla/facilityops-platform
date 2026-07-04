from rest_framework.routers import DefaultRouter

from .views import (
    AreaViewSet,
    AssetTypeViewSet,
    AssetViewSet,
    BuildingViewSet,
    DepartmentViewSet,
    FloorViewSet,
    OrganizationViewSet,
    TenantViewSet,
)

router = DefaultRouter()
router.register("tenants", TenantViewSet, basename="tenant")
router.register("organizations", OrganizationViewSet, basename="organization")
router.register("departments", DepartmentViewSet, basename="department")
router.register("buildings", BuildingViewSet, basename="building")
router.register("floors", FloorViewSet, basename="floor")
router.register("areas", AreaViewSet, basename="area")
router.register("asset-types", AssetTypeViewSet, basename="asset-type")
router.register("assets", AssetViewSet, basename="asset")

urlpatterns = router.urls
