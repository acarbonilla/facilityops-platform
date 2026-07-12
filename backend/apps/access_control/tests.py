from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APITestCase

from apps.master_data.models import Tenant

from .models import Permission, Role, RolePermission, UserRole
from .management.commands.seed_rbac import (
    PERMISSION_DEFINITIONS,
    ROLE_DEFINITIONS,
    ROLE_PERMISSION_CODES,
)
from .services import (
    create_role,
    deactivate_role,
    replace_role_permissions,
    get_user_permission_codes,
    get_user_roles,
    update_role,
    user_has_permission,
)

User = get_user_model()


class AccessControlModelTests(APITestCase):
    def test_role_creation(self):
        role = Role.objects.create(name="Role A", code="role_a")

        self.assertEqual(str(role), "Role A (role_a)")

    def test_permission_creation(self):
        permission = Permission.objects.create(
            name="View Users",
            code="users.view",
            module="users",
            action="view",
        )

        self.assertEqual(str(permission), "users.view")

    def test_role_permission_assignment(self):
        role = Role.objects.create(name="Role A", code="role_a")
        permission = Permission.objects.create(
            name="View Users",
            code="users.view",
            module="users",
            action="view",
        )
        assignment = RolePermission.objects.create(
            role=role,
            permission=permission,
        )

        self.assertEqual(str(assignment), "role_a -> users.view")

    def test_user_role_assignment(self):
        user = User.objects.create_user(
            email="user@example.com",
            password="Password123!",
        )
        role = Role.objects.create(name="Role A", code="role_a")
        assignment = UserRole.objects.create(user=user, role=role)

        self.assertEqual(str(assignment), "user@example.com -> role_a")


class AccessControlServiceTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="user@example.com",
            password="Password123!",
        )
        self.superuser = User.objects.create_superuser(
            email="superuser@example.com",
            password="Password123!",
        )
        self.role = Role.objects.create(name="Role A", code="role_a")
        self.permission = Permission.objects.create(
            name="View Users",
            code="users.view",
            module="users",
            action="view",
        )
        self.role_permission = RolePermission.objects.create(
            role=self.role,
            permission=self.permission,
        )
        self.user_role = UserRole.objects.create(user=self.user, role=self.role)

    def test_user_has_permission_returns_true_for_assigned_permission(self):
        self.assertTrue(user_has_permission(self.user, "users.view"))

    def test_user_has_permission_returns_false_for_missing_permission(self):
        self.assertFalse(user_has_permission(self.user, "roles.manage"))

    def test_superuser_bypass_works(self):
        self.assertTrue(user_has_permission(self.superuser, "roles.manage"))

    def test_inactive_user_fails_permission_check(self):
        self.user.is_active = False
        self.user.save()

        self.assertFalse(user_has_permission(self.user, "users.view"))

    def test_inactive_role_is_ignored(self):
        self.role.is_active = False
        self.role.save()

        self.assertFalse(user_has_permission(self.user, "users.view"))

    def test_inactive_permission_is_ignored(self):
        self.permission.is_active = False
        self.permission.save()

        self.assertFalse(user_has_permission(self.user, "users.view"))

    def test_inactive_role_permission_assignment_is_ignored(self):
        self.role_permission.is_active = False
        self.role_permission.save()

        self.assertFalse(user_has_permission(self.user, "users.view"))

    def test_get_user_roles_returns_active_roles_only(self):
        roles = list(get_user_roles(self.user))

        self.assertEqual([role.code for role in roles], ["role_a"])

    def test_get_user_permission_codes_returns_expected_codes(self):
        permission_codes = get_user_permission_codes(self.user)

        self.assertEqual(permission_codes, {"users.view"})


class AccessControlEndpointTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="user@example.com",
            password="Password123!",
        )
        self.superuser = User.objects.create_superuser(
            email="superuser@example.com",
            password="Password123!",
        )
        self.role = Role.objects.create(name="Role A", code="role_a")
        self.view_permission = Permission.objects.create(
            name="View Roles",
            code="roles.view",
            module="roles",
            action="view",
        )
        self.manage_permission = Permission.objects.create(
            name="Manage Roles",
            code="roles.manage",
            module="roles",
            action="manage",
        )
        RolePermission.objects.create(
            role=self.role,
            permission=self.view_permission,
        )
        UserRole.objects.create(user=self.user, role=self.role)

    def test_has_permission_code_allows_correctly(self):
        self.client.force_authenticate(self.user)

        response = self.client.get(reverse("rbac-roles"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_has_permission_code_denies_correctly(self):
        self.client.force_authenticate(self.user)

        response = self.client.get(reverse("rbac-permissions"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_roles_endpoint_requires_authentication(self):
        response = self.client.get(reverse("rbac-roles"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_current_user_permissions_endpoint_returns_authenticated_user_data(
        self,
    ):
        self.client.force_authenticate(self.user)

        response = self.client.get(reverse("rbac-me-permissions"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["roles"], ["role_a"])
        self.assertEqual(response.data["permissions"], ["roles.view"])

    def test_superuser_can_access_all_rbac_endpoints(self):
        self.client.force_authenticate(self.superuser)

        roles_response = self.client.get(reverse("rbac-roles"))
        permissions_response = self.client.get(reverse("rbac-permissions"))

        self.assertEqual(roles_response.status_code, status.HTTP_200_OK)
        self.assertEqual(permissions_response.status_code, status.HTTP_200_OK)


@override_settings(PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",))
class RoleCatalogAdministrationTests(APITestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name="Tenant", code="tenant")
        self.view_permission = Permission.objects.create(
            name="View Roles",
            code="roles.view",
            module="roles",
            action="view",
        )
        self.manage_permission = Permission.objects.create(
            name="Manage Roles",
            code="roles.manage",
            module="roles",
            action="manage",
        )
        self.viewer_role = self._role_with_permissions(
            "Role Viewer", "role_viewer", (self.view_permission,)
        )
        self.manager_role = self._role_with_permissions(
            "Tenant Manager",
            "tenant_manager",
            (self.view_permission, self.manage_permission),
        )
        self.system_admin_role = self._role_with_permissions(
            "System Administrator",
            "system_admin",
            (self.view_permission, self.manage_permission),
            is_system_role=True,
        )
        self.viewer = self._user("viewer@example.com", self.viewer_role)
        self.tenant_manager = self._user(
            "tenant-manager@example.com", self.manager_role, tenant=self.tenant
        )
        self.system_admin = self._user(
            "system-admin@example.com", self.system_admin_role
        )
        self.superuser = User.objects.create_superuser(
            email="role-superuser@example.com", password="Password123!"
        )
        self.custom_role = Role.objects.create(
            name="Custom Operator",
            code="custom_operator",
            description="Custom role",
        )

    def _role_with_permissions(self, name, code, permissions, is_system_role=False):
        role = Role.objects.create(name=name, code=code, is_system_role=is_system_role)
        for permission in permissions:
            RolePermission.objects.create(role=role, permission=permission)
        return role

    def _user(self, email, role, tenant=None, is_active=True):
        user = User.objects.create_user(
            email=email,
            password="Password123!",
            tenant=tenant,
            is_active=is_active,
        )
        UserRole.objects.create(user=user, role=role)
        return user

    def _detail_url(self, role=None):
        return reverse("rbac-role-detail", args=((role or self.custom_role).id,))

    def _authenticate(self, user):
        self.client.force_authenticate(user)

    def test_role_reads_require_view_permission(self):
        no_permission = User.objects.create_user(
            email="no-role-view@example.com", password="Password123!"
        )
        self._authenticate(no_permission)

        self.assertEqual(
            self.client.get(reverse("rbac-roles")).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.get(self._detail_url()).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_list_is_paginated_and_includes_inactive_roles(self):
        for index in range(22):
            Role.objects.create(name=f"Catalog {index:02}", code=f"catalog_{index}")
        self.custom_role.is_active = False
        self.custom_role.save(update_fields=("is_active",))
        self._authenticate(self.viewer)

        response = self.client.get(reverse("rbac-roles"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(response.data["count"], 20)
        self.assertEqual(len(response.data["results"]), 20)
        self.assertIn("created_at", response.data["results"][0])
        self.assertIn("updated_at", response.data["results"][0])

    def test_list_supports_search_filters_and_ordering(self):
        inactive_system = Role.objects.create(
            name="Archived System Search Target",
            code="archived_system_target",
            description="Needle description",
            is_system_role=True,
            is_active=False,
        )
        self._authenticate(self.viewer)

        response = self.client.get(
            reverse("rbac-roles"),
            {
                "search": "Needle",
                "is_system_role": "true",
                "is_active": "false",
                "ordering": "-code",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data["results"]],
            [str(inactive_system.id)],
        )

    def test_actor_without_manage_cannot_mutate(self):
        self._authenticate(self.viewer)
        payload = {"name": "Denied", "code": "denied", "description": ""}

        self.assertEqual(
            self.client.post(reverse("rbac-roles"), payload).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.patch(self._detail_url(), {"name": "Denied"}).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.delete(self._detail_url()).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_tenant_bound_manager_cannot_mutate_api_or_service(self):
        self._authenticate(self.tenant_manager)
        response = self.client.post(
            reverse("rbac-roles"),
            {"name": "Denied", "code": "denied", "description": ""},
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        for method in (self.client.put, self.client.patch, self.client.delete):
            kwargs = {} if method == self.client.delete else {"data": {"name": "No"}}
            self.assertEqual(
                method(self._detail_url(), **kwargs).status_code,
                status.HTTP_403_FORBIDDEN,
            )
        with self.assertRaises(PermissionDenied):
            create_role(
                actor=self.tenant_manager,
                validated_data={"name": "Denied", "code": "denied"},
            )
        with self.assertRaises(PermissionDenied):
            deactivate_role(actor=self.tenant_manager, role=self.custom_role)
        with self.assertRaises(PermissionDenied):
            update_role(
                actor=self.tenant_manager,
                role=self.custom_role,
                validated_data={"name": "Denied"},
            )

    def test_superuser_creates_normalized_custom_role(self):
        self._authenticate(self.superuser)

        response = self.client.post(
            reverse("rbac-roles"),
            {
                "name": "  Operations Lead  ",
                "code": "Operations Lead",
                "description": "Coordinates operations",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Operations Lead")
        self.assertEqual(response.data["code"], "operations-lead")
        self.assertFalse(response.data["is_system_role"])
        self.assertTrue(response.data["is_active"])

    def test_active_system_admin_creates_role_but_inactive_cannot(self):
        self._authenticate(self.system_admin)
        response = self.client.post(
            reverse("rbac-roles"),
            {"name": "Coordinator", "code": "coordinator"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.system_admin.is_active = False
        self.system_admin.save(update_fields=("is_active",))
        self._authenticate(self.system_admin)
        response = self.client.post(
            reverse("rbac-roles"),
            {"name": "Denied", "code": "inactive_denied"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_creation_rejects_duplicate_blank_malformed_and_protected_fields(self):
        self._authenticate(self.superuser)
        payloads = (
            {"name": "Duplicate", "code": "CUSTOM_OPERATOR"},
            {"name": "   ", "code": "blank_name"},
            {"name": "Malformed", "code": "bad@code"},
            {"name": "Protected", "code": "protected", "is_system_role": True},
            {"name": "Inactive", "code": "inactive", "is_active": False},
        )

        for payload in payloads:
            response = self.client.post(reverse("rbac-roles"), payload, format="json")
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_custom_role_metadata_updates_but_code_and_state_do_not(self):
        self._authenticate(self.superuser)
        replace_response = self.client.put(
            self._detail_url(),
            {
                "name": "Replacement Operator",
                "code": self.custom_role.code,
                "description": "Replacement",
            },
            format="json",
        )
        self.assertEqual(replace_response.status_code, status.HTTP_200_OK)

        response = self.client.patch(
            self._detail_url(),
            {"name": "Updated Operator", "description": "Updated"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.custom_role.refresh_from_db()
        self.assertEqual(self.custom_role.name, "Updated Operator")
        self.assertEqual(self.custom_role.description, "Updated")

        for field, value in (
            ("code", "changed"),
            ("is_system_role", True),
            ("is_active", False),
        ):
            response = self.client.patch(
                self._detail_url(), {field: value}, format="json"
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_system_roles_cannot_be_updated_or_deleted(self):
        self._authenticate(self.superuser)

        self.assertEqual(
            self.client.patch(
                self._detail_url(self.system_admin_role),
                {"description": "Changed"},
                format="json",
            ).status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            self.client.delete(self._detail_url(self.system_admin_role)).status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.system_admin_role.refresh_from_db()
        self.assertTrue(self.system_admin_role.is_active)

    def test_delete_soft_deactivates_role_and_all_assignments(self):
        permission_assignment = RolePermission.objects.create(
            role=self.custom_role, permission=self.view_permission
        )
        assigned_user = User.objects.create_user(
            email="assigned@example.com", password="Password123!"
        )
        user_assignment = UserRole.objects.create(
            user=assigned_user, role=self.custom_role
        )
        self._authenticate(self.superuser)

        response = self.client.delete(self._detail_url())

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.custom_role.refresh_from_db()
        permission_assignment.refresh_from_db()
        user_assignment.refresh_from_db()
        self.assertFalse(self.custom_role.is_active)
        self.assertFalse(permission_assignment.is_active)
        self.assertFalse(user_assignment.is_active)
        self.assertTrue(Role.objects.filter(pk=self.custom_role.pk).exists())
        self.assertTrue(
            RolePermission.objects.filter(pk=permission_assignment.pk).exists()
        )
        self.assertTrue(UserRole.objects.filter(pk=user_assignment.pk).exists())
        self.assertEqual(
            self.client.delete(self._detail_url()).status_code,
            status.HTTP_204_NO_CONTENT,
        )


@override_settings(PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",))
class RolePermissionAssignmentWorkflowTests(APITestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name="Tenant", code="tenant")

        self.roles_view_permission = Permission.objects.create(
            name="View Roles",
            code="roles.view",
            module="roles",
            action="view",
        )
        self.roles_manage_permission = Permission.objects.create(
            name="Manage Roles",
            code="roles.manage",
            module="roles",
            action="manage",
        )
        self.users_view_permission = Permission.objects.create(
            name="View Users",
            code="users.view",
            module="users",
            action="view",
        )
        self.users_update_permission = Permission.objects.create(
            name="Update Users",
            code="users.update",
            module="users",
            action="update",
        )
        self.assets_view_permission = Permission.objects.create(
            name="View Assets",
            code="assets.view",
            module="assets",
            action="view",
        )
        self.inactive_permission = Permission.objects.create(
            name="Inactive",
            code="users.inactive",
            module="users",
            action="inactive",
            is_active=False,
        )

        self.viewer_role = self._role_with_permissions(
            "Role Viewer",
            "role_viewer",
            (self.roles_view_permission,),
        )
        self.manager_role = self._role_with_permissions(
            "Role Manager",
            "role_manager",
            (self.roles_view_permission, self.roles_manage_permission),
        )
        self.system_admin_role = self._role_with_permissions(
            "System Administrator",
            "system_admin",
            (self.roles_view_permission, self.roles_manage_permission),
            is_system_role=True,
        )

        self.viewer = self._user("viewer@example.com", self.viewer_role)
        self.tenant_manager = self._user(
            "tenant-manager@example.com", self.manager_role, tenant=self.tenant
        )
        self.system_admin = self._user(
            "system-admin@example.com", self.system_admin_role
        )
        self.superuser = User.objects.create_superuser(
            email="permission-superuser@example.com", password="Password123!"
        )

        self.custom_role = Role.objects.create(name="Custom", code="custom")
        self.inactive_custom_role = Role.objects.create(
            name="Inactive Custom",
            code="inactive_custom",
            is_active=False,
        )
        self.system_role = Role.objects.create(
            name="System",
            code="system_role",
            is_system_role=True,
        )

        self.active_assignment = RolePermission.objects.create(
            role=self.custom_role,
            permission=self.users_view_permission,
            is_active=True,
        )
        self.secondary_active_assignment = RolePermission.objects.create(
            role=self.custom_role,
            permission=self.assets_view_permission,
            is_active=True,
        )
        self.inactive_assignment = RolePermission.objects.create(
            role=self.custom_role,
            permission=self.users_update_permission,
            is_active=False,
        )

        self.inactive_permission_assignment = RolePermission.objects.create(
            role=self.custom_role,
            permission=self.inactive_permission,
            is_active=True,
        )

    def _role_with_permissions(self, name, code, permissions, is_system_role=False):
        role = Role.objects.create(name=name, code=code, is_system_role=is_system_role)
        for permission in permissions:
            RolePermission.objects.create(role=role, permission=permission)
        return role

    def _user(self, email, role, tenant=None, is_active=True):
        user = User.objects.create_user(
            email=email,
            password="Password123!",
            tenant=tenant,
            is_active=is_active,
        )
        UserRole.objects.create(user=user, role=role)
        return user

    def _url(self, role=None):
        return reverse(
            "rbac-role-permissions", args=((role or self.custom_role).id,)
        )

    def _authenticate(self, user):
        self.client.force_authenticate(user)

    def test_unauthenticated_get_and_put_are_rejected(self):
        self.assertEqual(
            self.client.get(self._url()).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            self.client.put(
                self._url(),
                {"permission_ids": [str(self.users_view_permission.id)]},
                format="json",
            ).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_actor_without_roles_view_cannot_get_assignments(self):
        no_permission = User.objects.create_user(
            email="no-view@example.com", password="Password123!"
        )
        self._authenticate(no_permission)

        self.assertEqual(
            self.client.get(self._url()).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_roles_view_actor_can_get_custom_system_and_inactive_roles(self):
        self._authenticate(self.viewer)

        custom_response = self.client.get(self._url(self.custom_role))
        system_response = self.client.get(self._url(self.system_role))
        inactive_response = self.client.get(self._url(self.inactive_custom_role))

        self.assertEqual(custom_response.status_code, status.HTTP_200_OK)
        self.assertEqual(system_response.status_code, status.HTTP_200_OK)
        self.assertEqual(inactive_response.status_code, status.HTTP_200_OK)
        self.assertEqual(custom_response.data["role"]["id"], str(self.custom_role.id))

    def test_get_returns_active_assignments_only_sorted_by_module_action_and_name(self):
        self._authenticate(self.viewer)

        response = self.client.get(self._url(self.custom_role))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["role"]["code"], self.custom_role.code)
        self.assertEqual(
            [item["code"] for item in response.data["assigned_permissions"]],
            ["assets.view", "users.view"],
        )

    def test_actor_with_roles_view_but_without_roles_manage_cannot_put(self):
        self._authenticate(self.viewer)

        response = self.client.put(
            self._url(),
            {"permission_ids": [str(self.users_view_permission.id)]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_tenant_bound_roles_manage_actor_cannot_put(self):
        self._authenticate(self.tenant_manager)

        response = self.client.put(
            self._url(),
            {"permission_ids": [str(self.users_view_permission.id)]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superuser_and_active_system_admin_can_replace_permissions(self):
        for actor in (self.superuser, self.system_admin):
            self._authenticate(actor)
            response = self.client.put(
                self._url(),
                {
                    "permission_ids": [
                        str(self.users_update_permission.id),
                        str(self.assets_view_permission.id),
                    ]
                },
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(
                [item["code"] for item in response.data["assigned_permissions"]],
                ["assets.view", "users.update"],
            )

    def test_inactive_actor_cannot_replace_permissions(self):
        self.system_admin.is_active = False
        self.system_admin.save(update_fields=("is_active",))
        self._authenticate(self.system_admin)

        response = self.client.put(
            self._url(),
            {"permission_ids": [str(self.users_view_permission.id)]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_put_rejects_system_role_and_inactive_custom_role(self):
        self._authenticate(self.superuser)

        system_response = self.client.put(
            self._url(self.system_role),
            {"permission_ids": [str(self.users_view_permission.id)]},
            format="json",
        )
        inactive_response = self.client.put(
            self._url(self.inactive_custom_role),
            {"permission_ids": [str(self.users_view_permission.id)]},
            format="json",
        )

        self.assertEqual(system_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(inactive_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_put_rejects_unknown_inactive_duplicate_and_malformed_permission_ids(self):
        self._authenticate(self.superuser)

        unknown_response = self.client.put(
            self._url(),
            {"permission_ids": ["f09b84a0-97e7-4a8d-ac43-f2b5ea9eaf9c"]},
            format="json",
        )
        inactive_response = self.client.put(
            self._url(),
            {"permission_ids": [str(self.inactive_permission.id)]},
            format="json",
        )
        duplicate_response = self.client.put(
            self._url(),
            {
                "permission_ids": [
                    str(self.users_view_permission.id),
                    str(self.users_view_permission.id),
                ]
            },
            format="json",
        )
        malformed_response = self.client.put(
            self._url(),
            {"permission_ids": ["not-a-uuid"]},
            format="json",
        )

        self.assertEqual(unknown_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(inactive_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(malformed_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_empty_permission_ids_deactivates_all_active_assignments(self):
        self._authenticate(self.superuser)

        response = self.client.put(
            self._url(),
            {"permission_ids": []},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["assigned_permissions"], [])
        self.assertFalse(
            RolePermission.objects.filter(
                role=self.custom_role,
                permission=self.users_view_permission,
                is_active=True,
            ).exists()
        )
        self.assertEqual(
            RolePermission.objects.filter(role=self.custom_role).count(),
            4,
        )

    def test_replacement_reactivates_creates_deactivates_and_preserves_rows(self):
        self._authenticate(self.superuser)
        before_count = RolePermission.objects.filter(role=self.custom_role).count()

        response = self.client.put(
            self._url(),
            {
                "permission_ids": [
                    str(self.users_update_permission.id),
                    str(self.roles_view_permission.id),
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.inactive_assignment.refresh_from_db()
        self.active_assignment.refresh_from_db()
        self.secondary_active_assignment.refresh_from_db()
        self.assertTrue(self.inactive_assignment.is_active)
        self.assertFalse(self.active_assignment.is_active)
        self.assertFalse(self.secondary_active_assignment.is_active)
        self.assertTrue(
            RolePermission.objects.filter(
                role=self.custom_role,
                permission=self.roles_view_permission,
                is_active=True,
            ).exists()
        )
        self.assertEqual(
            RolePermission.objects.filter(role=self.custom_role).count(),
            before_count + 1,
        )

    def test_unchanged_assignment_remains_active_without_duplication(self):
        self._authenticate(self.superuser)
        before_count = RolePermission.objects.filter(role=self.custom_role).count()

        response = self.client.put(
            self._url(),
            {
                "permission_ids": [
                    str(self.users_view_permission.id),
                    str(self.assets_view_permission.id),
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            RolePermission.objects.filter(
                role=self.custom_role,
                permission=self.users_view_permission,
            ).count(),
            1,
        )
        self.assertEqual(
            RolePermission.objects.filter(role=self.custom_role).count(),
            before_count,
        )

    def test_invalid_replacement_is_atomic(self):
        self._authenticate(self.superuser)
        before_active_ids = set(
            RolePermission.objects.filter(role=self.custom_role, is_active=True)
            .values_list("permission_id", flat=True)
        )

        response = self.client.put(
            self._url(),
            {
                "permission_ids": [
                    str(self.users_update_permission.id),
                    "f09b84a0-97e7-4a8d-ac43-f2b5ea9eaf9c",
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        after_active_ids = set(
            RolePermission.objects.filter(role=self.custom_role, is_active=True)
            .values_list("permission_id", flat=True)
        )
        self.assertEqual(before_active_ids, after_active_ids)

    def test_service_rejects_tenant_bound_non_global_actor(self):
        with self.assertRaises(PermissionDenied):
            replace_role_permissions(
                actor=self.tenant_manager,
                role=self.custom_role,
                permission_ids=[self.users_view_permission.id],
            )

    def test_effective_permissions_gain_and_lose_after_replacement(self):
        assigned_user = User.objects.create_user(
            email="assigned-user@example.com",
            password="Password123!",
        )
        UserRole.objects.create(user=assigned_user, role=self.custom_role, is_active=True)

        self.assertIn("users.view", get_user_permission_codes(assigned_user))
        self.assertNotIn("roles.view", get_user_permission_codes(assigned_user))

        replace_role_permissions(
            actor=self.superuser,
            role=self.custom_role,
            permission_ids=[self.roles_view_permission.id],
        )

        updated_codes = get_user_permission_codes(assigned_user)
        self.assertIn("roles.view", updated_codes)
        self.assertNotIn("users.view", updated_codes)

    def test_permission_from_another_active_role_remains_effective(self):
        secondary_role = Role.objects.create(name="Secondary", code="secondary")
        RolePermission.objects.create(
            role=secondary_role,
            permission=self.users_view_permission,
            is_active=True,
        )
        assigned_user = User.objects.create_user(
            email="multi-role@example.com",
            password="Password123!",
        )
        UserRole.objects.create(user=assigned_user, role=self.custom_role, is_active=True)
        UserRole.objects.create(user=assigned_user, role=secondary_role, is_active=True)

        replace_role_permissions(
            actor=self.superuser,
            role=self.custom_role,
            permission_ids=[],
        )

        self.assertIn("users.view", get_user_permission_codes(assigned_user))


class SeedRbacCommandTests(APITestCase):
    def test_seed_rbac_command_is_idempotent(self):
        call_command("seed_rbac")
        call_command("seed_rbac")

        self.assertEqual(Role.objects.count(), len(ROLE_DEFINITIONS))
        self.assertEqual(Permission.objects.count(), len(PERMISSION_DEFINITIONS))
        self.assertEqual(
            RolePermission.objects.filter(role__code="system_admin").count(),
            len(ROLE_PERMISSION_CODES["system_admin"]),
        )

    def test_assignment_and_administration_roles_receive_user_directory(self):
        call_command("seed_rbac")

        directory_roles = set(
            RolePermission.objects.filter(
                permission__code="users.directory",
                is_active=True,
            ).values_list("role__code", flat=True)
        )

        self.assertEqual(directory_roles, {"system_admin", "facility_manager"})
        self.assertIn("users.view", ROLE_PERMISSION_CODES["system_admin"])
        self.assertNotIn("users.view", ROLE_PERMISSION_CODES["facility_manager"])
