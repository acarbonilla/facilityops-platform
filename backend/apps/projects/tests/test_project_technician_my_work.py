"""FO-112 Technician My Work / assigned-work dashboard tests."""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.access_control.models import Role, UserRole
from apps.master_data.models import Organization, Tenant
from apps.projects.assigned_work_service import end_of_week
from apps.projects.models import (
    Project,
    ProjectMember,
    ProjectTask,
)

User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class TechnicianAssignedWorkDashboardTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="FO112 Tenant A", code="fo112-a")
        cls.tenant_b = Tenant.objects.create(name="FO112 Tenant B", code="fo112-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="Org A", code="fo112-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="Org B", code="fo112-org-b"
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
            "fo112-fm@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.tech_a = make_user(
            "fo112-tech-a@example.com", cls.tenant_a, cls.org_a, "technician"
        )
        cls.tech_b = make_user(
            "fo112-tech-b@example.com", cls.tenant_a, cls.org_a, "technician"
        )
        cls.tech_tenant_b = make_user(
            "fo112-tech-tb@example.com", cls.tenant_b, cls.org_b, "technician"
        )
        cls.employee = make_user(
            "fo112-emp@example.com", cls.tenant_a, cls.org_a, "employee"
        )

    def setUp(self):
        self.today = timezone.localdate()
        self.client.force_authenticate(self.fm_a)
        project = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org_a.id),
                "name": "FO112 Lobby Upgrade",
                "project_manager": str(self.fm_a.id),
                "planned_start_date": str(self.today - timedelta(days=14)),
                "planned_end_date": str(self.today + timedelta(days=30)),
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
                "name": "FO112 Other Roof",
                "project_manager": str(self.fm_a.id),
                "planned_start_date": str(self.today - timedelta(days=14)),
                "planned_end_date": str(self.today + timedelta(days=30)),
            },
            format="json",
        )
        self.other_project_id = other.data["id"]

        # Membership alone must not expose other PIC's tasks as My Work.
        ProjectMember.objects.get_or_create(
            project=self.project,
            user=self.tech_a,
            defaults={
                "tenant": self.tenant_a,
                "role": ProjectMember.Role.MEMBER,
                "is_active": True,
            },
        )

    def _my_work(self):
        return reverse("project-my-work")

    def _my_work_tasks(self):
        return reverse("project-my-work-tasks")

    def _create_task(self, **overrides):
        self.client.force_authenticate(self.fm_a)
        person = overrides.pop("person_in_charge", self.tech_a)
        planned_start = overrides.pop("planned_start", self.today - timedelta(days=1))
        planned_end = overrides.pop("planned_end", self.today + timedelta(days=2))
        payload = {
            "name": overrides.pop("name", "Task"),
            "person_in_charge": str(person.id),
            "status": overrides.pop("status", ProjectTask.Status.NOT_STARTED),
            "priority": overrides.pop("priority", ProjectTask.Priority.MEDIUM),
            "progress_percentage": str(
                overrides.pop("progress_percentage", Decimal("0.00"))
            ),
        }
        if planned_start is not None:
            payload["planned_start"] = str(planned_start)
        if planned_end is not None:
            payload["planned_end"] = str(planned_end)
        project_id = overrides.pop("project_id", self.project_id)
        for key, value in overrides.items():
            payload[key] = value
        response = self.client.post(
            reverse("project-task-list", kwargs={"project_id": project_id}),
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_01_employee_denied(self):
        self.client.force_authenticate(self.employee)
        response = self.client.get(self._my_work())
        self.assertIn(response.status_code, (403, 401))

    def test_02_technician_sees_only_assigned_tasks(self):
        mine = self._create_task(name="Mine", person_in_charge=self.tech_a)
        other = self._create_task(name="Theirs", person_in_charge=self.tech_b)
        self.client.force_authenticate(self.tech_a)
        data = self.client.get(self._my_work()).data
        ids = {row["id"] for row in data["assigned_tasks"]}
        self.assertIn(mine["id"], ids)
        self.assertNotIn(other["id"], ids)

    def test_03_membership_alone_does_not_include_unassigned_tasks(self):
        theirs = self._create_task(name="Not Mine", person_in_charge=self.tech_b)
        self.client.force_authenticate(self.tech_a)
        data = self.client.get(self._my_work()).data
        ids = {row["id"] for row in data["assigned_tasks"]}
        self.assertNotIn(theirs["id"], ids)

    def test_04_technician_b_cannot_see_technician_a_work(self):
        mine = self._create_task(name="A only", person_in_charge=self.tech_a)
        self.client.force_authenticate(self.tech_b)
        data = self.client.get(self._my_work()).data
        ids = {row["id"] for row in data["assigned_tasks"]}
        self.assertNotIn(mine["id"], ids)

    def test_05_tenant_isolation(self):
        self._create_task(name="Tenant A task", person_in_charge=self.tech_a)
        self.client.force_authenticate(self.tech_tenant_b)
        data = self.client.get(self._my_work()).data
        self.assertEqual(data["summary"]["my_assigned_tasks"], 0)
        self.assertEqual(data["projects"], [])

    def test_06_due_today_and_overdue_and_week(self):
        week_end = end_of_week(self.today)
        mid_week = min(self.today + timedelta(days=2), week_end)
        if mid_week <= self.today:
            mid_week = week_end

        due_today = self._create_task(
            name="Due Today",
            planned_start=self.today - timedelta(days=3),
            planned_end=self.today,
            status=ProjectTask.Status.IN_PROGRESS,
            progress_percentage=Decimal("40.00"),
        )
        overdue = self._create_task(
            name="Overdue",
            planned_start=self.today - timedelta(days=10),
            planned_end=self.today - timedelta(days=2),
            status=ProjectTask.Status.IN_PROGRESS,
            progress_percentage=Decimal("20.00"),
        )
        week_task = self._create_task(
            name="Due Week",
            planned_start=self.today,
            planned_end=mid_week if mid_week > self.today else week_end,
            status=ProjectTask.Status.NOT_STARTED,
        )
        completed = self._create_task(
            name="Done",
            planned_start=self.today - timedelta(days=5),
            planned_end=self.today - timedelta(days=1),
            status=ProjectTask.Status.COMPLETED,
            progress_percentage=Decimal("100.00"),
            actual_end=str(self.today - timedelta(days=1)),
        )

        self.client.force_authenticate(self.tech_a)
        data = self.client.get(self._my_work()).data
        due_ids = {row["id"] for row in data["due_today"]}
        overdue_ids = {row["id"] for row in data["overdue"]}
        week_ids = {row["id"] for row in data["due_this_week"]}
        self.assertIn(due_today["id"], due_ids)
        self.assertIn(overdue["id"], overdue_ids)
        self.assertNotIn(completed["id"], overdue_ids)
        self.assertNotIn(overdue["id"], week_ids)
        if mid_week > self.today:
            self.assertIn(week_task["id"], week_ids)
        self.assertGreaterEqual(data["summary"]["overdue"], 1)
        self.assertGreaterEqual(data["summary"]["due_today"], 1)

    def test_07_blocked_paused_dependency(self):
        pred = self._create_task(
            name="Pred",
            person_in_charge=self.tech_b,
            status=ProjectTask.Status.NOT_STARTED,
            planned_start=self.today,
            planned_end=self.today + timedelta(days=1),
        )
        blocked = self._create_task(
            name="Status Blocked",
            status=ProjectTask.Status.BLOCKED,
            progress_percentage=Decimal("10.00"),
        )
        paused = self._create_task(
            name="Paused",
            status=ProjectTask.Status.ON_HOLD,
            progress_percentage=Decimal("15.00"),
        )
        waiting = self._create_task(
            name="Waiting Pred",
            status=ProjectTask.Status.NOT_STARTED,
            planned_start=self.today + timedelta(days=2),
            planned_end=self.today + timedelta(days=4),
        )
        self.client.force_authenticate(self.fm_a)
        dep = self.client.post(
            reverse(
                "project-dependency-list",
                kwargs={"project_id": self.project_id},
            ),
            {
                "predecessor_task": pred["id"],
                "successor_task": waiting["id"],
                "dependency_type": "finish_to_start",
            },
            format="json",
        )
        self.assertEqual(dep.status_code, 201, dep.data)

        self.client.force_authenticate(self.tech_a)
        data = self.client.get(self._my_work()).data
        blocked_ids = {row["id"]: row for row in data["blocked"]}
        self.assertIn(blocked["id"], blocked_ids)
        self.assertEqual(blocked_ids[blocked["id"]]["block_reason"], "status_blocked")
        self.assertIn(paused["id"], blocked_ids)
        self.assertEqual(blocked_ids[paused["id"]]["block_reason"], "paused")
        self.assertIn(waiting["id"], blocked_ids)
        self.assertEqual(
            blocked_ids[waiting["id"]]["block_reason"], "waiting_predecessor"
        )

    def test_08_unscheduled_and_upcoming_and_recent(self):
        unscheduled = self._create_task(
            name="No Dates",
            planned_start=None,
            planned_end=None,
        )
        # Clear dates via model — serializer may reject null on create.
        task = ProjectTask.objects.get(pk=unscheduled["id"])
        task.planned_start = None
        task.planned_end = None
        task.save(update_fields=["planned_start", "planned_end", "updated_at"])

        upcoming = self._create_task(
            name="Future",
            planned_start=self.today + timedelta(days=5),
            planned_end=self.today + timedelta(days=8),
            status=ProjectTask.Status.NOT_STARTED,
        )
        recent = self._create_task(
            name="Recently Done",
            planned_start=self.today - timedelta(days=7),
            planned_end=self.today - timedelta(days=1),
            status=ProjectTask.Status.COMPLETED,
            progress_percentage=Decimal("100.00"),
        )
        ProjectTask.objects.filter(pk=recent["id"]).update(
            actual_end=self.today - timedelta(days=1),
            status=ProjectTask.Status.COMPLETED,
            progress_percentage=Decimal("100.00"),
        )

        self.client.force_authenticate(self.tech_a)
        data = self.client.get(self._my_work()).data
        self.assertIn(
            str(task.id), {row["id"] for row in data["unscheduled"]}
        )
        self.assertIn(upcoming["id"], {row["id"] for row in data["upcoming"]})
        self.assertIn(
            recent["id"], {row["id"] for row in data["recently_completed"]}
        )

    def test_09_my_projects_and_summary(self):
        self._create_task(name="Active A", status=ProjectTask.Status.IN_PROGRESS, progress_percentage=Decimal("30.00"))
        self._create_task(
            name="On other project",
            project_id=self.other_project_id,
            status=ProjectTask.Status.NOT_STARTED,
        )
        self.client.force_authenticate(self.tech_a)
        data = self.client.get(self._my_work()).data
        project_ids = {row["id"] for row in data["projects"]}
        self.assertIn(self.project_id, project_ids)
        self.assertIn(self.other_project_id, project_ids)
        self.assertEqual(data["summary"]["my_projects"], 2)
        self.assertEqual(data["summary"]["my_assigned_tasks"], 2)
        self.assertEqual(data["summary"]["in_progress"], 1)
        self.assertEqual(data["workload"]["assigned"], 2)

    def test_10_deleted_task_and_project_excluded(self):
        task = self._create_task(name="Will Delete")
        ProjectTask.objects.filter(pk=task["id"]).update(is_deleted=True)
        deleted_project_task = self._create_task(
            name="On doomed project",
            project_id=self.other_project_id,
        )
        Project.objects.filter(pk=self.other_project_id).update(is_deleted=True)

        self.client.force_authenticate(self.tech_a)
        data = self.client.get(self._my_work()).data
        ids = {row["id"] for row in data["assigned_tasks"]}
        self.assertNotIn(task["id"], ids)
        self.assertNotIn(deleted_project_task["id"], ids)

    def test_11_filters_and_pagination_on_task_list(self):
        self._create_task(
            name="High Pri",
            priority=ProjectTask.Priority.HIGH,
            status=ProjectTask.Status.IN_PROGRESS,
            progress_percentage=Decimal("10.00"),
        )
        self._create_task(
            name="Low Pri",
            priority=ProjectTask.Priority.LOW,
            status=ProjectTask.Status.NOT_STARTED,
        )
        self.client.force_authenticate(self.tech_a)
        filtered = self.client.get(
            self._my_work_tasks(),
            {"priority": "high", "page_size": 10},
        )
        self.assertEqual(filtered.status_code, 200)
        self.assertTrue(all(row["priority"] == "high" for row in filtered.data["results"]))
        scoped = self.client.get(
            self._my_work_tasks(),
            {"project": self.project_id},
        )
        self.assertEqual(scoped.status_code, 200)
        self.assertTrue(
            all(row["project_id"] == self.project_id for row in scoped.data["results"])
        )

    def test_12_quick_start_pause_resume_authorized(self):
        task = self._create_task(
            name="Lifecycle",
            status=ProjectTask.Status.NOT_STARTED,
            planned_start=self.today - timedelta(days=1),
            planned_end=self.today + timedelta(days=3),
        )
        self.client.force_authenticate(self.tech_a)
        start = self.client.post(
            reverse(
                "project-task-start",
                kwargs={"project_id": self.project_id, "pk": task["id"]},
            ),
            {},
            format="json",
        )
        self.assertEqual(start.status_code, 200, start.data)
        pause = self.client.post(
            reverse(
                "project-task-pause",
                kwargs={"project_id": self.project_id, "pk": task["id"]},
            ),
            {},
            format="json",
        )
        self.assertEqual(pause.status_code, 200, pause.data)
        resume = self.client.post(
            reverse(
                "project-task-resume",
                kwargs={"project_id": self.project_id, "pk": task["id"]},
            ),
            {},
            format="json",
        )
        self.assertEqual(resume.status_code, 200, resume.data)

        dash = self.client.get(self._my_work()).data
        matching = [
            row for row in dash["assigned_tasks"] if row["id"] == task["id"]
        ]
        self.assertEqual(matching[0]["status"], ProjectTask.Status.IN_PROGRESS)

    def test_13_unassigned_quick_action_denied(self):
        task = self._create_task(name="B task", person_in_charge=self.tech_b)
        self.client.force_authenticate(self.tech_a)
        start = self.client.post(
            reverse(
                "project-task-start",
                kwargs={"project_id": self.project_id, "pk": task["id"]},
            ),
            {},
            format="json",
        )
        self.assertIn(start.status_code, (400, 403))

    def test_14_project_not_auto_completed(self):
        task = self._create_task(
            name="Finish me",
            status=ProjectTask.Status.IN_PROGRESS,
            progress_percentage=Decimal("90.00"),
        )
        self.client.force_authenticate(self.tech_a)
        complete = self.client.post(
            reverse(
                "project-task-complete",
                kwargs={"project_id": self.project_id, "pk": task["id"]},
            ),
            {},
            format="json",
        )
        self.assertEqual(complete.status_code, 200, complete.data)
        self.project.refresh_from_db()
        self.assertNotEqual(self.project.status, Project.Status.COMPLETED)
