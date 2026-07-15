from django.urls import path

from .views import OperationalOverviewView

urlpatterns = [
    path(
        "overview/",
        OperationalOverviewView.as_view(),
        name="reporting-operational-overview",
    ),
]
