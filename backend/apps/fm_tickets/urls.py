from rest_framework.routers import DefaultRouter

from .views import FmTicketViewSet

router = DefaultRouter()
router.register("tickets", FmTicketViewSet, basename="fm-ticket")

urlpatterns = router.urls

