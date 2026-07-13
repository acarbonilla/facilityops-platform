from django.urls import path

from .views import NotificationPreferenceView, NotificationViewSet

notification_list = NotificationViewSet.as_view({"get": "list"})
notification_detail = NotificationViewSet.as_view({"get": "retrieve"})
notification_unread_count = NotificationViewSet.as_view({"get": "unread_count"})
notification_mark_all_read = NotificationViewSet.as_view({"post": "mark_all_read"})
notification_bulk_state = NotificationViewSet.as_view({"post": "bulk_state"})
notification_mark_read = NotificationViewSet.as_view({"post": "mark_read"})
notification_mark_unread = NotificationViewSet.as_view({"post": "mark_unread"})
notification_preferences = NotificationPreferenceView.as_view()

urlpatterns = [
    path("", notification_list, name="notification-list"),
    path("unread-count/", notification_unread_count, name="notification-unread-count"),
    path("mark-all-read/", notification_mark_all_read, name="notification-mark-all-read"),
    path("bulk-state/", notification_bulk_state, name="notification-bulk-state"),
    path("preferences/", notification_preferences, name="notification-preferences"),
    path("<uuid:pk>/mark-read/", notification_mark_read, name="notification-mark-read"),
    path(
        "<uuid:pk>/mark-unread/",
        notification_mark_unread,
        name="notification-mark-unread",
    ),
    path("<uuid:pk>/", notification_detail, name="notification-detail"),
]
