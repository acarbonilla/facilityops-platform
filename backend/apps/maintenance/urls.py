from rest_framework.routers import DefaultRouter

from .views import MaintenanceWorkOrderViewSet

router = DefaultRouter()
router.register("work-orders", MaintenanceWorkOrderViewSet, basename="maintenance-work-order")

urlpatterns = router.urls
