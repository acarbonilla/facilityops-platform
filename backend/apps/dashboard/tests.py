from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.master_data.models import (
    Area,
    Asset,
    AssetType,
    Building,
    Department,
    Floor,
    Organization,
    Tenant,
)


User = get_user_model()


class FoundationSummaryApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="dashboard@example.com",
            password="Password123!",
        )
        self.tenant = Tenant.objects.create(name="Tenant", code="tenant")
        self.organization = Organization.objects.create(
            tenant=self.tenant,
            name="Org",
            code="org",
        )
        Department.objects.create(
            tenant=self.tenant,
            organization=self.organization,
            name="Dept",
            code="dept",
        )
        self.building = Building.objects.create(
            tenant=self.tenant,
            organization=self.organization,
            name="Building",
            code="building",
        )
        self.floor = Floor.objects.create(
            tenant=self.tenant,
            building=self.building,
            name="Floor",
            code="floor",
            level_number=1,
        )
        self.area = Area.objects.create(
            tenant=self.tenant,
            building=self.building,
            floor=self.floor,
            name="Area",
            code="area",
        )
        self.asset_type = AssetType.objects.create(
            tenant=self.tenant,
            name="Asset Type",
            code="asset-type",
        )
        Asset.objects.create(
            tenant=self.tenant,
            organization=self.organization,
            building=self.building,
            floor=self.floor,
            area=self.area,
            asset_type=self.asset_type,
            name="Asset",
            code="asset",
        )

    def test_foundation_summary_requires_authentication(self):
        response = self.client.get(reverse("dashboard-foundation-summary"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_foundation_summary_returns_expected_keys_and_counts(self):
        self.client.force_authenticate(self.user)

        response = self.client.get(reverse("dashboard-foundation-summary"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            {
                "tenants": 1,
                "organizations": 1,
                "departments": 1,
                "buildings": 1,
                "floors": 1,
                "areas": 1,
                "asset_types": 1,
                "assets": 1,
                "service": "facilityops-backend",
            },
        )
