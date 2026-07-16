from django.urls import path

from .views import OperationalOverviewView, ReportingFilterOptionsView

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
]
