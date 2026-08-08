"""FO-115 tenant-scope verification for Projects / Gantt / My Work."""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Role, UserRole
from apps.master_data.models import Organization, Tenant
from apps.projects.models import Project

User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class ProjectTenantScopeFO115Tests(APITestCase):
    """Security gate: Tenant A must not see Tenant B project surfaces."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="FO115 Tenant A", code="fo115-a")
        cls.tenant_b = Tenant.objects.create(name="FO115 Tenant B", code="fo115-b")
        cls.org_a1 = Organization.objects.create(
            tenant=cls.tenant_a, name="Organization A", code="fo115-org-a1"
        )
        cls.org_a2 = Organization.objects.create(
            tenant=cls.tenant_a, name="Organization B", code="fo115-org-a2"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="Tenant B Org", code="fo115-org-b"
        )

        def make_user(email, tenant, org, role_code):
            user = User.objects.create_user(
                email=email,
                password="Password123!",
                tenant=tenant,
                organization=org,
                first_name=email.split("@")[0],
                last_name="User",
            )
            UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
            return user

        cls.fm_a = make_user(
            "fo115-fm-a@example.com", cls.tenant_a, cls.org_a1, "facility_manager"
        )
        cls.fm_b = make_user(
            "fo115-fm-b@example.com", cls.tenant_b, cls.org_b, "facility_manager"
        )
        cls.tech_a = make_user(
            "fo115-tech-a@example.com", cls.tenant_a, cls.org_a1, "technician"
        )
        cls.viewer_a = make_user(
            "fo115-viewer-a@example.com", cls.tenant_a, cls.org_a1, "viewer"
        )
        cls.employee_a = make_user(
            "fo115-emp-a@example.com", cls.tenant_a, cls.org_a1, "employee"
        )

    def setUp(self):
        today = date.today()
        self.client.force_authenticate(self.fm_a)
        project_a1 = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org_a1.id),
                "name": "Lobby Repainting",
                "project_manager": str(self.fm_a.id),
                "planned_start_date": str(today),
                "planned_end_date": str(today + timedelta(days=20)),
            },
            format="json",
        )
        self.assertEqual(project_a1.status_code, status.HTTP_201_CREATED, project_a1.data)
        self.project_a1_id = project_a1.data["id"]

        project_a2 = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org_a2.id),
                "name": "Floor Tiles Replacement",
                "project_manager": str(self.fm_a.id),
                "planned_start_date": str(today),
                "planned_end_date": str(today + timedelta(days=20)),
            },
            format="json",
        )
        self.assertEqual(project_a2.status_code, status.HTTP_201_CREATED, project_a2.data)
        self.project_a2_id = project_a2.data["id"]

        self.client.force_authenticate(self.fm_b)
        project_b = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org_b.id),
                "name": "Tenant B Secret Project",
                "project_manager": str(self.fm_b.id),
                "planned_start_date": str(today),
                "planned_end_date": str(today + timedelta(days=10)),
            },
            format="json",
        )
        self.assertEqual(project_b.status_code, status.HTTP_201_CREATED, project_b.data)
        self.project_b_id = project_b.data["id"]

        # Seed a task on tenant B for nested endpoint checks.
        tasks_url = reverse(
            "project-task-list", kwargs={"project_id": self.project_b_id}
        )
        task_b = self.client.post(
            tasks_url,
            {
                "name": "Hidden Task",
                "planned_start": str(today),
                "planned_end": str(today + timedelta(days=1)),
            },
            format="json",
        )
        self.assertEqual(task_b.status_code, status.HTTP_201_CREATED, task_b.data)
        self.task_b_id = task_b.data["id"]

    def test_01_list_same_tenant_orgs_visible_tenant_b_hidden(self):
        self.client.force_authenticate(self.fm_a)
        response = self.client.get(reverse("project-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {row["id"] for row in response.data["results"]}
        self.assertIn(self.project_a1_id, ids)
        self.assertIn(self.project_a2_id, ids)
        self.assertNotIn(self.project_b_id, ids)
        for row in response.data["results"]:
            project = Project.objects.get(pk=row["id"])
            self.assertEqual(project.tenant_id, self.fm_a.tenant_id)
            self.assertIn("organization_name", row)
            self.assertNotIn(str(self.tenant_b.id), str(row.get("tenant")))

    def test_02_detail_gantt_tasks_progress_timeline_links_404(self):
        self.client.force_authenticate(self.fm_a)
        endpoints = [
            reverse("project-detail", kwargs={"pk": self.project_b_id}),
            reverse("project-gantt", kwargs={"pk": self.project_b_id}),
            reverse("project-task-list", kwargs={"project_id": self.project_b_id}),
            reverse("project-progress", kwargs={"pk": self.project_b_id}),
            reverse("project-timeline-list", kwargs={"project_id": self.project_b_id}),
            reverse("project-link-list", kwargs={"project_id": self.project_b_id}),
            reverse(
                "project-task-detail",
                kwargs={"project_id": self.project_b_id, "pk": self.task_b_id},
            ),
        ]
        for url in endpoints:
            response = self.client.get(url)
            self.assertIn(
                response.status_code,
                (status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN),
                msg=f"{url} => {response.status_code}",
            )

    def test_03_facility_manager_technician_viewer_tenant_bound(self):
        for user in (self.fm_a, self.tech_a, self.viewer_a):
            self.client.force_authenticate(user)
            response = self.client.get(reverse("project-list"))
            self.assertEqual(response.status_code, status.HTTP_200_OK, user.email)
            ids = {row["id"] for row in response.data["results"]}
            self.assertNotIn(self.project_b_id, ids, user.email)

    def test_04_employee_denied_projects(self):
        self.client.force_authenticate(self.employee_a)
        response = self.client.get(reverse("project-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_05_my_work_excludes_tenant_b(self):
        self.client.force_authenticate(self.tech_a)
        response = self.client.get(reverse("project-my-work"))
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_403_FORBIDDEN))
        if response.status_code == status.HTTP_200_OK:
            payload = str(response.data)
            self.assertNotIn(str(self.project_b_id), payload)
            self.assertNotIn("Tenant B Secret", payload)

    def test_06_organization_labels_do_not_authorize_cross_tenant(self):
        """Same-tenant org diversity is allowed; Tenant B remains excluded."""
        self.client.force_authenticate(self.fm_a)
        listed = self.client.get(reverse("project-list"))
        names = {row["organization_name"] for row in listed.data["results"]}
        self.assertTrue({"Organization A", "Organization B"} & names)
        self.assertNotIn("Tenant B Org", names)
