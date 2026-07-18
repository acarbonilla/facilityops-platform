from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Permission, Role, RolePermission, UserRole
from apps.notifications.models import Notification

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
        self.user.tenant = self.tenant
        self.user.save(update_fields=["tenant"])
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


class MasterDataTenantIsolationApiTests(APITestCase):
    def setUp(self):
        self.client.default_format = "json"
        self.tenant_a = Tenant.objects.create(name="Tenant A", code="tenant-a")
        self.tenant_b = Tenant.objects.create(name="Tenant B", code="tenant-b")

        self.organization_a = Organization.objects.create(
            tenant=self.tenant_a, name="Organization A", code="org-a"
        )
        self.organization_b = Organization.objects.create(
            tenant=self.tenant_b, name="Organization B", code="org-b"
        )
        self.department_a = Department.objects.create(
            tenant=self.tenant_a,
            organization=self.organization_a,
            name="Department A",
            code="dept-a",
        )
        self.department_b = Department.objects.create(
            tenant=self.tenant_b,
            organization=self.organization_b,
            name="Department B",
            code="dept-b",
        )
        self.building_a = Building.objects.create(
            tenant=self.tenant_a,
            organization=self.organization_a,
            name="Building A",
            code="building-a",
        )
        self.building_b = Building.objects.create(
            tenant=self.tenant_b,
            organization=self.organization_b,
            name="Building B",
            code="building-b",
        )
        self.floor_a = Floor.objects.create(
            tenant=self.tenant_a,
            building=self.building_a,
            name="Floor A",
            code="floor-a",
        )
        self.floor_b = Floor.objects.create(
            tenant=self.tenant_b,
            building=self.building_b,
            name="Floor B",
            code="floor-b",
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
        self.asset_a = Asset.objects.create(
            tenant=self.tenant_a,
            organization=self.organization_a,
            building=self.building_a,
            floor=self.floor_a,
            area=self.area_a,
            asset_type=self.asset_type_a,
            name="Asset A",
            code="asset-a",
        )
        self.asset_b = Asset.objects.create(
            tenant=self.tenant_b,
            organization=self.organization_b,
            building=self.building_b,
            floor=self.floor_b,
            area=self.area_b,
            asset_type=self.asset_type_b,
            name="Asset B",
            code="asset-b",
        )

        self.view_permission = Permission.objects.create(
            name="View Settings",
            code="settings.view",
            module="settings",
            action="view",
        )
        self.manage_permission = Permission.objects.create(
            name="Manage Settings",
            code="settings.manage",
            module="settings",
            action="manage",
        )
        self.view_role = self._role_with_permissions(
            "Viewer",
            "master-data-viewer",
            self.view_permission,
        )
        self.manage_role = self._role_with_permissions(
            "Manager",
            "master-data-manager",
            self.view_permission,
            self.manage_permission,
        )

        self.tenant_user = self._user(
            "tenant-user@example.com",
            tenant=self.tenant_a,
            role=self.manage_role,
        )
        self.read_only_user = self._user(
            "read-only@example.com",
            tenant=self.tenant_a,
            role=self.view_role,
        )
        self.tenantless_user = self._user(
            "tenantless@example.com",
            tenant=None,
            role=self.manage_role,
        )

    def _role_with_permissions(self, name, code, *permissions, is_active=True):
        role = Role.objects.create(name=name, code=code, is_active=is_active)
        for permission in permissions:
            RolePermission.objects.create(role=role, permission=permission)
        return role

    def _user(self, email, *, tenant=None, role=None, is_staff=False):
        user = User.objects.create_user(
            email=email,
            password="Password123!",
            tenant=tenant,
            is_staff=is_staff,
        )
        if role is not None:
            UserRole.objects.create(user=user, role=role)
        return user

    def _authenticate(self, user):
        self.client.force_authenticate(user)

    def _results(self, response):
        return response.data["results"]

    def _organization_payload(self, **overrides):
        payload = {
            "tenant": str(self.tenant_a.id),
            "name": "New Organization",
            "code": "new-organization",
            "description": "",
            "is_active": True,
        }
        payload.update(overrides)
        return payload

    def _asset_payload(self, **overrides):
        payload = {
            "tenant": str(self.tenant_a.id),
            "organization": str(self.organization_a.id),
            "building": str(self.building_a.id),
            "floor": str(self.floor_a.id),
            "area": str(self.area_a.id),
            "asset_type": str(self.asset_type_a.id),
            "name": "New Asset",
            "code": "new-asset",
            "serial_number": "",
            "description": "",
            "is_active": True,
        }
        payload.update(overrides)
        return payload

    def test_unauthenticated_read_returns_401(self):
        response = self.client.get(reverse("organization-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_view_permission_returns_403(self):
        user = self._user("no-permissions@example.com", tenant=self.tenant_a)
        self._authenticate(user)
        response = self.client.get(reverse("organization-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_missing_manage_permission_cannot_mutate(self):
        self._authenticate(self.read_only_user)
        response = self.client.post(
            reverse("organization-list"),
            self._organization_payload(),
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_tenant_user_lists_only_own_tenant_and_entities(self):
        self._authenticate(self.tenant_user)
        cases = (
            ("tenant-list", self.tenant_a.id),
            ("organization-list", self.organization_a.id),
            ("department-list", self.department_a.id),
            ("building-list", self.building_a.id),
            ("floor-list", self.floor_a.id),
            ("area-list", self.area_a.id),
            ("asset-type-list", self.asset_type_a.id),
            ("asset-list", self.asset_a.id),
        )
        for route_name, expected_id in cases:
            with self.subTest(route_name=route_name):
                response = self.client.get(reverse(route_name))
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data["count"], 1)
                self.assertEqual(
                    self._results(response)[0]["id"],
                    str(expected_id),
                )

    def test_cross_tenant_detail_returns_generic_404(self):
        self._authenticate(self.tenant_user)
        response = self.client.get(
            reverse("organization-detail", args=[self.organization_b.id])
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_tenantless_non_global_user_fails_closed(self):
        self._authenticate(self.tenantless_user)
        list_response = self.client.get(reverse("organization-list"))
        detail_response = self.client.get(
            reverse("organization-detail", args=[self.organization_a.id])
        )
        create_response = self.client.post(
            reverse("organization-list"),
            self._organization_payload(),
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 0)
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(create_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Organization.objects.count(), 2)

    def test_is_staff_alone_remains_tenant_scoped(self):
        staff_user = self._user(
            "staff@example.com",
            tenant=self.tenant_a,
            role=self.manage_role,
            is_staff=True,
        )
        self._authenticate(staff_user)
        response = self.client.get(reverse("organization-list"))
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            self._results(response)[0]["id"],
            str(self.organization_a.id),
        )

    def test_superuser_receives_global_scope(self):
        superuser = User.objects.create_superuser(
            email="superuser@example.com",
            password="Password123!",
        )
        self._authenticate(superuser)
        response = self.client.get(reverse("organization-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)

    def test_active_system_admin_receives_global_scope(self):
        system_role = self._role_with_permissions(
            "System Admin",
            "system_admin",
            self.view_permission,
            self.manage_permission,
        )
        system_user = self._user(
            "system-admin@example.com",
            role=system_role,
        )
        self._authenticate(system_user)
        response = self.client.get(reverse("organization-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)

    def test_inactive_system_admin_role_does_not_grant_global_scope(self):
        system_role = self._role_with_permissions(
            "Inactive System Admin",
            "system_admin",
            self.view_permission,
            self.manage_permission,
            is_active=False,
        )
        user = self._user(
            "inactive-role@example.com",
            tenant=self.tenant_a,
            role=self.manage_role,
        )
        UserRole.objects.create(user=user, role=system_role)
        self._authenticate(user)
        response = self.client.get(reverse("organization-list"))
        self.assertEqual(response.data["count"], 1)

    def test_inactive_system_admin_assignment_does_not_grant_global_scope(self):
        system_role = self._role_with_permissions(
            "System Admin",
            "system_admin",
            self.view_permission,
            self.manage_permission,
        )
        user = self._user(
            "inactive-assignment@example.com",
            tenant=self.tenant_a,
            role=self.manage_role,
        )
        UserRole.objects.create(user=user, role=system_role, is_active=False)
        self._authenticate(user)
        response = self.client.get(reverse("organization-list"))
        self.assertEqual(response.data["count"], 1)

    def test_filters_cannot_broaden_tenant_scope(self):
        self._authenticate(self.tenant_user)
        response = self.client.get(
            reverse("organization-list"),
            {"tenant": str(self.tenant_b.id)},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_soft_deleted_records_are_excluded(self):
        self.organization_a.is_deleted = True
        self.organization_a.save(update_fields=["is_deleted"])
        self._authenticate(self.tenant_user)
        response = self.client.get(reverse("organization-list"))
        self.assertEqual(response.data["count"], 0)

    def test_deleted_endpoints_require_authentication(self):
        response = self.client.get(reverse("organization-deleted"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_deleted_endpoints_require_view_not_manage_permission(self):
        no_permission_user = self._user(
            "deleted-no-permission@example.com",
            tenant=self.tenant_a,
        )
        self._authenticate(no_permission_user)
        denied_response = self.client.get(reverse("organization-deleted"))

        self._authenticate(self.read_only_user)
        allowed_response = self.client.get(reverse("organization-deleted"))

        self.assertEqual(
            denied_response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(allowed_response.status_code, status.HTTP_200_OK)

    def test_deleted_endpoint_is_available_for_each_tenant_scoped_viewset(self):
        cases = (
            ("tenant-deleted", Tenant, self.tenant_a, self.tenant_b),
            (
                "organization-deleted",
                Organization,
                self.organization_a,
                self.organization_b,
            ),
            (
                "department-deleted",
                Department,
                self.department_a,
                self.department_b,
            ),
            ("building-deleted", Building, self.building_a, self.building_b),
            ("floor-deleted", Floor, self.floor_a, self.floor_b),
            ("area-deleted", Area, self.area_a, self.area_b),
            (
                "asset-type-deleted",
                AssetType,
                self.asset_type_a,
                self.asset_type_b,
            ),
            ("asset-deleted", Asset, self.asset_a, self.asset_b),
        )
        self._authenticate(self.read_only_user)

        for route_name, model, own_instance, other_instance in cases:
            with self.subTest(route_name=route_name):
                model.objects.filter(
                    id__in=(own_instance.id, other_instance.id)
                ).update(is_deleted=True)
                response = self.client.get(reverse(route_name))

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data["count"], 1)
                self.assertEqual(
                    self._results(response)[0]["id"],
                    str(own_instance.id),
                )

    def test_deleted_endpoint_fails_closed_for_tenantless_user(self):
        Organization.objects.filter(id=self.organization_a.id).update(
            is_deleted=True
        )
        self._authenticate(self.tenantless_user)

        response = self.client.get(reverse("organization-deleted"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_system_admin_deleted_endpoint_has_global_scope(self):
        Organization.objects.filter(
            id__in=(self.organization_a.id, self.organization_b.id)
        ).update(is_deleted=True)
        system_role = self._role_with_permissions(
            "Deleted System Admin",
            "system_admin",
            self.view_permission,
        )
        system_user = self._user(
            "deleted-system-admin@example.com",
            role=system_role,
        )
        self._authenticate(system_user)

        response = self.client.get(reverse("organization-deleted"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(
            {result["id"] for result in self._results(response)},
            {str(self.organization_a.id), str(self.organization_b.id)},
        )

    def test_deleted_endpoint_returns_only_deleted_and_is_paginated(self):
        deleted_ids = []
        for index in range(21):
            organization = Organization.objects.create(
                tenant=self.tenant_a,
                name=f"Deleted Organization {index:02d}",
                code=f"deleted-org-{index:02d}",
                is_deleted=True,
            )
            deleted_ids.append(str(organization.id))
        self._authenticate(self.read_only_user)

        response = self.client.get(
            reverse("organization-deleted"),
            {"page_size": 5},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 21)
        self.assertEqual(len(self._results(response)), 5)
        self.assertIsNotNone(response.data["next"])
        self.assertTrue(
            {result["id"] for result in self._results(response)}.issubset(
                set(deleted_ids)
            )
        )

    def test_deleted_endpoint_applies_only_safe_existing_filters(self):
        Organization.objects.filter(
            id__in=(self.organization_a.id, self.organization_b.id)
        ).update(is_deleted=True)
        self.organization_a.is_active = False
        self.organization_a.save(update_fields=["is_active"])
        self._authenticate(self.read_only_user)

        filtered_response = self.client.get(
            reverse("organization-deleted"),
            {
                "tenant": str(self.tenant_a.id),
                "is_active": "False",
                "include_deleted": "False",
                "code": self.organization_b.code,
            },
        )
        cross_tenant_response = self.client.get(
            reverse("organization-deleted"),
            {"tenant": str(self.tenant_b.id)},
        )

        self.assertEqual(filtered_response.status_code, status.HTTP_200_OK)
        self.assertEqual(filtered_response.data["count"], 1)
        self.assertEqual(
            self._results(filtered_response)[0]["id"],
            str(self.organization_a.id),
        )
        self.assertEqual(cross_tenant_response.data["count"], 0)

    def test_deleted_discovery_does_not_mutate_or_notify(self):
        Organization.objects.filter(id=self.organization_a.id).update(
            is_deleted=True
        )
        before = Organization.objects.filter(
            id=self.organization_a.id
        ).values(
            "is_deleted",
            "deleted_at",
            "deleted_by",
            "updated_at",
        ).get()
        notification_count = Notification.objects.count()
        self._authenticate(self.read_only_user)

        response = self.client.get(reverse("organization-deleted"))

        after = Organization.objects.filter(id=self.organization_a.id).values(
            "is_deleted",
            "deleted_at",
            "deleted_by",
            "updated_at",
        ).get()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(after, before)
        self.assertEqual(Notification.objects.count(), notification_count)

    def test_include_deleted_cannot_change_ordinary_list_visibility(self):
        Organization.objects.filter(id=self.organization_a.id).update(
            is_deleted=True
        )
        self._authenticate(self.read_only_user)

        response = self.client.get(
            reverse("organization-list"),
            {"include_deleted": "True"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_tenant_bound_create_binds_to_own_tenant(self):
        self._authenticate(self.tenant_user)
        payload = self._organization_payload()
        payload.pop("tenant")
        response = self.client.post(reverse("organization-list"), payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Organization.objects.get(code="new-organization")
        self.assertEqual(created.tenant_id, self.tenant_a.id)

    def test_same_tenant_submitted_tenant_succeeds(self):
        self._authenticate(self.tenant_user)
        response = self.client.post(
            reverse("organization-list"),
            self._organization_payload(),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(str(response.data["tenant"]), str(self.tenant_a.id))

    def test_cross_tenant_submitted_tenant_is_rejected_without_mutation(self):
        self._authenticate(self.tenant_user)
        response = self.client.post(
            reverse("organization-list"),
            self._organization_payload(tenant=str(self.tenant_b.id)),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tenant", response.data)
        self.assertFalse(
            Organization.objects.filter(code="new-organization").exists()
        )

    def test_partial_update_cannot_change_tenant(self):
        self._authenticate(self.tenant_user)
        response = self.client.patch(
            reverse("organization-detail", args=[self.organization_a.id]),
            {"tenant": str(self.tenant_b.id)},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.organization_a.refresh_from_db()
        self.assertEqual(self.organization_a.tenant_id, self.tenant_a.id)

    def test_cross_tenant_update_and_delete_return_404(self):
        self._authenticate(self.tenant_user)
        update_response = self.client.patch(
            reverse("organization-detail", args=[self.organization_b.id]),
            {"name": "Changed"},
        )
        delete_response = self.client.delete(
            reverse("organization-detail", args=[self.organization_b.id])
        )
        self.assertEqual(update_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(delete_response.status_code, status.HTTP_404_NOT_FOUND)
        self.organization_b.refresh_from_db()
        self.assertEqual(self.organization_b.name, "Organization B")

    def test_tenant_bound_user_cannot_create_or_delete_tenant(self):
        self._authenticate(self.tenant_user)
        create_response = self.client.post(
            reverse("tenant-list"),
            {
                "name": "Tenant C",
                "code": "tenant-c",
                "description": "",
                "is_active": True,
            },
        )
        delete_response = self.client.delete(
            reverse("tenant-detail", args=[self.tenant_a.id])
        )
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(delete_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Tenant.objects.filter(id=self.tenant_a.id).exists())

    def test_tenant_bound_user_may_update_own_tenant(self):
        self._authenticate(self.tenant_user)
        response = self.client.patch(
            reverse("tenant-detail", args=[self.tenant_a.id]),
            {"description": "Updated by tenant manager"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.tenant_a.refresh_from_db()
        self.assertEqual(
            self.tenant_a.description,
            "Updated by tenant manager",
        )

    def test_global_administrator_may_create_tenant_and_child_record(self):
        superuser = User.objects.create_superuser(
            email="global-create@example.com",
            password="Password123!",
        )
        self._authenticate(superuser)
        tenant_response = self.client.post(
            reverse("tenant-list"),
            {
                "name": "Tenant C",
                "code": "tenant-c",
                "description": "",
                "is_active": True,
            },
        )
        self.assertEqual(tenant_response.status_code, status.HTTP_201_CREATED)
        response = self.client.post(
            reverse("organization-list"),
            self._organization_payload(tenant=str(self.tenant_b.id)),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(str(response.data["tenant"]), str(self.tenant_b.id))

    def test_cross_tenant_organization_references_are_rejected(self):
        self._authenticate(self.tenant_user)
        for route_name, payload in (
            (
                "department-list",
                {
                    "tenant": str(self.tenant_a.id),
                    "organization": str(self.organization_b.id),
                    "name": "Department",
                    "code": "new-department",
                },
            ),
            (
                "building-list",
                {
                    "tenant": str(self.tenant_a.id),
                    "organization": str(self.organization_b.id),
                    "name": "Building",
                    "code": "new-building",
                },
            ),
        ):
            with self.subTest(route_name=route_name):
                response = self.client.post(reverse(route_name), payload)
                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )
                self.assertIn("organization", response.data)

    def test_cross_tenant_building_floor_and_asset_type_are_rejected(self):
        self._authenticate(self.tenant_user)
        floor_response = self.client.post(
            reverse("floor-list"),
            {
                "tenant": str(self.tenant_a.id),
                "building": str(self.building_b.id),
                "name": "Floor",
                "code": "new-floor",
                "level_number": 1,
            },
        )
        asset_response = self.client.post(
            reverse("asset-list"),
            self._asset_payload(asset_type=str(self.asset_type_b.id)),
        )
        self.assertEqual(
            floor_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("building", floor_response.data)
        self.assertEqual(
            asset_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("asset_type", asset_response.data)

    def test_cross_tenant_area_is_rejected(self):
        self._authenticate(self.tenant_user)
        response = self.client.post(
            reverse("asset-list"),
            self._asset_payload(area=str(self.area_b.id)),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("area", response.data)

    def test_area_requires_floor_from_selected_building(self):
        other_building = Building.objects.create(
            tenant=self.tenant_a,
            organization=self.organization_a,
            name="Other Building",
            code="other-building",
        )
        self._authenticate(self.tenant_user)
        response = self.client.post(
            reverse("area-list"),
            {
                "tenant": str(self.tenant_a.id),
                "building": str(other_building.id),
                "floor": str(self.floor_a.id),
                "name": "Area",
                "code": "new-area",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("floor", response.data)

    def test_asset_hierarchy_must_be_internally_consistent(self):
        other_building = Building.objects.create(
            tenant=self.tenant_a,
            organization=self.organization_a,
            name="Other Building",
            code="other-building",
        )
        self._authenticate(self.tenant_user)
        response = self.client.post(
            reverse("asset-list"),
            self._asset_payload(building=str(other_building.id)),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue("floor" in response.data or "area" in response.data)
        self.assertFalse(Asset.objects.filter(code="new-asset").exists())

    def test_global_administrator_cannot_create_inconsistent_hierarchy(self):
        superuser = User.objects.create_superuser(
            email="global-validation@example.com",
            password="Password123!",
        )
        self._authenticate(superuser)
        response = self.client.post(
            reverse("area-list"),
            {
                "tenant": str(self.tenant_a.id),
                "building": str(self.building_a.id),
                "floor": str(self.floor_b.id),
                "name": "Invalid Global Area",
                "code": "invalid-global-area",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("floor", response.data)
        self.assertFalse(Area.objects.filter(code="invalid-global-area").exists())

    def test_valid_same_tenant_asset_hierarchy_succeeds(self):
        self._authenticate(self.tenant_user)
        response = self.client.post(
            reverse("asset-list"),
            self._asset_payload(),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Asset.objects.get(code="new-asset")
        self.assertEqual(created.tenant_id, self.tenant_a.id)

    def test_list_query_count_remains_bounded(self):
        self._authenticate(self.tenant_user)
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(reverse("asset-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLessEqual(len(queries), 12)


class MasterDataLifecycleApiTests(APITestCase):
    def setUp(self):
        self.client.default_format = "json"
        self.tenant = Tenant.objects.create(name="Tenant", code="tenant")
        self.other_tenant = Tenant.objects.create(
            name="Other Tenant",
            code="other-tenant",
        )
        self.organization = Organization.objects.create(
            tenant=self.tenant,
            name="Organization",
            code="organization",
        )
        self.other_organization = Organization.objects.create(
            tenant=self.other_tenant,
            name="Other Organization",
            code="other-organization",
        )
        self.department = Department.objects.create(
            tenant=self.tenant,
            organization=self.organization,
            name="Department",
            code="department",
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
        self.asset = Asset.objects.create(
            tenant=self.tenant,
            organization=self.organization,
            building=self.building,
            floor=self.floor,
            area=self.area,
            asset_type=self.asset_type,
            name="Asset",
            code="asset",
        )

        view_permission = Permission.objects.create(
            name="View Settings",
            code="settings.view",
            module="settings",
            action="view",
        )
        manage_permission = Permission.objects.create(
            name="Manage Settings",
            code="settings.manage",
            module="settings",
            action="manage",
        )
        manager_role = Role.objects.create(
            name="Master Data Manager",
            code="master-data-manager",
        )
        viewer_role = Role.objects.create(
            name="Master Data Viewer",
            code="master-data-viewer",
        )
        for permission in (view_permission, manage_permission):
            RolePermission.objects.create(
                role=manager_role,
                permission=permission,
            )
        RolePermission.objects.create(
            role=viewer_role,
            permission=view_permission,
        )
        self.manager = self._user(
            "manager@example.com",
            tenant=self.tenant,
            role=manager_role,
            organization=self.organization,
        )
        self.other_manager = self._user(
            "other-manager@example.com",
            tenant=self.other_tenant,
            role=manager_role,
            organization=self.other_organization,
        )
        self.viewer = self._user(
            "viewer@example.com",
            tenant=self.tenant,
            role=viewer_role,
        )
        self.tenantless_manager = self._user(
            "tenantless@example.com",
            tenant=None,
            role=manager_role,
        )
        self.staff_manager = self._user(
            "staff@example.com",
            tenant=self.tenant,
            role=manager_role,
            is_staff=True,
        )
        self.superuser = User.objects.create_superuser(
            email="superuser@example.com",
            password="Password123!",
        )

    def _user(
        self,
        email,
        *,
        tenant,
        role,
        organization=None,
        is_staff=False,
    ):
        user = User.objects.create_user(
            email=email,
            password="Password123!",
            tenant=tenant,
            organization=organization,
            is_staff=is_staff,
        )
        UserRole.objects.create(user=user, role=role)
        return user

    def _authenticate(self, user=None):
        self.client.force_authenticate(user or self.manager)

    def _soft_mark_deleted(self, instance, *, actor=None):
        instance.is_deleted = True
        instance.is_active = False
        instance.deleted_at = instance.updated_at
        instance.deleted_by = (actor or self.manager).id
        instance.save(
            update_fields=(
                "is_deleted",
                "is_active",
                "deleted_at",
                "deleted_by",
                "updated_at",
            )
        )

    def test_delete_soft_deletes_leaf_and_hides_it(self):
        self._authenticate()
        detail_url = reverse("asset-detail", args=[self.asset.id])

        response = self.client.delete(detail_url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.asset.refresh_from_db()
        self.assertTrue(self.asset.is_deleted)
        self.assertFalse(self.asset.is_active)
        self.assertIsNotNone(self.asset.deleted_at)
        self.assertEqual(self.asset.deleted_by, self.manager.id)
        self.assertEqual(self.asset.updated_by, self.manager.id)
        self.assertTrue(Asset.objects.filter(id=self.asset.id).exists())
        self.assertEqual(self.client.get(detail_url).status_code, 404)
        self.assertEqual(self.client.delete(detail_url).status_code, 404)
        list_response = self.client.get(reverse("asset-list"))
        self.assertEqual(list_response.data["count"], 0)

    def test_soft_delete_is_available_for_all_eight_resources(self):
        isolated_tenant = Tenant.objects.create(
            name="Isolated Tenant",
            code="isolated-tenant",
        )
        isolated_organization = Organization.objects.create(
            tenant=self.tenant,
            name="Isolated Organization",
            code="isolated-organization",
        )
        isolated_building = Building.objects.create(
            tenant=self.tenant,
            organization=self.organization,
            name="Isolated Building",
            code="isolated-building",
        )
        isolated_floor = Floor.objects.create(
            tenant=self.tenant,
            building=self.building,
            name="Isolated Floor",
            code="isolated-floor",
        )
        isolated_area = Area.objects.create(
            tenant=self.tenant,
            building=self.building,
            floor=self.floor,
            name="Isolated Area",
            code="isolated-area",
        )
        isolated_asset_type = AssetType.objects.create(
            tenant=self.tenant,
            name="Isolated Asset Type",
            code="isolated-asset-type",
        )
        cases = (
            ("tenant", isolated_tenant, self.superuser),
            ("organization", isolated_organization, self.manager),
            ("department", self.department, self.manager),
            ("building", isolated_building, self.manager),
            ("floor", isolated_floor, self.manager),
            ("area", isolated_area, self.manager),
            ("asset-type", isolated_asset_type, self.manager),
            ("asset", self.asset, self.manager),
        )
        for route_name, instance, actor in cases:
            with self.subTest(route_name=route_name):
                self._authenticate(actor)
                response = self.client.delete(
                    reverse(f"{route_name}-detail", args=[instance.id])
                )
                self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
                instance.refresh_from_db()
                self.assertTrue(instance.is_deleted)
                self.assertFalse(instance.is_active)

    def test_delete_permissions_and_tenant_scope_fail_closed(self):
        detail_url = reverse("asset-detail", args=[self.asset.id])
        for actor, expected_status in (
            (self.viewer, status.HTTP_403_FORBIDDEN),
            (self.other_manager, status.HTTP_404_NOT_FOUND),
            (self.tenantless_manager, status.HTTP_404_NOT_FOUND),
        ):
            with self.subTest(actor=actor.email):
                self._authenticate(actor)
                response = self.client.delete(detail_url)
                self.assertEqual(response.status_code, expected_status)
                self.asset.refresh_from_db()
                self.assertFalse(self.asset.is_deleted)

    def test_staff_alone_does_not_receive_global_delete_scope(self):
        other_asset_type = AssetType.objects.create(
            tenant=self.other_tenant,
            name="Other Asset Type",
            code="other-asset-type",
        )
        self._authenticate(self.staff_manager)
        response = self.client.delete(
            reverse("asset-type-detail", args=[other_asset_type.id])
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_system_admin_global_scope_requires_active_assignment(self):
        system_role = Role.objects.create(
            name="System Administrator",
            code="system_admin",
        )
        for permission in Permission.objects.all():
            RolePermission.objects.create(
                role=system_role,
                permission=permission,
            )
        system_user = self._user(
            "system-admin@example.com",
            tenant=None,
            role=system_role,
        )
        self._soft_mark_deleted(self.asset)
        restore_url = reverse("asset-restore", args=[self.asset.id])
        self._authenticate(system_user)
        allowed = self.client.post(restore_url)
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)

        self._soft_mark_deleted(self.asset)
        inactive_assignment_user = self._user(
            "inactive-system-admin@example.com",
            tenant=self.other_tenant,
            role=self.manager.user_roles.first().role,
        )
        UserRole.objects.create(
            user=inactive_assignment_user,
            role=system_role,
            is_active=False,
        )
        self._authenticate(inactive_assignment_user)
        denied = self.client.post(restore_url)
        self.assertEqual(denied.status_code, status.HTTP_404_NOT_FOUND)

    def test_tenant_delete_is_global_only(self):
        isolated_tenant = Tenant.objects.create(
            name="Isolated Tenant",
            code="isolated-tenant",
        )
        self._authenticate()
        denied = self.client.delete(
            reverse("tenant-detail", args=[self.tenant.id])
        )
        self._authenticate(self.superuser)
        allowed = self.client.delete(
            reverse("tenant-detail", args=[isolated_tenant.id])
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(allowed.status_code, status.HTTP_204_NO_CONTENT)

    def test_restore_returns_resource_in_inactive_visible_state(self):
        self._soft_mark_deleted(self.asset)
        self._authenticate()

        response = self.client.post(
            reverse("asset-restore", args=[self.asset.id])
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.asset.refresh_from_db()
        self.assertFalse(self.asset.is_deleted)
        self.assertFalse(self.asset.is_active)
        self.assertIsNone(self.asset.deleted_at)
        self.assertIsNone(self.asset.deleted_by)
        self.assertEqual(self.asset.updated_by, self.manager.id)
        self.assertEqual(response.data["id"], str(self.asset.id))
        self.assertFalse(response.data["is_active"])
        self.assertEqual(
            self.client.get(reverse("asset-list")).data["count"],
            1,
        )

    def test_restore_is_available_for_all_eight_resources(self):
        isolated_tenant = Tenant.objects.create(
            name="Isolated Tenant",
            code="isolated-tenant",
        )
        isolated_organization = Organization.objects.create(
            tenant=self.tenant,
            name="Isolated Organization",
            code="isolated-organization",
        )
        isolated_building = Building.objects.create(
            tenant=self.tenant,
            organization=self.organization,
            name="Isolated Building",
            code="isolated-building",
        )
        isolated_floor = Floor.objects.create(
            tenant=self.tenant,
            building=self.building,
            name="Isolated Floor",
            code="isolated-floor",
        )
        isolated_area = Area.objects.create(
            tenant=self.tenant,
            building=self.building,
            floor=self.floor,
            name="Isolated Area",
            code="isolated-area",
        )
        isolated_asset_type = AssetType.objects.create(
            tenant=self.tenant,
            name="Isolated Asset Type",
            code="isolated-asset-type",
        )
        cases = (
            ("tenant", isolated_tenant, self.superuser),
            ("organization", isolated_organization, self.manager),
            ("department", self.department, self.manager),
            ("building", isolated_building, self.manager),
            ("floor", isolated_floor, self.manager),
            ("area", isolated_area, self.manager),
            ("asset-type", isolated_asset_type, self.manager),
            ("asset", self.asset, self.manager),
        )
        for route_name, instance, actor in cases:
            with self.subTest(route_name=route_name):
                self._soft_mark_deleted(instance, actor=actor)
                self._authenticate(actor)
                response = self.client.post(
                    reverse(f"{route_name}-restore", args=[instance.id])
                )
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                instance.refresh_from_db()
                self.assertFalse(instance.is_deleted)
                self.assertFalse(instance.is_active)

    def test_restore_permissions_scope_and_conflict(self):
        self._soft_mark_deleted(self.asset)
        restore_url = reverse("asset-restore", args=[self.asset.id])
        for actor, expected_status in (
            (self.viewer, status.HTTP_403_FORBIDDEN),
            (self.other_manager, status.HTTP_404_NOT_FOUND),
            (self.tenantless_manager, status.HTTP_404_NOT_FOUND),
        ):
            with self.subTest(actor=actor.email):
                self._authenticate(actor)
                response = self.client.post(restore_url)
                self.assertEqual(response.status_code, expected_status)
                self.asset.refresh_from_db()
                self.assertTrue(self.asset.is_deleted)

        self.asset.is_deleted = False
        self.asset.save(update_fields=("is_deleted", "updated_at"))
        self._authenticate()
        response = self.client.post(restore_url)
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn("detail", response.data)

    def test_tenant_restore_and_reactivation_are_global_only(self):
        isolated_tenant = Tenant.objects.create(
            name="Isolated Tenant",
            code="isolated-tenant",
            is_active=False,
            is_deleted=True,
        )
        restore_url = reverse("tenant-restore", args=[isolated_tenant.id])
        self._authenticate()
        denied_restore = self.client.post(restore_url)
        self._authenticate(self.superuser)
        allowed_restore = self.client.post(restore_url)
        self.assertEqual(denied_restore.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(allowed_restore.status_code, status.HTTP_200_OK)

        isolated_tenant.refresh_from_db()
        self.assertFalse(isolated_tenant.is_active)
        tenant_user = self._user(
            "isolated@example.com",
            tenant=isolated_tenant,
            role=self.manager.user_roles.first().role,
        )
        self._authenticate(tenant_user)
        denied_reactivation = self.client.patch(
            reverse("tenant-detail", args=[isolated_tenant.id]),
            {"is_active": True},
        )
        self._authenticate(self.superuser)
        allowed_reactivation = self.client.patch(
            reverse("tenant-detail", args=[isolated_tenant.id]),
            {"is_active": True},
        )
        self.assertEqual(
            denied_reactivation.status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(allowed_reactivation.status_code, status.HTTP_200_OK)

    def test_restore_rejects_inactive_deleted_and_mismatched_parents(self):
        self._soft_mark_deleted(self.asset)
        restore_url = reverse("asset-restore", args=[self.asset.id])
        self._authenticate()

        self.area.is_active = False
        self.area.save(update_fields=("is_active", "updated_at"))
        inactive_response = self.client.post(restore_url)
        self.assertEqual(inactive_response.status_code, status.HTTP_409_CONFLICT)
        self.asset.refresh_from_db()
        self.assertTrue(self.asset.is_deleted)

        self.area.is_active = True
        self.area.is_deleted = True
        self.area.save(
            update_fields=("is_active", "is_deleted", "updated_at")
        )
        deleted_response = self.client.post(restore_url)
        self.assertEqual(deleted_response.status_code, status.HTTP_409_CONFLICT)
        self.asset.refresh_from_db()
        self.assertTrue(self.asset.is_deleted)

        self.area.is_deleted = False
        self.area.save(update_fields=("is_deleted", "updated_at"))
        other_organization = Organization.objects.create(
            tenant=self.tenant,
            name="Another Organization",
            code="another-organization",
        )
        other_building = Building.objects.create(
            tenant=self.tenant,
            organization=other_organization,
            name="Another Building",
            code="another-building",
        )
        Asset.objects.filter(id=self.asset.id).update(building=other_building)
        mismatched_response = self.client.post(restore_url)
        self.assertEqual(
            mismatched_response.status_code,
            status.HTTP_409_CONFLICT,
        )
        self.asset.refresh_from_db()
        self.assertTrue(self.asset.is_deleted)

    def test_leaf_deactivation_and_reactivation_are_distinct_from_delete(self):
        self._authenticate()
        detail_url = reverse("asset-detail", args=[self.asset.id])

        deactivate_response = self.client.patch(
            detail_url,
            {"is_active": False},
        )

        self.assertEqual(deactivate_response.status_code, status.HTTP_200_OK)
        self.asset.refresh_from_db()
        self.assertFalse(self.asset.is_active)
        self.assertFalse(self.asset.is_deleted)
        self.assertIsNone(self.asset.deleted_at)
        self.assertEqual(
            self.client.get(reverse("asset-list")).data["count"],
            1,
        )
        reactivate_response = self.client.patch(
            detail_url,
            {"is_active": True},
        )
        self.assertEqual(reactivate_response.status_code, status.HTTP_200_OK)

    def test_parent_deactivation_and_delete_report_dependencies(self):
        self._authenticate()
        cases = (
            (
                "organization",
                self.organization,
                {"departments", "buildings", "assets", "users"},
            ),
            ("building", self.building, {"floors", "areas", "assets"}),
            ("floor", self.floor, {"areas", "assets"}),
            ("area", self.area, {"assets"}),
            ("asset-type", self.asset_type, {"assets"}),
        )
        for route_name, instance, expected_dependencies in cases:
            original_updated_by = instance.updated_by
            original_deleted_at = instance.deleted_at
            original_deleted_by = instance.deleted_by
            with self.subTest(route_name=route_name, operation="deactivate"):
                response = self.client.patch(
                    reverse(f"{route_name}-detail", args=[instance.id]),
                    {"is_active": False},
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_409_CONFLICT,
                )
                self.assertEqual(
                    set(response.data["dependencies"]),
                    expected_dependencies,
                )
                instance.refresh_from_db()
                self.assertTrue(instance.is_active)
                self.assertFalse(instance.is_deleted)
                self.assertEqual(instance.updated_by, original_updated_by)
                self.assertEqual(instance.deleted_at, original_deleted_at)
                self.assertEqual(instance.deleted_by, original_deleted_by)
            with self.subTest(route_name=route_name, operation="delete"):
                response = self.client.delete(
                    reverse(f"{route_name}-detail", args=[instance.id])
                )
                self.assertEqual(
                    response.status_code,
                    status.HTTP_409_CONFLICT,
                )
                instance.refresh_from_db()
                self.assertFalse(instance.is_deleted)
                self.assertTrue(instance.is_active)
                self.assertEqual(instance.updated_by, original_updated_by)
                self.assertEqual(instance.deleted_at, original_deleted_at)
                self.assertEqual(instance.deleted_by, original_deleted_by)

    def test_tenant_dependencies_include_children_and_users(self):
        self._authenticate(self.superuser)
        deactivation_response = self.client.patch(
            reverse("tenant-detail", args=[self.tenant.id]),
            {"is_active": False},
        )
        self.assertEqual(
            deactivation_response.status_code,
            status.HTTP_409_CONFLICT,
        )
        with CaptureQueriesContext(connection) as queries:
            response = self.client.delete(
                reverse("tenant-detail", args=[self.tenant.id])
            )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(
            set(response.data["dependencies"]),
            {
                "organizations",
                "departments",
                "buildings",
                "floors",
                "areas",
                "asset types",
                "assets",
                "users",
            },
        )
        self.assertLessEqual(len(queries), 20)

    def test_deleted_children_do_not_block_parent_soft_delete(self):
        isolated_type = AssetType.objects.create(
            tenant=self.tenant,
            name="Disposable Type",
            code="disposable-type",
        )
        isolated_asset = Asset.objects.create(
            tenant=self.tenant,
            organization=self.organization,
            building=self.building,
            asset_type=isolated_type,
            name="Disposable Asset",
            code="disposable-asset",
            is_active=False,
            is_deleted=True,
        )
        self._authenticate()
        response = self.client.delete(
            reverse("asset-type-detail", args=[isolated_type.id])
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        isolated_asset.refresh_from_db()
        self.assertTrue(isolated_asset.is_deleted)
        self.assertTrue(Asset.objects.filter(id=isolated_asset.id).exists())

    def test_inactive_children_do_not_block_deactivation_but_block_delete(self):
        isolated_type = AssetType.objects.create(
            tenant=self.tenant,
            name="Inactive Child Type",
            code="inactive-child-type",
        )
        Asset.objects.create(
            tenant=self.tenant,
            organization=self.organization,
            building=self.building,
            asset_type=isolated_type,
            name="Inactive Child",
            code="inactive-child",
            is_active=False,
        )
        self._authenticate()
        detail_url = reverse("asset-type-detail", args=[isolated_type.id])
        deactivate_response = self.client.patch(
            detail_url,
            {"is_active": False},
        )
        delete_response = self.client.delete(detail_url)
        self.assertEqual(deactivate_response.status_code, status.HTTP_200_OK)
        self.assertEqual(delete_response.status_code, status.HTTP_409_CONFLICT)

    def test_dependency_checks_do_not_cross_tenant_or_emit_notifications(self):
        isolated_type = AssetType.objects.create(
            tenant=self.tenant,
            name="Tenant Scoped Type",
            code="tenant-scoped-type",
        )
        Asset.objects.create(
            tenant=self.other_tenant,
            organization=self.other_organization,
            building=Building.objects.create(
                tenant=self.other_tenant,
                organization=self.other_organization,
                name="Other Building",
                code="other-building",
            ),
            asset_type=isolated_type,
            name="Inconsistent Historical Asset",
            code="inconsistent-historical-asset",
        )
        notification_count = Notification.objects.count()
        self._authenticate()
        response = self.client.delete(
            reverse("asset-type-detail", args=[isolated_type.id])
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Notification.objects.count(), notification_count)

        blocked_response = self.client.delete(
            reverse("asset-type-detail", args=[self.asset_type.id])
        )
        self.assertEqual(blocked_response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(Notification.objects.count(), notification_count)

    def test_reactivation_requires_active_non_deleted_hierarchy(self):
        self.asset.is_active = False
        self.asset.save(update_fields=("is_active", "updated_at"))
        self.area.is_active = False
        self.area.save(update_fields=("is_active", "updated_at"))
        self._authenticate()
        detail_url = reverse("asset-detail", args=[self.asset.id])

        inactive_parent_response = self.client.patch(
            detail_url,
            {"is_active": True},
        )
        self.assertEqual(
            inactive_parent_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("area", inactive_parent_response.data)

        self.area.is_active = True
        self.area.is_deleted = True
        self.area.save(
            update_fields=("is_active", "is_deleted", "updated_at")
        )
        deleted_parent_response = self.client.patch(
            detail_url,
            {"is_active": True},
        )
        self.assertEqual(
            deleted_parent_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("area", deleted_parent_response.data)

        metadata_response = self.client.patch(
            detail_url,
            {"description": "Repair notes"},
        )
        self.assertEqual(metadata_response.status_code, status.HTTP_200_OK)

        self.area.is_deleted = False
        self.area.save(update_fields=("is_deleted", "updated_at"))
        valid_response = self.client.patch(
            detail_url,
            {"is_active": True},
        )
        self.assertEqual(valid_response.status_code, status.HTTP_200_OK)

    def test_active_create_rejects_inactive_parent_but_inactive_create_allows_it(self):
        self.organization.is_active = False
        self.organization.save(update_fields=("is_active", "updated_at"))
        self._authenticate()
        payload = {
            "tenant": str(self.tenant.id),
            "organization": str(self.organization.id),
            "name": "Lifecycle Department",
            "code": "lifecycle-department",
            "is_active": True,
        }
        active_response = self.client.post(reverse("department-list"), payload)
        payload["code"] = "default-active-department"
        payload.pop("is_active")
        default_active_response = self.client.post(
            reverse("department-list"),
            payload,
        )
        payload["code"] = "lifecycle-department"
        payload["is_active"] = False
        inactive_response = self.client.post(
            reverse("department-list"),
            payload,
        )
        self.assertEqual(
            active_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("organization", active_response.data)
        self.assertEqual(
            default_active_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("organization", default_active_response.data)
        self.assertEqual(inactive_response.status_code, status.HTTP_201_CREATED)

    def test_soft_deleted_identifiers_remain_reserved(self):
        self._soft_mark_deleted(self.asset)
        self._authenticate()
        response = self.client.post(
            reverse("asset-list"),
            {
                "tenant": str(self.tenant.id),
                "organization": str(self.organization.id),
                "building": str(self.building.id),
                "floor": str(self.floor.id),
                "area": str(self.area.id),
                "asset_type": str(self.asset_type.id),
                "name": "Replacement Asset",
                "code": self.asset.code,
                "is_active": True,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Asset.objects.filter(code=self.asset.code).count(), 1)
