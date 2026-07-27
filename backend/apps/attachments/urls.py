from rest_framework.routers import DefaultRouter

from .views import AttachmentViewSet

router = DefaultRouter()
router.register("attachments", AttachmentViewSet, basename="attachments")

urlpatterns = router.urls
