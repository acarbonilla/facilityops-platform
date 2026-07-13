from django.urls import path

from .views import NotificationViewSet

notification_list = NotificationViewSet.as_view({"get": "list"})
notification_detail = NotificationViewSet.as_view({"get": "retrieve"})
notification_unread_count = NotificationViewSet.as_view({"get": "unread_count"})

urlpatterns = [
    path("", notification_list, name="notification-list"),
    path("unread-count/", notification_unread_count, name="notification-unread-count"),
    path("<uuid:pk>/", notification_detail, name="notification-detail"),
]
