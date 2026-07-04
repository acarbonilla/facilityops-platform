from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Permission, Role, RolePermission, UserRole

from .models import (
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


class MasterDataModelTests(APITestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name="Tenant", code="tenant")
        self.organization = Organization.objects.create(
            tenant=self.tenant,
            name="Org",
            code="org",
        )
        self.department = Department.objects.create(
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
            code="asset_type",
        )

    def test_tenant_creation(self):
        self.assertEqual(str(self.tenant), "Tenant (tenant)")

    def test_organization_creation(self):
        self.assertEqual(str(self.organization), "Org (org)")

    def test_department_creation(self):
        self.assertEqual(str(self.department), "Dept (dept)")

    def test_building_creation(self):
        self.assertEqual(str(self.building), "Building (building)")

    def test_floor_creation(self):
        self.assertEqual(str(self.floor), "Floor (floor)")

    def test_area_creation(self):
        self.assertEqual(str(self.area), "Area (area)")

    def test_asset_type_creation(self):
        self.assertEqual(str(self.asset_type), "Asset Type (asset_type)")

    def test_asset_creation(self):
        asset = Asset.objects.create(
            tenant=self.tenant,
            organization=self.organization,
            building=self.building,
            floor=self.floor,
            area=self.area,
            asset_type=self.asset_type,
            name="Asset",
            code="asset",
        )

        self.assertEqual(str(asset), "Asset (asset)")

    def test_unique_tenant_code_constraint(self):
        with self.assertRaises(Exception):
            Tenant.objects.create(name="Tenant 2", code="tenant")

    def test_unique_organization_code_per_tenant(self):
        with self.assertRaises(Exception):
            Organization.objects.create(
                tenant=self.tenant,
                name="Org 2",
                code="org",
            )

    def test_unique_building_code_per_organization(self):
        with self.assertRaises(Exception):
            Building.objects.create(
                tenant=self.tenant,
                organization=self.organization,
                name="Building 2",
                code="building",
            )

    def test_unique_floor_code_per_building(self):
        with self.assertRaises(Exception):
            Floor.objects.create(
                tenant=self.tenant,
                building=self.building,
                name="Floor 2",
                code="floor",
            )

    def test_unique_area_code_per_floor(self):
        with self.assertRaises(Exception):
            Area.objects.create(
                tenant=self.tenant,
                building=self.building,
                floor=self.floor,
                name="Area 2",
                code="area",
            )

    def test_unique_asset_type_code_per_tenant(self):
        with self.assertRaises(Exception):
            AssetType.objects.create(
                tenant=self.tenant,
                name="Asset Type 2",
                code="asset_type",
            )

    def test_unique_asset_code_per_tenant(self):
        Asset.objects.create(
            tenant=self.tenant,
            organization=self.organization,
            building=self.building,
            asset_type=self.asset_type,
            name="Asset",
            code="asset",
        )

        with self.assertRaises(Exception):
            Asset.objects.create(
                tenant=self.tenant,
                organization=self.organization,
                building=self.building,
                asset_type=self.asset_type,
                name="Asset 2",
                code="asset",
            )


class MasterDataCommandTests(APITestCase):
    def test_seed_command_idempotency(self):
        call_command("seed_master_data")
        call_command("seed_master_data")

        self.assertEqual(Tenant.objects.count(), 1)
        self.assertEqual(Organization.objects.count(), 1)
        self.assertEqual(Department.objects.count(), 1)
        self.assertEqual(Building.objects.count(), 1)
        self.assertEqual(Floor.objects.count(), 1)
        self.assertEqual(Area.objects.count(), 1)
        self.assertEqual(AssetType.objects.count(), 1)
        self.assertEqual(Asset.objects.count(), 1)


class MasterDataApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="masterdata@example.com",
            password="Password123!",
        )
        self.role = Role.objects.create(name="Manager", code="manager")
        self.settings_view = Permission.objects.create(
            name="View Settings",
            code="settings.view",
            module="settings",
            action="view",
        )
        self.settings_manage = Permission.objects.create(
            name="Manage Settings",
            code="settings.manage",
            module="settings",
            action="manage",
        )
        RolePermission.objects.create(role=self.role, permission=self.settings_view)
        RolePermission.objects.create(role=self.role, permission=self.settings_manage)
        UserRole.objects.create(user=self.user, role=self.role)

        self.tenant = Tenant.objects.create(name="Tenant", code="tenant")
        self.organization = Organization.objects.create(
            tenant=self.tenant,
            name="Org",
            code="org",
        )

    def test_endpoints_require_authentication(self):
        response = self.client.get(reverse("tenant-list"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_list_endpoint_returns_data(self):
        self.client.force_authenticate(self.user)

        response = self.client.get(reverse("tenant-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_filtering_returns_matching_data(self):
        self.client.force_authenticate(self.user)

        response = self.client.get(
            reverse("organization-list"),
            {"tenant": str(self.tenant.id)},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
