from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Permission, Role, RolePermission, UserRole
from .management.commands.seed_rbac import (
    PERMISSION_DEFINITIONS,
    ROLE_DEFINITIONS,
    ROLE_PERMISSION_CODES,
)
from .services import (
    get_user_permission_codes,
    get_user_roles,
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
