from django.urls import path

from .views import (
    AIOperationalInsightsView,
    AIRecommendationInsightsView,
    OperationalOverviewView,
    ReportingFilterOptionsView,
)

urlpatterns = [
    path(
        "overview/",
        OperationalOverviewView.as_view(),
        name="reporting-operational-overview",
    ),
    path(
        "filter-options/",
        ReportingFilterOptionsView.as_view(),
        name="reporting-filter-options",
    ),
    path(
        "ai-insights/",
        AIRecommendationInsightsView.as_view(),
        name="reporting-ai-insights",
    ),
    path(
        "ai-operational-insights/",
        AIOperationalInsightsView.as_view(),
        name="reporting-ai-operational-insights",
    ),
]
