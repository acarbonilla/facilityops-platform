from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Role, UserRole
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

from .services import SERVICE_NAME, build_foundation_summary

User = get_user_model()


class FoundationSummaryApiTests(APITestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(name="Tenant A", code="tenant-a")
        self.tenant_b = Tenant.objects.create(name="Tenant B", code="tenant-b")

        self.org_a = Organization.objects.create(
            tenant=self.tenant_a,
            name="Org A",
            code="org-a",
        )
        self.org_b = Organization.objects.create(
            tenant=self.tenant_b,
            name="Org B",
            code="org-b",
        )
        Department.objects.create(
            tenant=self.tenant_a,
            organization=self.org_a,
            name="Dept A",
            code="dept-a",
        )
        Department.objects.create(
            tenant=self.tenant_b,
            organization=self.org_b,
            name="Dept B",
            code="dept-b",
        )
        self.building_a = Building.objects.create(
            tenant=self.tenant_a,
            organization=self.org_a,
            name="Building A",
            code="building-a",
        )
        self.building_b = Building.objects.create(
            tenant=self.tenant_b,
            organization=self.org_b,
            name="Building B",
            code="building-b",
        )
        self.floor_a = Floor.objects.create(
            tenant=self.tenant_a,
            building=self.building_a,
            name="Floor A",
            code="floor-a",
            level_number=1,
        )
        self.floor_b = Floor.objects.create(
            tenant=self.tenant_b,
            building=self.building_b,
            name="Floor B",
            code="floor-b",
            level_number=1,
        )
        self.area_a = Area.objects.create(
            tenant=self.tenant_a,
            building=self.building_a,
            floor=self.floor_a,
            name="Area A",
            code="area-a",
        )
        self.area_b = Area.objects.create(
            tenant=self.tenant_b,
            building=self.building_b,
            floor=self.floor_b,
            name="Area B",
            code="area-b",
        )
        self.asset_type_a = AssetType.objects.create(
            tenant=self.tenant_a,
            name="Asset Type A",
            code="asset-type-a",
        )
        self.asset_type_b = AssetType.objects.create(
            tenant=self.tenant_b,
            name="Asset Type B",
            code="asset-type-b",
        )
        Asset.objects.create(
            tenant=self.tenant_a,
            organization=self.org_a,
            building=self.building_a,
            floor=self.floor_a,
            area=self.area_a,
            asset_type=self.asset_type_a,
            name="Asset A",
            code="asset-a",
        )
        Asset.objects.create(
            tenant=self.tenant_b,
            organization=self.org_b,
            building=self.building_b,
            floor=self.floor_b,
            area=self.area_b,
            asset_type=self.asset_type_b,
            name="Asset B",
            code="asset-b",
        )

        self.tenant_user = User.objects.create_user(
            email="tenant-user@example.com",
            password="Password123!",
            tenant=self.tenant_a,
            organization=self.org_a,
        )
        self.facility_manager = User.objects.create_user(
            email="facility-manager@example.com",
            password="Password123!",
            tenant=self.tenant_a,
            organization=self.org_a,
        )
        self.viewer = User.objects.create_user(
            email="viewer@example.com",
            password="Password123!",
            tenant=self.tenant_a,
            organization=self.org_a,
        )
        self.tenantless = User.objects.create_user(
            email="tenantless@example.com",
            password="Password123!",
        )
        self.staff_user = User.objects.create_user(
            email="staff@example.com",
            password="Password123!",
            tenant=self.tenant_a,
            organization=self.org_a,
            is_staff=True,
        )
        self.superuser = User.objects.create_superuser(
            email="superuser@example.com",
            password="Password123!",
        )

        self.system_admin_role = Role.objects.create(
            name="System Administrator",
            code="system_admin",
            is_system_role=True,
            is_active=True,
        )
        self.system_admin = User.objects.create_user(
            email="system-admin@example.com",
            password="Password123!",
        )
        UserRole.objects.create(
            user=self.system_admin,
            role=self.system_admin_role,
            is_active=True,
        )

        self.facility_manager_role = Role.objects.create(
            name="Facility Manager",
            code="facility_manager",
            is_active=True,
        )
        self.viewer_role = Role.objects.create(
            name="Viewer",
            code="viewer",
            is_active=True,
        )
        UserRole.objects.create(
            user=self.facility_manager,
            role=self.facility_manager_role,
            is_active=True,
        )
        UserRole.objects.create(
            user=self.viewer,
            role=self.viewer_role,
            is_active=True,
        )

        self.url = reverse("dashboard-foundation-summary")

    def _tenant_a_payload(self):
        return {
            "tenants": 1,
            "organizations": 1,
            "departments": 1,
            "buildings": 1,
            "floors": 1,
            "areas": 1,
            "asset_types": 1,
            "assets": 1,
            "service": SERVICE_NAME,
        }

    def _global_payload(self):
        return {
            "tenants": 2,
            "organizations": 2,
            "departments": 2,
            "buildings": 2,
            "floors": 2,
            "areas": 2,
            "asset_types": 2,
            "assets": 2,
            "service": SERVICE_NAME,
        }

    def _zero_payload(self):
        return {
            "tenants": 0,
            "organizations": 0,
            "departments": 0,
            "buildings": 0,
            "floors": 0,
            "areas": 0,
            "asset_types": 0,
            "assets": 0,
            "service": SERVICE_NAME,
        }

    def test_foundation_summary_requires_authentication(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_tenant_user_receives_same_tenant_counts_only(self):
        self.client.force_authenticate(self.tenant_user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self._tenant_a_payload())

    def test_cross_tenant_records_do_not_contribute(self):
        self.client.force_authenticate(self.tenant_user)
        response = self.client.get(self.url)
        self.assertEqual(response.data["organizations"], 1)
        self.assertEqual(response.data["assets"], 1)
        self.assertNotEqual(response.data, self._global_payload())

    def test_facility_manager_remains_same_tenant(self):
        self.client.force_authenticate(self.facility_manager)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self._tenant_a_payload())

    def test_viewer_remains_same_tenant(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self._tenant_a_payload())

    def test_tenantless_non_global_user_receives_zero_counts(self):
        self.client.force_authenticate(self.tenantless)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self._zero_payload())

    def test_superuser_receives_global_counts(self):
        self.client.force_authenticate(self.superuser)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self._global_payload())

    def test_active_system_admin_receives_global_counts(self):
        self.client.force_authenticate(self.system_admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self._global_payload())

    def test_inactive_system_admin_role_does_not_grant_global_scope(self):
        self.system_admin_role.is_active = False
        self.system_admin_role.save(update_fields=("is_active", "updated_at"))
        self.client.force_authenticate(self.system_admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self._zero_payload())

    def test_inactive_user_role_assignment_does_not_grant_global_scope(self):
        assignment = UserRole.objects.get(
            user=self.system_admin,
            role=self.system_admin_role,
        )
        assignment.is_active = False
        assignment.save(update_fields=("is_active", "updated_at"))
        self.client.force_authenticate(self.system_admin)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self._zero_payload())

    def test_ordinary_staff_user_does_not_receive_global_scope(self):
        self.client.force_authenticate(self.staff_user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self._tenant_a_payload())

    def test_soft_deleted_records_remain_excluded(self):
        soft_org = Organization.objects.create(
            tenant=self.tenant_a,
            name="Soft Org",
            code="soft-org",
        )
        soft_org.is_deleted = True
        soft_org.save(update_fields=("is_deleted", "updated_at"))
        self.client.force_authenticate(self.tenant_user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["organizations"], 1)

    def test_response_keys_remain_backward_compatible(self):
        self.client.force_authenticate(self.tenant_user)
        response = self.client.get(self.url)
        self.assertEqual(
            set(response.data.keys()),
            {
                "tenants",
                "organizations",
                "departments",
                "buildings",
                "floors",
                "areas",
                "asset_types",
                "assets",
                "service",
            },
        )

    def test_service_remains_unchanged(self):
        self.client.force_authenticate(self.tenant_user)
        response = self.client.get(self.url)
        self.assertEqual(response.data["service"], "facilityops-backend")

    def test_query_count_remains_bounded(self):
        self.client.force_authenticate(self.tenant_user)
        with CaptureQueriesContext(connection) as context:
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Auth/session overhead plus one COUNT per metric (8).
        self.assertLessEqual(len(context), 20)

    def test_query_parameters_cannot_broaden_tenant_scope(self):
        self.client.force_authenticate(self.tenant_user)
        response = self.client.get(
            self.url,
            {
                "tenant": str(self.tenant_b.id),
                "tenant_id": str(self.tenant_b.id),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, self._tenant_a_payload())

    def test_build_foundation_summary_matches_endpoint_contract(self):
        payload = build_foundation_summary(self.tenant_user)
        self.assertEqual(payload, self._tenant_a_payload())
