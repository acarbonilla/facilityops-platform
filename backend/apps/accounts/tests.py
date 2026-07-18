from queue import Queue
from threading import Event, Thread

from django.contrib.auth import get_user_model
from django.db import close_old_connections, transaction
from django.test import TransactionTestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.access_control.models import (
    Permission,
    Role,
    RolePermission,
    UserRole,
)
from apps.master_data.models import Organization, Tenant

from .services import (
    create_user,
    deactivate_user,
    has_global_user_scope,
    replace_user_role_assignments,
    update_user,
)


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
            "users.directory",
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

    def test_authentication_and_action_permission_boundaries(self):
        list_url = reverse("user-list")
        detail_url = reverse("user-detail", args=(self.same_tenant_user.id,))
        directory_url = reverse("user-directory")
        unauthenticated_requests = (
            self.client.get(list_url),
            self.client.post(list_url, {}, format="json"),
            self.client.get(detail_url),
            self.client.put(detail_url, {}, format="json"),
            self.client.patch(detail_url, {}, format="json"),
            self.client.delete(detail_url),
            self.client.get(directory_url),
        )
        for response in unauthenticated_requests:
            self.assertEqual(
                response.status_code,
                status.HTTP_401_UNAUTHORIZED,
            )

        actors = {}
        for permission_code in (
            "users.view",
            "users.directory",
            "users.create",
            "users.update",
            "users.delete",
        ):
            action = permission_code.split(".")[1]
            actor = User.objects.create_user(
                email=f"{action}-only@example.com",
                password=self.password,
                tenant=self.tenant,
                organization=self.organization,
            )
            self._assign_permissions(actor, permission_code)
            actors[action] = actor

        self._authenticate(actors["view"])
        self.assertEqual(
            self.client.get(list_url).status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.get(detail_url).status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.get(directory_url).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.post(list_url, {}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.patch(
                detail_url,
                {"password": "N3w-Password!Safe"},
                format="json",
            ).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.delete(detail_url).status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self._authenticate(actors["directory"])
        self.assertEqual(
            self.client.get(directory_url).status_code,
            status.HTTP_200_OK,
        )
        self.assertEqual(
            self.client.get(list_url).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.get(detail_url).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.post(list_url, {}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.patch(detail_url, {}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.delete(detail_url).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.get(
                reverse("user-roles", args=(self.same_tenant_user.id,))
            ).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.put(
                reverse("user-roles", args=(self.same_tenant_user.id,)),
                {"role_ids": []},
                format="json",
            ).status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self._authenticate(actors["create"])
        self.assertEqual(
            self.client.patch(detail_url, {}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.delete(detail_url).status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self._authenticate(actors["update"])
        self.assertEqual(
            self.client.delete(detail_url).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.patch(
                detail_url,
                {"is_active": False},
                format="json",
            ).status_code,
            status.HTTP_200_OK,
        )
        self.same_tenant_user.is_active = True
        self.same_tenant_user.save(update_fields=("is_active",))

        self._authenticate(actors["delete"])
        self.assertEqual(
            self.client.patch(detail_url, {}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        deletable = User.objects.create_user(
            email="delete-permission-target@example.com",
            password=self.password,
            tenant=self.tenant,
            organization=self.organization,
        )
        self.assertEqual(
            self.client.delete(
                reverse("user-detail", args=(deletable.id,))
            ).status_code,
            status.HTTP_204_NO_CONTENT,
        )

    def test_authorized_user_lists_only_same_tenant_users(self):
        self._authenticate()

        response = self.client.get(reverse("user-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in self._results(response)}
        self.assertIn(str(self.same_tenant_user.id), ids)
        self.assertNotIn(str(self.cross_tenant_user.id), ids)
        forbidden_fields = {
            "password",
            "groups",
            "user_permissions",
            "last_login",
            "is_superuser",
        }
        self.assertTrue(
            forbidden_fields.isdisjoint(self._results(response)[0])
        )
        detail_response = self.client.get(
            reverse("user-detail", args=(self.same_tenant_user.id,))
        )
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertTrue(forbidden_fields.isdisjoint(detail_response.data))

    def test_assignment_permissions_do_not_bypass_directory_permission(self):
        for permission_code in ("maintenance.assign", "inspection.assign"):
            actor = User.objects.create_user(
                email=f"{permission_code.replace('.', '-')}@example.com",
                password=self.password,
                tenant=self.tenant,
                organization=self.organization,
            )
            self._assign_permissions(actor, permission_code)
            self._authenticate(actor)

            response = self.client.get(reverse("user-directory"))

            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

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
        self._assign_permissions(
            tenantless,
            "users.view",
            "users.directory",
            "users.create",
        )
        self._authenticate(tenantless)

        response = self.client.get(reverse("user-list"))
        directory_response = self.client.get(reverse("user-directory"))
        create_response = self.client.post(
            reverse("user-list"),
            {
                "email": "tenantless-created@example.com",
                "password": "T3nantless!Safe-Password",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._results(response), [])
        self.assertEqual(directory_response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._results(directory_response), [])
        self.assertEqual(
            create_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertFalse(
            User.objects.filter(
                email="tenantless-created@example.com"
            ).exists()
        )

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
        for permission_code in (
            "users.view",
            "users.create",
            "users.update",
            "users.delete",
        ):
            RolePermission.objects.create(
                role=role,
                permission=self._permission(permission_code),
            )
        self._authenticate(system_admin)

        response = self.client.get(reverse("user-list"))

        ids = {item["id"] for item in self._results(response)}
        self.assertIn(str(self.same_tenant_user.id), ids)
        self.assertIn(str(self.cross_tenant_user.id), ids)
        update_response = self.client.patch(
            reverse("user-detail", args=(self.cross_tenant_user.id,)),
            {"first_name": "Globally managed", "is_staff": True},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.cross_tenant_user.refresh_from_db()
        self.assertTrue(self.cross_tenant_user.is_staff)

        create_response = self.client.post(
            reverse("user-list"),
            {
                "email": "global-created@example.com",
                "tenant": str(self.other_tenant.id),
                "organization": str(self.other_organization.id),
                "password": "Gl0bal-Created!Safe",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("password", create_response.data)
        self.assertEqual(
            self.client.delete(
                reverse("user-detail", args=(create_response.data["id"],))
            ).status_code,
            status.HTTP_204_NO_CONTENT,
        )

        system_admin.is_active = False
        system_admin.save(update_fields=("is_active",))
        self.assertFalse(has_global_user_scope(system_admin))
        self._authenticate(system_admin)
        self.assertEqual(
            self.client.get(reverse("user-list")).status_code,
            status.HTTP_403_FORBIDDEN,
        )

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
        duplicate_response = self.client.post(
            reverse("user-list"),
            payload,
            format="json",
        )
        self.assertEqual(
            duplicate_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        for invalid_password in ("", None, "short"):
            invalid_response = self.client.post(
                reverse("user-list"),
                {
                    "email": f"invalid-{invalid_password}@example.com",
                    "password": invalid_password,
                },
                format="json",
            )
            self.assertEqual(
                invalid_response.status_code,
                status.HTTP_400_BAD_REQUEST,
            )
            self.assertIn("password", invalid_response.data)

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
        with self.assertRaises(ValidationError):
            update_user(
                actor=self.admin,
                user=self.same_tenant_user,
                validated_data={"email": self.admin.email},
            )

    def test_user_writes_require_valid_master_data_hierarchy(self):
        self.organization.is_active = False
        self.organization.save(update_fields=("is_active", "updated_at"))
        self.same_tenant_user.is_active = False
        self.same_tenant_user.save(update_fields=("is_active", "updated_at"))
        self._authenticate()

        create_response = self.client.post(
            reverse("user-list"),
            {
                "email": "inactive-parent@example.com",
                "tenant": str(self.tenant.id),
                "organization": str(self.organization.id),
                "password": self.password,
                "is_active": True,
            },
            format="json",
        )
        reactivate_response = self.client.patch(
            reverse("user-detail", args=(self.same_tenant_user.id,)),
            {"is_active": True},
            format="json",
        )

        self.assertEqual(
            create_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("organization", create_response.data)
        self.assertEqual(
            reactivate_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("organization", reactivate_response.data)
        self.assertFalse(
            User.objects.filter(email="inactive-parent@example.com").exists()
        )

        self.organization.is_active = True
        self.organization.is_deleted = True
        self.organization.save(
            update_fields=("is_active", "is_deleted", "updated_at")
        )
        deleted_response = self.client.post(
            reverse("user-list"),
            {
                "email": "deleted-parent@example.com",
                "tenant": str(self.tenant.id),
                "organization": str(self.organization.id),
                "password": self.password,
                "is_active": False,
            },
            format="json",
        )
        self.assertEqual(
            deleted_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("organization", deleted_response.data)

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


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",)
)
class UserMasterDataLifecycleConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.tenant = Tenant.objects.create(name="Tenant", code="tenant-race")
        self.organization = Organization.objects.create(
            tenant=self.tenant,
            name="Organization",
            code="organization-race",
        )
        self.actor = User.objects.create_superuser(
            email="lifecycle-admin@example.com",
            password="Password123!",
        )

    def test_concurrent_user_create_cannot_outlive_parent_deactivation(self):
        ready = Event()
        outcomes = Queue()

        def create_active_user():
            close_old_connections()
            ready.set()
            try:
                create_user(
                    actor=User.objects.get(pk=self.actor.pk),
                    validated_data={
                        "email": "racing-user@example.com",
                        "password": "Password123!",
                        "tenant": Tenant.objects.get(pk=self.tenant.pk),
                        "organization": Organization.objects.get(
                            pk=self.organization.pk
                        ),
                        "is_active": True,
                    },
                )
            except Exception as exc:
                outcomes.put(exc)
            else:
                outcomes.put(None)
            finally:
                close_old_connections()

        with transaction.atomic():
            locked = Organization.objects.select_for_update().get(
                pk=self.organization.pk
            )
            worker = Thread(target=create_active_user)
            worker.start()
            self.assertTrue(ready.wait(timeout=5))
            locked.is_active = False
            locked.save(update_fields=("is_active", "updated_at"))

        worker.join(timeout=10)
        self.assertFalse(worker.is_alive())
        self.assertIsInstance(outcomes.get_nowait(), ValidationError)
        self.assertFalse(
            User.objects.filter(email="racing-user@example.com").exists()
        )
        self.organization.refresh_from_db()
        self.assertFalse(self.organization.is_active)


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",)
)
class UserRoleAssignmentWorkflowTests(APITestCase):
    password = "Password123!"

    def setUp(self):
        self.tenant = Tenant.objects.create(name="Tenant", code="tenant-roles")
        self.organization = Organization.objects.create(
            tenant=self.tenant,
            name="Organization",
            code="organization-roles",
        )
        self.other_tenant = Tenant.objects.create(name="Other", code="other-roles")
        self.other_organization = Organization.objects.create(
            tenant=self.other_tenant,
            name="Other Organization",
            code="other-organization-roles",
        )
        self.role_viewer = self._create_role(
            "Role Viewer",
            "role_viewer",
            permissions=("users.view", "roles.view"),
        )
        self.role_manager = self._create_role(
            "Role Manager",
            "role_manager",
            permissions=("roles.manage",),
        )
        self.inspector_role = self._create_role(
            "Inspector",
            "inspector",
            permissions=("inspection.view",),
        )
        self.operator_role = self._create_role(
            "Operator",
            "operator",
            permissions=("maintenance.view",),
        )
        self.inactive_role = self._create_role(
            "Inactive",
            "inactive_role",
            permissions=("users.view",),
            is_active=False,
        )
        self.system_admin_role = self._create_role(
            "System Administrator",
            "system_admin",
            permissions=(
                "users.view",
                "users.directory",
                "users.create",
                "users.update",
                "users.delete",
                "roles.view",
                "roles.manage",
            ),
            is_system_role=True,
        )

        self.reader = User.objects.create_user(
            email="reader@example.com",
            password=self.password,
            tenant=self.tenant,
            organization=self.organization,
        )
        self.manager = User.objects.create_user(
            email="manager@example.com",
            password=self.password,
            tenant=self.tenant,
            organization=self.organization,
        )
        self.target = User.objects.create_user(
            email="target@example.com",
            password=self.password,
            tenant=self.tenant,
            organization=self.organization,
        )
        self.cross_tenant_target = User.objects.create_user(
            email="cross-target@example.com",
            password=self.password,
            tenant=self.other_tenant,
            organization=self.other_organization,
        )
        self.global_admin = User.objects.create_user(
            email="global-admin@example.com",
            password=self.password,
        )
        self.tenantless_manager = User.objects.create_user(
            email="tenantless-manager@example.com",
            password=self.password,
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

        self.user_admin_role = self._create_role(
            "User Admin",
            "user_admin",
            permissions=(
                "users.view",
                "users.directory",
                "users.create",
                "users.update",
                "users.delete",
            ),
        )

        UserRole.objects.create(user=self.reader, role=self.role_viewer)
        UserRole.objects.create(user=self.manager, role=self.role_viewer)
        UserRole.objects.create(user=self.manager, role=self.role_manager)
        UserRole.objects.create(user=self.global_admin, role=self.system_admin_role)
        UserRole.objects.create(user=self.tenantless_manager, role=self.role_manager)
        UserRole.objects.create(user=self.admin, role=self.user_admin_role)
        UserRole.objects.create(user=self.target, role=self.operator_role)
        UserRole.objects.create(
            user=self.target,
            role=self.system_admin_role,
            is_active=True,
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

    def _create_role(
        self,
        name,
        code,
        *,
        permissions=(),
        is_active=True,
        is_system_role=False,
    ):
        role = Role.objects.create(
            name=name,
            code=code,
            is_active=is_active,
            is_system_role=is_system_role,
        )
        for permission_code in permissions:
            RolePermission.objects.create(
                role=role,
                permission=self._permission(permission_code),
            )
        return role

    def _authenticate(self, user=None):
        self.client.force_authenticate(user=user or self.admin)

    def _results(self, response):
        return response.data["results"]

    def _roles_url(self, user):
        return reverse("user-roles", args=(user.id,))

    def test_unauthenticated_role_assignment_requests_return_401(self):
        response = self.client.get(self._roles_url(self.target))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.put(
            self._roles_url(self.target),
            {"role_ids": [str(self.operator_role.id)]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_without_roles_view_cannot_read_assignments(self):
        actor = User.objects.create_user(
            email="users-view-only@example.com",
            password=self.password,
            tenant=self.tenant,
            organization=self.organization,
        )
        viewer_role = self._create_role(
            "Users Viewer",
            "users_viewer",
            permissions=("users.view",),
        )
        UserRole.objects.create(user=actor, role=viewer_role)
        self._authenticate(actor)

        response = self.client.get(self._roles_url(self.target))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_without_roles_manage_cannot_replace_assignments(self):
        self._authenticate(self.reader)

        response = self.client.put(
            self._roles_url(self.target),
            {"role_ids": [str(self.operator_role.id)]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_roles_manage_only_actor_can_replace_but_cannot_get_assignments(self):
        actor = User.objects.create_user(
            email="roles-manage-only@example.com",
            password=self.password,
            tenant=self.tenant,
            organization=self.organization,
        )
        manage_only_role = self._create_role(
            "Roles Manage Only",
            "roles_manage_only",
            permissions=("roles.manage",),
        )
        UserRole.objects.create(user=actor, role=manage_only_role)
        self._authenticate(actor)

        response = self.client.put(
            self._roles_url(self.target),
            {"role_ids": [str(self.inspector_role.id)]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("user", response.data)
        self.assertIn("assigned_roles", response.data)
        self.assertIn("available_roles", response.data)
        self.assertEqual(
            [role["code"] for role in response.data["assigned_roles"]],
            ["inspector"],
        )
        self.assertTrue(
            UserRole.objects.filter(
                user=self.target,
                role=self.inspector_role,
                is_active=True,
            ).exists()
        )
        self.assertFalse(
            UserRole.objects.filter(
                user=self.target,
                role=self.operator_role,
                is_active=True,
            ).exists()
        )

        get_response = self.client.get(self._roles_url(self.target))
        self.assertEqual(get_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_roles_manage_only_actor_invalid_put_is_atomic(self):
        actor = User.objects.create_user(
            email="roles-manage-atomic@example.com",
            password=self.password,
            tenant=self.tenant,
            organization=self.organization,
        )
        manage_only_role = self._create_role(
            "Roles Manage Only Atomic",
            "roles_manage_only_atomic",
            permissions=("roles.manage",),
        )
        UserRole.objects.create(user=actor, role=manage_only_role)
        existing_assignment = UserRole.objects.get(
            user=self.target,
            role=self.operator_role,
        )
        self._authenticate(actor)

        response = self.client.put(
            self._roles_url(self.target),
            {
                "role_ids": [
                    str(self.inspector_role.id),
                    str(self.inactive_role.id),
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role_ids", response.data)
        existing_assignment.refresh_from_db()
        self.assertTrue(existing_assignment.is_active)
        self.assertFalse(
            UserRole.objects.filter(
                user=self.target,
                role=self.inspector_role,
                is_active=True,
            ).exists()
        )

    def test_same_tenant_authorized_actor_can_view_assignments(self):
        self._authenticate(self.reader)

        response = self.client.get(self._roles_url(self.target))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["id"], str(self.target.id))
        self.assertEqual(
            [role["code"] for role in response.data["assigned_roles"]],
            ["operator"],
        )
        self.assertEqual(response.data["available_roles"], [])

    def test_cross_tenant_target_returns_404_for_get_and_put(self):
        self._authenticate(self.manager)

        get_response = self.client.get(self._roles_url(self.cross_tenant_target))
        put_response = self.client.put(
            self._roles_url(self.cross_tenant_target),
            {"role_ids": [str(self.operator_role.id)]},
            format="json",
        )

        self.assertEqual(get_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(put_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_tenantless_regular_actor_cannot_manage_role_assignments(self):
        self._authenticate(self.tenantless_manager)

        response = self.client.put(
            self._roles_url(self.target),
            {"role_ids": [str(self.operator_role.id)]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_unknown_inactive_and_duplicate_role_ids_return_400(self):
        self._authenticate(self.manager)

        unknown_response = self.client.put(
            self._roles_url(self.target),
            {"role_ids": ["63aa22a4-1980-40d0-92ff-97d684264b2f"]},
            format="json",
        )
        inactive_response = self.client.put(
            self._roles_url(self.target),
            {"role_ids": [str(self.inactive_role.id)]},
            format="json",
        )
        duplicate_response = self.client.put(
            self._roles_url(self.target),
            {
                "role_ids": [
                    str(self.operator_role.id),
                    str(self.operator_role.id),
                ]
            },
            format="json",
        )

        self.assertEqual(unknown_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role_ids", unknown_response.data)
        self.assertEqual(inactive_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role_ids", inactive_response.data)
        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role_ids", duplicate_response.data)

    def test_assignment_replacement_reactivates_and_deactivates_without_duplicates(self):
        inactive_assignment = UserRole.objects.create(
            user=self.target,
            role=self.inspector_role,
            is_active=False,
        )
        unchanged_assignment = UserRole.objects.get(
            user=self.target,
            role=self.operator_role,
        )
        self._authenticate(self.manager)

        response = self.client.put(
            self._roles_url(self.target),
            {
                "role_ids": [
                    str(self.operator_role.id),
                    str(self.inspector_role.id),
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        inactive_assignment.refresh_from_db()
        unchanged_assignment.refresh_from_db()
        self.assertTrue(inactive_assignment.is_active)
        self.assertTrue(unchanged_assignment.is_active)
        self.assertEqual(
            UserRole.objects.filter(user=self.target, role=self.inspector_role).count(),
            1,
        )

        response = self.client.put(
            self._roles_url(self.target),
            {"role_ids": [str(self.inspector_role.id)]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        unchanged_assignment.refresh_from_db()
        self.assertFalse(unchanged_assignment.is_active)

    def test_replacement_is_atomic_when_one_submitted_role_is_invalid(self):
        existing_assignment = UserRole.objects.get(
            user=self.target,
            role=self.operator_role,
        )
        self._authenticate(self.manager)

        response = self.client.put(
            self._roles_url(self.target),
            {
                "role_ids": [
                    str(self.inspector_role.id),
                    str(self.inactive_role.id),
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        existing_assignment.refresh_from_db()
        self.assertTrue(existing_assignment.is_active)
        self.assertFalse(
            UserRole.objects.filter(user=self.target, role=self.inspector_role).exists()
        )

    def test_tenant_administrator_cannot_see_or_assign_system_roles(self):
        self._authenticate(self.manager)

        response = self.client.get(self._roles_url(self.target))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [role["code"] for role in response.data["assigned_roles"]],
            ["operator"],
        )
        self.assertNotIn(
            "system_admin",
            [role["code"] for role in response.data["available_roles"]],
        )

        put_response = self.client.put(
            self._roles_url(self.target),
            {"role_ids": [str(self.system_admin_role.id)]},
            format="json",
        )
        self.assertEqual(put_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_global_administrator_can_assign_active_system_role(self):
        self._authenticate(self.global_admin)

        response = self.client.put(
            self._roles_url(self.target),
            {
                "role_ids": [
                    str(self.operator_role.id),
                    str(self.system_admin_role.id),
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [role["code"] for role in response.data["assigned_roles"]],
            ["operator", "system_admin"],
        )

    def test_cannot_remove_own_final_active_system_admin_role(self):
        self._authenticate(self.global_admin)

        response = self.client.put(
            self._roles_url(self.global_admin),
            {"role_ids": []},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role_ids", response.data)

    def test_direct_service_layer_cross_tenant_assignment_is_rejected(self):
        with self.assertRaises(ValidationError):
            replace_user_role_assignments(
                actor=self.manager,
                user=self.cross_tenant_target,
                role_ids=[self.inspector_role.id],
            )

    def test_current_user_permissions_reflect_changed_active_role_assignments(self):
        self._authenticate(self.manager)

        response = self.client.put(
            self._roles_url(self.manager),
            {
                "role_ids": [
                    str(self.role_viewer.id),
                    str(self.role_manager.id),
                    str(self.inspector_role.id),
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        permissions_response = self.client.get(reverse("rbac-me-permissions"))
        self.assertEqual(permissions_response.status_code, status.HTTP_200_OK)
        self.assertIn("inspector", permissions_response.data["roles"])
        self.assertIn("inspection.view", permissions_response.data["permissions"])

    def test_cross_tenant_update_is_hidden(self):
        self._authenticate()

        response = self.client.patch(
            reverse("user-detail", args=(self.cross_tenant_user.id,)),
            {"first_name": "Hidden"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        delete_response = self.client.delete(
            reverse("user-detail", args=(self.cross_tenant_user.id,))
        )
        self.assertEqual(
            delete_response.status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.cross_tenant_user.refresh_from_db()
        self.assertEqual(self.cross_tenant_user.first_name, "")
        self.assertTrue(self.cross_tenant_user.is_active)
        with self.assertRaises(ValidationError):
            update_user(
                actor=self.admin,
                user=self.cross_tenant_user,
                validated_data={"tenant": self.tenant},
            )
        with self.assertRaises(ValidationError):
            deactivate_user(actor=self.admin, user=self.cross_tenant_user)
        self.cross_tenant_user.refresh_from_db()
        self.assertEqual(self.cross_tenant_user.tenant, self.other_tenant)
        self.assertTrue(self.cross_tenant_user.is_active)

    def test_regular_admin_cannot_change_staff_status(self):
        self._authenticate()

        response = self.client.patch(
            reverse("user-detail", args=(self.same_tenant_user.id,)),
            {"is_staff": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        move_response = self.client.patch(
            reverse("user-detail", args=(self.same_tenant_user.id,)),
            {
                "tenant": str(self.other_tenant.id),
                "organization": str(self.other_organization.id),
            },
            format="json",
        )
        self.assertEqual(
            move_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.same_tenant_user.refresh_from_db()
        self.assertFalse(self.same_tenant_user.is_staff)
        self.assertEqual(self.same_tenant_user.tenant, self.tenant)

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
        self.assertTrue(all("password" not in item for item in results))
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
        filtered_response = self.client.get(
            reverse("user-directory"),
            {
                "search": "Same",
                "organization": str(self.organization.id),
                "is_active": "true",
                "ordering": "id",
            },
        )
        self.assertEqual(filtered_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(self._results(filtered_response)), 1)
        self.assertEqual(
            self._results(filtered_response)[0]["id"],
            str(self.same_tenant_user.id),
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
