"""FO-113 readiness regression: RBAC matrix + My Work gate + architecture smoke."""

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.access_control.models import Role, RolePermission, UserRole
from apps.master_data.models import Organization, Tenant

User = get_user_model()

TECHNICIAN_PROJECT_PERMS = frozenset(
    {
        "projects.view",
        "projects.tasks.view",
        "projects.tasks.update",
        "projects.tasks.comment",
        "projects.notes.view",
        "projects.issues.view",
        "projects.issues.report",
        "projects.issues.comment",
        "projects.timeline.view",
        "projects.progress.view",
        "projects.links.view",
    }
)

TECHNICIAN_FORBIDDEN_PROJECT_PERMS = frozenset(
    {
        "projects.create",
        "projects.update",
        "projects.delete",
        "projects.manage",
        "projects.members.manage",
        "projects.tasks.create",
        "projects.tasks.delete",
        "projects.tasks.assign",
        "projects.tasks.manage",
        "projects.dependencies.manage",
        "projects.notes.manage",
        "projects.issues.manage",
        "projects.progress.recalculate",
        "projects.links.manage",
    }
)


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class ProjectManagementFO113ReadinessTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        call_command("seed_rbac")  # idempotency
        cls.tenant = Tenant.objects.create(name="FO113 Tenant", code="fo113-a")
        cls.org = Organization.objects.create(
            tenant=cls.tenant, name="FO113 Org", code="fo113-org"
        )

        def make_user(email, role_code):
            user = User.objects.create_user(
                email=email,
                password="Password123!",
                tenant=cls.tenant,
                organization=cls.org,
                first_name=role_code,
                last_name="User",
            )
            UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
            return user

        cls.fm = make_user("fo113-fm@example.com", "facility_manager")
        cls.tech = make_user("fo113-tech@example.com", "technician")
        cls.employee = make_user("fo113-emp@example.com", "employee")
        cls.viewer = make_user("fo113-viewer@example.com", "viewer")

    def _role_project_perms(self, role_code):
        return set(
            RolePermission.objects.filter(
                role__code=role_code,
                permission__code__startswith="projects.",
            ).values_list("permission__code", flat=True)
        )

    def test_01_technician_project_permission_matrix(self):
        perms = self._role_project_perms("technician")
        self.assertTrue(TECHNICIAN_PROJECT_PERMS.issubset(perms))
        self.assertTrue(TECHNICIAN_FORBIDDEN_PROJECT_PERMS.isdisjoint(perms))

    def test_02_employee_has_no_project_permissions(self):
        self.assertEqual(self._role_project_perms("employee"), set())

    def test_03_viewer_read_only_project_permissions(self):
        perms = self._role_project_perms("viewer")
        self.assertIn("projects.view", perms)
        self.assertIn("projects.tasks.view", perms)
        self.assertNotIn("projects.manage", perms)
        self.assertNotIn("projects.tasks.update", perms)
        self.assertNotIn("projects.create", perms)

    def test_04_facility_manager_retains_project_manage(self):
        perms = self._role_project_perms("facility_manager")
        self.assertIn("projects.manage", perms)
        self.assertIn("projects.tasks.assign", perms)
        self.assertIn("projects.dependencies.manage", perms)
        self.assertIn("projects.links.manage", perms)

    def test_05_employee_denied_my_work(self):
        self.client.force_authenticate(self.employee)
        response = self.client.get(reverse("project-my-work"))
        self.assertIn(response.status_code, (401, 403))

    def test_06_technician_can_open_my_work(self):
        self.client.force_authenticate(self.tech)
        response = self.client.get(reverse("project-my-work"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("summary", response.data)
        self.assertIn("assigned_tasks", response.data)
        self.assertIn("workload", response.data)

    def test_07_viewer_can_open_my_work_read_projection(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(reverse("project-my-work"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["my_assigned_tasks"], 0)
