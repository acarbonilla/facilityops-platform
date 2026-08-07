"""FO-110 / FO-111 Technician Project workspace and task execution tests."""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Role, UserRole
from apps.master_data.models import Organization, Tenant
from apps.projects.models import Project, ProjectIssue, ProjectMember, ProjectTask

User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class TechnicianWorkspaceExecutionTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="FO110 Tenant A", code="fo110-a")
        cls.tenant_b = Tenant.objects.create(name="FO110 Tenant B", code="fo110-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="Org A", code="fo110-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="Org B", code="fo110-org-b"
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
            "fo110-fm@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.tech_a = make_user(
            "fo110-tech-a@example.com", cls.tenant_a, cls.org_a, "technician"
        )
        cls.tech_b = make_user(
            "fo110-tech-b@example.com", cls.tenant_a, cls.org_a, "technician"
        )
        cls.tech_tenant_b = make_user(
            "fo110-tech-b2@example.com", cls.tenant_b, cls.org_b, "technician"
        )
        cls.employee = make_user(
            "fo110-emp@example.com", cls.tenant_a, cls.org_a, "employee"
        )

    def setUp(self):
        self.client.force_authenticate(self.fm_a)
        project = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org_a.id),
                "name": "Lobby Flooring Replacement",
                "project_manager": str(self.fm_a.id),
                "planned_start_date": str(date.today()),
                "planned_end_date": str(date.today() + timedelta(days=30)),
            },
            format="json",
        )
        self.assertEqual(project.status_code, 201, project.data)
        self.project_id = project.data["id"]
        self.project = Project.objects.get(pk=self.project_id)

        other = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org_a.id),
                "name": "Unrelated Roof Project",
                "project_manager": str(self.fm_a.id),
                "planned_start_date": str(date.today()),
                "planned_end_date": str(date.today() + timedelta(days=10)),
            },
            format="json",
        )
        self.other_project_id = other.data["id"]

    def _tasks_url(self, project_id=None):
        return reverse(
            "project-task-list",
            kwargs={"project_id": project_id or self.project_id},
        )

    def _task_url(self, task_id, project_id=None):
        return reverse(
            "project-task-detail",
            kwargs={
                "project_id": project_id or self.project_id,
                "pk": task_id,
            },
        )

    def _action_url(self, name, task_id):
        return reverse(
            name,
            kwargs={"project_id": self.project_id, "pk": task_id},
        )

    def _create_assigned_task(self, *, tech, name="Remove old flooring"):
        self.client.force_authenticate(self.fm_a)
        response = self.client.post(
            self._tasks_url(),
            {
                "name": name,
                "person_in_charge": str(tech.id),
                "planned_start": str(date.today()),
                "planned_end": str(date.today() + timedelta(days=3)),
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_01_technician_without_assignment_sees_empty_list(self):
        self.client.force_authenticate(self.tech_a)
        response = self.client.get(reverse("project-list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data.get("count", len(response.data)), 0)

    def test_02_technician_assigned_task_sees_project(self):
        task = self._create_assigned_task(tech=self.tech_a)
        self.client.force_authenticate(self.tech_a)
        listed = self.client.get(reverse("project-list"))
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.data["count"], 1)
        self.assertEqual(listed.data["results"][0]["id"], self.project_id)
        detail = self.client.get(
            reverse("project-detail", kwargs={"pk": self.project_id})
        )
        self.assertEqual(detail.status_code, 200)
        self.assertIn("my_assigned", detail.data.get("task_summary", {}))
        # Unrelated project remains hidden.
        blocked = self.client.get(
            reverse("project-detail", kwargs={"pk": self.other_project_id})
        )
        self.assertIn(blocked.status_code, (403, 404))
        void = task  # silence lint
        self.assertTrue(void["id"])

    def test_03_technician_member_without_task_sees_project(self):
        ProjectMember.objects.create(
            tenant=self.tenant_a,
            project=self.project,
            user=self.tech_a,
            role=ProjectMember.Role.MEMBER,
            is_active=True,
            added_by=self.fm_a,
        )
        self.client.force_authenticate(self.tech_a)
        listed = self.client.get(reverse("project-list"))
        self.assertEqual(listed.data["count"], 1)

    def test_04_cross_tenant_technician_denied(self):
        task = self._create_assigned_task(tech=self.tech_a)
        self.client.force_authenticate(self.tech_tenant_b)
        listed = self.client.get(reverse("project-list"))
        self.assertEqual(listed.data.get("count", 0), 0)
        blocked = self.client.get(self._task_url(task["id"]))
        self.assertIn(blocked.status_code, (403, 404))

    def test_05_technician_cannot_create_or_manage_project(self):
        self._create_assigned_task(tech=self.tech_a)
        self.client.force_authenticate(self.tech_a)
        create = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org_a.id),
                "name": "Hack",
                "project_manager": str(self.fm_a.id),
                "planned_start_date": str(date.today()),
                "planned_end_date": str(date.today() + timedelta(days=1)),
            },
            format="json",
        )
        self.assertEqual(create.status_code, 403)
        patch = self.client.patch(
            reverse("project-detail", kwargs={"pk": self.project_id}),
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(patch.status_code, 403)

    def test_06_technician_cannot_edit_other_tech_task(self):
        task_a = self._create_assigned_task(tech=self.tech_a, name="A")
        task_b = self._create_assigned_task(tech=self.tech_b, name="B")
        self.client.force_authenticate(self.tech_a)
        denied = self.client.patch(
            self._task_url(task_b["id"]),
            {"progress_percentage": "50.00"},
            format="json",
        )
        self.assertIn(denied.status_code, (400, 403))
        start_b = self.client.post(
            self._action_url("project-task-start", task_b["id"]),
            {},
            format="json",
        )
        self.assertIn(start_b.status_code, (400, 403))
        # Own task ok
        start_a = self.client.post(
            self._action_url("project-task-start", task_a["id"]),
            {},
            format="json",
        )
        self.assertEqual(start_a.status_code, 200, start_a.data)
        self.assertEqual(start_a.data["status"], "in_progress")

    def test_07_lifecycle_start_pause_resume_complete(self):
        task = self._create_assigned_task(tech=self.tech_a)
        self.client.force_authenticate(self.tech_a)
        started = self.client.post(
            self._action_url("project-task-start", task["id"]), {}, format="json"
        )
        self.assertEqual(started.status_code, 200, started.data)
        paused = self.client.post(
            self._action_url("project-task-pause", task["id"]), {}, format="json"
        )
        self.assertEqual(paused.status_code, 200, paused.data)
        self.assertEqual(paused.data["status"], "on_hold")
        resumed = self.client.post(
            self._action_url("project-task-resume", task["id"]), {}, format="json"
        )
        self.assertEqual(resumed.status_code, 200, resumed.data)
        self.assertEqual(resumed.data["status"], "in_progress")
        progress = self.client.post(
            self._action_url("project-task-progress", task["id"]),
            {"progress_percentage": "55"},
            format="json",
        )
        self.assertEqual(progress.status_code, 200, progress.data)
        self.assertEqual(Decimal(progress.data["progress_percentage"]), Decimal("55.00"))
        completed = self.client.post(
            self._action_url("project-task-complete", task["id"]), {}, format="json"
        )
        self.assertEqual(completed.status_code, 200, completed.data)
        self.assertEqual(completed.data["status"], "completed")
        self.assertEqual(
            Decimal(completed.data["progress_percentage"]), Decimal("100.00")
        )
        project = self.client.get(
            reverse("project-detail", kwargs={"pk": self.project_id})
        )
        # Task completion recalculates accomplishment but does not complete Project.
        self.assertNotEqual(project.data["status"], "completed")
        self.assertEqual(
            Decimal(str(project.data["completion_percentage"])), Decimal("100.00")
        )

    def test_08_report_blocker_creates_issue_not_ticket(self):
        task = self._create_assigned_task(tech=self.tech_a)
        self.client.force_authenticate(self.tech_a)
        blocker = self.client.post(
            self._action_url("project-task-report-blocker", task["id"]),
            {
                "title": "Adhesive material not delivered",
                "description": "Installation cannot continue.",
                "severity": "high",
            },
            format="json",
        )
        self.assertEqual(blocker.status_code, 201, blocker.data)
        self.assertTrue(
            ProjectIssue.objects.filter(
                project_id=self.project_id,
                title="Adhesive material not delivered",
            ).exists()
        )

    def test_09_employee_denied_projects(self):
        self.client.force_authenticate(self.employee)
        listed = self.client.get(reverse("project-list"))
        self.assertEqual(listed.status_code, 403)

    def test_10_facility_manager_still_sees_all_tenant_projects(self):
        self._create_assigned_task(tech=self.tech_a)
        self.client.force_authenticate(self.fm_a)
        listed = self.client.get(reverse("project-list"))
        self.assertGreaterEqual(listed.data["count"], 2)

    def test_11_technician_cannot_assign_or_manage_dependencies(self):
        task = self._create_assigned_task(tech=self.tech_a)
        other = self._create_assigned_task(tech=self.tech_b, name="Other")
        self.client.force_authenticate(self.tech_a)
        assign = self.client.post(
            self._action_url("project-task-assign", task["id"]),
            {"person_in_charge": str(self.tech_b.id)},
            format="json",
        )
        self.assertEqual(assign.status_code, 403)
        dep = self.client.post(
            reverse(
                "project-dependency-list",
                kwargs={"project_id": self.project_id},
            ),
            {
                "predecessor_task": other["id"],
                "successor_task": task["id"],
            },
            format="json",
        )
        self.assertEqual(dep.status_code, 403)
