from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import (
    Permission,
    Role,
    RolePermission,
    UserRole,
)
from apps.master_data.models import Organization, Tenant


User = get_user_model()


class UserModelTests(APITestCase):
    def test_user_creation_with_email(self):
        user = User.objects.create_user(
            email="ADMIN@example.com",
            password="Password123!",
            first_name="Admin",
            last_name="User",
        )

        self.assertEqual(user.email, "ADMIN@example.com")
        self.assertTrue(user.check_password("Password123!"))
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_superuser_creation(self):
        user = User.objects.create_superuser(
            email="superuser@example.com",
            password="Password123!",
        )

        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_active)


class AuthenticationEndpointTests(APITestCase):
    def setUp(self):
        self.password = "Password123!"
        self.user = User.objects.create_user(
            email="admin@example.com",
            password=self.password,
            first_name="Admin",
            last_name="User",
        )

    def test_login_success(self):
        response = self.client.post(
            reverse("auth-login"),
            {"email": self.user.email, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], self.user.email)

    def test_login_failure_with_invalid_credentials(self):
        response = self.client.post(
            reverse("auth-login"),
            {"email": self.user.email, "password": "wrong-password"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            response.data["non_field_errors"][0],
            "Invalid email or password.",
        )

    def test_refresh_token_endpoint(self):
        login_response = self.client.post(
            reverse("auth-login"),
            {"email": self.user.email, "password": self.password},
            format="json",
        )

        response = self.client.post(
            reverse("auth-refresh"),
            {"refresh": login_response.data["refresh"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_current_user_requires_authentication(self):
        response = self.client.get(reverse("auth-me"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_current_user_returns_authenticated_user(self):
        login_response = self.client.post(
            reverse("auth-login"),
            {"email": self.user.email, "password": self.password},
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}"
        )

        response = self.client.get(reverse("auth-me"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], self.user.email)
        self.assertFalse(response.data["is_staff"])

    def test_logout_endpoint_returns_expected_response(self):
        login_response = self.client.post(
            reverse("auth-login"),
            {"email": self.user.email, "password": self.password},
            format="json",
        )

        response = self.client.post(
            reverse("auth-logout"),
            {"refresh": login_response.data["refresh"]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("discard", response.data["detail"])


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",)
)
class UserManagementEndpointTests(APITestCase):
    password = "Password123!"

    def setUp(self):
        self.tenant = Tenant.objects.create(name="Tenant", code="tenant")
        self.organization = Organization.objects.create(
            tenant=self.tenant,
            name="Organization",
            code="organization",
        )
        self.other_tenant = Tenant.objects.create(name="Other", code="other")
        self.other_organization = Organization.objects.create(
            tenant=self.other_tenant,
            name="Other Organization",
            code="other-organization",
        )
        self.admin = User.objects.create_user(
            email="admin@example.com",
            password=self.password,
            tenant=self.tenant,
            organization=self.organization,
        )
        self.same_tenant_user = User.objects.create_user(
            email="same@example.com",
            password=self.password,
            first_name="Same",
            tenant=self.tenant,
            organization=self.organization,
        )
        self.cross_tenant_user = User.objects.create_user(
            email="cross@example.com",
            password=self.password,
            tenant=self.other_tenant,
            organization=self.other_organization,
        )
        self._assign_permissions(
            self.admin,
            "users.view",
            "users.create",
            "users.update",
            "users.delete",
        )

    def _permission(self, code):
        module, action = code.split(".", 1)
        permission, _ = Permission.objects.get_or_create(
            code=code,
            defaults={
                "name": code,
                "module": module,
                "action": action,
            },
        )
        return permission

    def _assign_permissions(self, user, *codes):
        role = Role.objects.create(
            name=f"Role {user.email}",
            code=f"role-{user.pk}",
        )
        UserRole.objects.create(user=user, role=role)
        for code in codes:
            RolePermission.objects.create(
                role=role,
                permission=self._permission(code),
            )

    def _authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.admin)

    def _results(self, response):
        return response.data["results"]

    def test_unauthenticated_user_receives_401(self):
        response = self.client.get(reverse("user-list"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authorized_user_lists_only_same_tenant_users(self):
        self._authenticate()

        response = self.client.get(reverse("user-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in self._results(response)}
        self.assertIn(str(self.same_tenant_user.id), ids)
        self.assertNotIn(str(self.cross_tenant_user.id), ids)

    def test_cross_tenant_detail_returns_404(self):
        self._authenticate()

        response = self.client.get(
            reverse("user-detail", args=(self.cross_tenant_user.id,))
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_tenantless_regular_user_receives_empty_list(self):
        tenantless = User.objects.create_user(
            email="tenantless@example.com",
            password=self.password,
        )
        self._assign_permissions(tenantless, "users.view")
        self._authenticate(tenantless)

        response = self.client.get(reverse("user-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._results(response), [])

    def test_superuser_lists_users_across_tenants(self):
        superuser = User.objects.create_superuser(
            email="super@example.com",
            password=self.password,
        )
        self._authenticate(superuser)

        response = self.client.get(reverse("user-list"))

        ids = {item["id"] for item in self._results(response)}
        self.assertIn(str(self.same_tenant_user.id), ids)
        self.assertIn(str(self.cross_tenant_user.id), ids)

    def test_system_admin_role_lists_users_globally(self):
        system_admin = User.objects.create_user(
            email="system@example.com",
            password=self.password,
        )
        role = Role.objects.create(
            name="System Administrator",
            code="system_admin",
            is_system_role=True,
        )
        UserRole.objects.create(user=system_admin, role=role)
        RolePermission.objects.create(
            role=role,
            permission=self._permission("users.view"),
        )
        self._authenticate(system_admin)

        response = self.client.get(reverse("user-list"))

        ids = {item["id"] for item in self._results(response)}
        self.assertIn(str(self.same_tenant_user.id), ids)
        self.assertIn(str(self.cross_tenant_user.id), ids)

    def test_authorized_admin_creates_user_with_hashed_password(self):
        self._authenticate()
        payload = {
            "email": "created@example.com",
            "first_name": "Created",
            "tenant": str(self.tenant.id),
            "organization": str(self.organization.id),
            "password": "NewPassword123!",
            "is_active": True,
        }

        response = self.client.post(
            reverse("user-list"), payload, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = User.objects.get(email=payload["email"])
        self.assertTrue(created.check_password(payload["password"]))
        self.assertNotEqual(created.password, payload["password"])
        self.assertNotIn("password", response.data)

    def test_cross_tenant_creation_is_rejected(self):
        self._authenticate()

        response = self.client.post(
            reverse("user-list"),
            {
                "email": "rejected@example.com",
                "tenant": str(self.other_tenant.id),
                "organization": str(self.other_organization.id),
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            User.objects.filter(email="rejected@example.com").exists()
        )

    def test_organization_tenant_mismatch_is_rejected(self):
        self._authenticate()

        response = self.client.post(
            reverse("user-list"),
            {
                "email": "mismatch@example.com",
                "tenant": str(self.tenant.id),
                "organization": str(self.other_organization.id),
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("organization", response.data)

    def test_authorized_update_and_password_replacement_succeed(self):
        self._authenticate()

        response = self.client.patch(
            reverse("user-detail", args=(self.same_tenant_user.id,)),
            {"first_name": "Updated", "password": "UpdatedPassword123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.same_tenant_user.refresh_from_db()
        self.assertEqual(self.same_tenant_user.first_name, "Updated")
        self.assertTrue(
            self.same_tenant_user.check_password("UpdatedPassword123!")
        )
        self.assertNotIn("password", response.data)

    def test_cross_tenant_update_is_hidden(self):
        self._authenticate()

        response = self.client.patch(
            reverse("user-detail", args=(self.cross_tenant_user.id,)),
            {"first_name": "Hidden"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_regular_admin_cannot_change_staff_status(self):
        self._authenticate()

        response = self.client.patch(
            reverse("user-detail", args=(self.same_tenant_user.id,)),
            {"is_staff": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.same_tenant_user.refresh_from_db()
        self.assertFalse(self.same_tenant_user.is_staff)

    def test_delete_deactivates_without_removing_user(self):
        self._authenticate()

        response = self.client.delete(
            reverse("user-detail", args=(self.same_tenant_user.id,))
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(
            User.objects.filter(pk=self.same_tenant_user.pk).exists()
        )
        self.same_tenant_user.refresh_from_db()
        self.assertFalse(self.same_tenant_user.is_active)

    def test_self_deactivation_is_rejected_for_delete_and_patch(self):
        self._authenticate()

        delete_response = self.client.delete(
            reverse("user-detail", args=(self.admin.id,))
        )
        patch_response = self.client.patch(
            reverse("user-detail", args=(self.admin.id,)),
            {"is_active": False},
            format="json",
        )

        self.assertEqual(
            delete_response.status_code, status.HTTP_400_BAD_REQUEST
        )
        self.assertEqual(
            patch_response.status_code, status.HTTP_400_BAD_REQUEST
        )
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_directory_returns_only_active_same_tenant_safe_fields(self):
        inactive = User.objects.create_user(
            email="inactive@example.com",
            password=self.password,
            tenant=self.tenant,
            organization=self.organization,
            is_active=False,
        )
        self._authenticate()

        response = self.client.get(reverse("user-directory"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = self._results(response)
        ids = {item["id"] for item in results}
        self.assertIn(str(self.same_tenant_user.id), ids)
        self.assertNotIn(str(inactive.id), ids)
        self.assertNotIn(str(self.cross_tenant_user.id), ids)
        self.assertTrue(all(item["is_active"] for item in results))
        self.assertEqual(
            set(results[0]),
            {
                "id",
                "email",
                "first_name",
                "last_name",
                "display_name",
                "tenant",
                "organization",
                "is_active",
            },
        )

    def test_directory_display_name_uses_trimmed_full_name(self):
        self.same_tenant_user.first_name = "Same"
        self.same_tenant_user.last_name = "User"
        self.same_tenant_user.save(update_fields=("first_name", "last_name"))
        self._authenticate()

        response = self.client.get(reverse("user-directory"))

        result = next(
            item
            for item in self._results(response)
            if item["id"] == str(self.same_tenant_user.id)
        )
        self.assertEqual(result["display_name"], "Same User")

    def test_directory_display_name_falls_back_to_email(self):
        self.same_tenant_user.first_name = ""
        self.same_tenant_user.last_name = ""
        self.same_tenant_user.save(update_fields=("first_name", "last_name"))
        self._authenticate()

        response = self.client.get(reverse("user-directory"))

        result = next(
            item
            for item in self._results(response)
            if item["id"] == str(self.same_tenant_user.id)
        )
        self.assertEqual(result["display_name"], self.same_tenant_user.email)

    def test_list_supports_search_filtering_and_ordering(self):
        self._authenticate()

        response = self.client.get(
            reverse("user-list"),
            {"search": "Same", "is_active": "true", "ordering": "-email"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(self._results(response)), 1)
        self.assertEqual(
            self._results(response)[0]["email"], "same@example.com"
        )
