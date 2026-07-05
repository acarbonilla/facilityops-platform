from django.urls import path

from .views import FoundationSummaryView

urlpatterns = [
    path(
        "foundation-summary/",
        FoundationSummaryView.as_view(),
        name="dashboard-foundation-summary",
    ),
]

