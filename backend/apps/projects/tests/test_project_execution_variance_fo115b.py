"""FO-115B Planned vs Actual execution tracking & variance tests."""

from datetime import date, timedelta
from decimal import Decimal
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Role, UserRole
from apps.master_data.models import Organization, Tenant
from apps.projects.execution_variance import compute_execution_schedule
from apps.projects.models import ProjectMember, ProjectTask
from apps.projects.progress_service import calculate_accomplishment

User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class ProjectExecutionVarianceFO115BTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant = Tenant.objects.create(name="FO115B Tenant", code="fo115b-a")
        cls.org = Organization.objects.create(
            tenant=cls.tenant, name="FO115B Org", code="fo115b-org"
        )
        cls.tenant_b = Tenant.objects.create(name="FO115B Tenant B", code="fo115b-b")
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="FO115B Org B", code="fo115b-org-b"
        )

        def make_user(email, role_code, tenant=None, org=None):
            user = User.objects.create_user(
                email=email,
                password="Password123!",
                tenant=tenant or cls.tenant,
                organization=org or cls.org,
                first_name=email.split("@")[0],
                last_name="User",
            )
            UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
            return user

        cls.fm = make_user("fo115b-fm@example.com", "facility_manager")
        cls.tech = make_user("fo115b-tech@example.com", "technician")
        cls.fm_b = make_user(
            "fo115b-fm-b@example.com",
            "facility_manager",
            tenant=cls.tenant_b,
            org=cls.org_b,
        )

    def setUp(self):
        self.today = timezone.localdate()
        self.client.force_authenticate(self.fm)
        project = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org.id),
                "name": "Lobby Tile Replacement",
                "project_manager": str(self.fm.id),
                "planned_start_date": "2026-08-10",
                "planned_end_date": "2026-08-20",
            },
            format="json",
        )
        self.assertEqual(project.status_code, status.HTTP_201_CREATED, project.data)
        self.project_id = project.data["id"]
        self.tasks_url = reverse(
            "project-task-list", kwargs={"project_id": self.project_id}
        )
        self.gantt_url = reverse("project-gantt", kwargs={"pk": self.project_id})
        ProjectMember.objects.get_or_create(
            project_id=self.project_id,
            user=self.tech,
            defaults={
                "tenant": self.tenant,
                "role": ProjectMember.Role.MEMBER,
                "is_active": True,
                "added_by": self.fm,
            },
        )

    def _create_task(self, **overrides):
        payload = {
            "name": "Remove Existing Damaged Tiles",
            "person_in_charge": str(self.tech.id),
            "planned_start": "2026-08-10",
            "planned_end": "2026-08-12",
            "status": "not_started",
            "progress_percentage": "0",
        }
        payload.update(overrides)
        resp = self.client.post(self.tasks_url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        return resp.data

    def _action(self, name, task_id, data=None, as_user=None):
        if as_user is not None:
            self.client.force_authenticate(as_user)
        url = reverse(name, kwargs={"project_id": self.project_id, "pk": task_id})
        resp = self.client.post(url, data or {}, format="json")
        self.client.force_authenticate(self.fm)
        return resp

    def test_01_start_sets_actual_start_once(self):
        task = self._create_task()
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 10)
        ):
            started = self._action(
                "project-task-start", task["id"], as_user=self.tech
            )
        self.assertEqual(started.status_code, 200, started.data)
        self.assertEqual(started.data["actual_start"], "2026-08-10")
        self.assertEqual(started.data["planned_start"], "2026-08-10")
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 13)
        ):
            paused = self._action(
                "project-task-pause", task["id"], as_user=self.tech
            )
            self.assertEqual(paused.status_code, 200, paused.data)
            resumed = self._action(
                "project-task-resume", task["id"], as_user=self.tech
            )
        self.assertEqual(resumed.status_code, 200, resumed.data)
        self.assertEqual(resumed.data["actual_start"], "2026-08-10")

    def test_02_progress_preserves_actual_start(self):
        task = self._create_task()
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 10)
        ):
            self._action("project-task-start", task["id"], as_user=self.tech)
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 14)
        ):
            progress = self._action(
                "project-task-progress",
                task["id"],
                {"progress_percentage": "40"},
                as_user=self.tech,
            )
        self.assertEqual(progress.status_code, 200, progress.data)
        self.assertEqual(progress.data["actual_start"], "2026-08-10")
        self.assertIsNone(progress.data["actual_end"])

    def test_03_complete_sets_actual_end_preserves_plan(self):
        task = self._create_task()
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 11)
        ):
            self._action("project-task-start", task["id"], as_user=self.tech)
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 14)
        ):
            done = self._action(
                "project-task-complete", task["id"], as_user=self.tech
            )
        self.assertEqual(done.status_code, 200, done.data)
        self.assertEqual(done.data["actual_start"], "2026-08-11")
        self.assertEqual(done.data["actual_end"], "2026-08-14")
        self.assertEqual(done.data["planned_start"], "2026-08-10")
        self.assertEqual(done.data["planned_end"], "2026-08-12")
        self.assertEqual(done.data["completion_variance_days"], 2)
        self.assertEqual(done.data["execution_schedule_status"], "completed_late")

    def test_04_reopen_clears_actual_end_keeps_start(self):
        task = self._create_task()
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 10)
        ):
            self._action("project-task-start", task["id"], as_user=self.tech)
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 12)
        ):
            self._action("project-task-complete", task["id"], as_user=self.tech)
        reopened = self.client.patch(
            reverse(
                "project-task-detail",
                kwargs={"project_id": self.project_id, "pk": task["id"]},
            ),
            {"status": "in_progress", "progress_percentage": "50"},
            format="json",
        )
        self.assertEqual(reopened.status_code, 200, reopened.data)
        self.assertEqual(reopened.data["actual_start"], "2026-08-10")
        self.assertIsNone(reopened.data["actual_end"])
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 15)
        ):
            again = self._action(
                "project-task-complete", task["id"], as_user=self.tech
            )
        self.assertEqual(again.data["actual_end"], "2026-08-15")

    def test_05_cancel_preserves_actual_facts(self):
        task = self._create_task()
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 10)
        ):
            self._action("project-task-start", task["id"], as_user=self.tech)
        cancelled = self.client.patch(
            reverse(
                "project-task-detail",
                kwargs={"project_id": self.project_id, "pk": task["id"]},
            ),
            {"status": "cancelled"},
            format="json",
        )
        self.assertEqual(cancelled.status_code, 200, cancelled.data)
        self.assertEqual(cancelled.data["actual_start"], "2026-08-10")
        self.assertIsNone(cancelled.data["actual_end"])

    def test_06_manager_start_same_rule(self):
        task = self._create_task(person_in_charge=str(self.fm.id))
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 10)
        ):
            started = self._action("project-task-start", task["id"])
        self.assertEqual(started.status_code, 200, started.data)
        self.assertEqual(started.data["actual_start"], "2026-08-10")

    def test_07_technician_cannot_patch_actual_dates(self):
        task = self._create_task()
        self.client.force_authenticate(self.tech)
        patched = self.client.patch(
            reverse(
                "project-task-detail",
                kwargs={"project_id": self.project_id, "pk": task["id"]},
            ),
            {
                "actual_start": "2026-08-01",
                "actual_end": "2026-08-02",
                "progress_percentage": "10",
            },
            format="json",
        )
        self.assertEqual(patched.status_code, 400, patched.data)
        self.client.force_authenticate(self.fm)
        detail = self.client.get(
            reverse(
                "project-task-detail",
                kwargs={"project_id": self.project_id, "pk": task["id"]},
            )
        )
        self.assertIsNone(detail.data["actual_start"])
        self.assertIsNone(detail.data["actual_end"])

    def test_08_manager_patch_ignores_actual_date_spoof(self):
        task = self._create_task()
        patched = self.client.patch(
            reverse(
                "project-task-detail",
                kwargs={"project_id": self.project_id, "pk": task["id"]},
            ),
            {
                "actual_start": "2026-08-01",
                "actual_end": "2026-08-02",
                "name": "Remove Existing Damaged Tiles",
            },
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        self.assertIsNone(patched.data["actual_start"])
        self.assertIsNone(patched.data["actual_end"])

    def test_09_start_variance_early_on_time_late(self):
        early = ProjectTask(
            planned_start=date(2026, 8, 10),
            planned_end=date(2026, 8, 14),
            actual_start=date(2026, 8, 9),
            status=ProjectTask.Status.IN_PROGRESS,
        )
        on_time = ProjectTask(
            planned_start=date(2026, 8, 10),
            planned_end=date(2026, 8, 14),
            actual_start=date(2026, 8, 10),
            status=ProjectTask.Status.IN_PROGRESS,
        )
        late = ProjectTask(
            planned_start=date(2026, 8, 10),
            planned_end=date(2026, 8, 14),
            actual_start=date(2026, 8, 12),
            status=ProjectTask.Status.IN_PROGRESS,
        )
        self.assertEqual(
            compute_execution_schedule(task=early, today=date(2026, 8, 11))[
                "execution_schedule_status"
            ],
            "started_early",
        )
        self.assertEqual(
            compute_execution_schedule(task=on_time, today=date(2026, 8, 11))[
                "execution_schedule_status"
            ],
            "started_on_time",
        )
        self.assertEqual(
            compute_execution_schedule(task=late, today=date(2026, 8, 11))[
                "start_variance_days"
            ],
            2,
        )

    def test_10_unscheduled_no_start_variance(self):
        task = ProjectTask(
            planned_start=None,
            planned_end=None,
            actual_start=date(2026, 8, 10),
            status=ProjectTask.Status.IN_PROGRESS,
        )
        result = compute_execution_schedule(task=task, today=date(2026, 8, 11))
        self.assertIsNone(result["start_variance_days"])
        self.assertEqual(result["execution_schedule_status"], "unscheduled")

    def test_11_completion_variance_matrix(self):
        cases = [
            (date(2026, 8, 13), "completed_early", -1),
            (date(2026, 8, 14), "completed_on_time", 0),
            (date(2026, 8, 16), "completed_late", 2),
        ]
        for actual_end, expected_status, expected_days in cases:
            task = ProjectTask(
                planned_start=date(2026, 8, 10),
                planned_end=date(2026, 8, 14),
                actual_start=date(2026, 8, 12),
                actual_end=actual_end,
                status=ProjectTask.Status.COMPLETED,
            )
            result = compute_execution_schedule(task=task, today=date(2026, 8, 20))
            self.assertEqual(result["execution_schedule_status"], expected_status)
            self.assertEqual(result["completion_variance_days"], expected_days)

    def test_12_no_completion_variance_without_planned_end(self):
        task = ProjectTask(
            planned_start=None,
            planned_end=None,
            actual_start=date(2026, 8, 10),
            actual_end=date(2026, 8, 12),
            status=ProjectTask.Status.COMPLETED,
        )
        result = compute_execution_schedule(task=task, today=date(2026, 8, 20))
        self.assertIsNone(result["completion_variance_days"])
        self.assertEqual(result["execution_schedule_status"], "unscheduled")

    def test_13_in_progress_past_planned_end(self):
        task = ProjectTask(
            planned_start=date(2026, 8, 10),
            planned_end=date(2026, 8, 12),
            actual_start=date(2026, 8, 11),
            status=ProjectTask.Status.IN_PROGRESS,
        )
        result = compute_execution_schedule(task=task, today=date(2026, 8, 15))
        self.assertEqual(result["execution_schedule_status"], "in_progress_past_due")
        self.assertEqual(result["days_past_planned_end"], 3)

    def test_14_same_day_task_remains_normal(self):
        task = self._create_task(
            planned_start="2026-08-10",
            planned_end="2026-08-10",
            is_milestone=False,
        )
        self.assertFalse(task["is_milestone"])
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 10)
        ):
            self._action("project-task-start", task["id"], as_user=self.tech)
            done = self._action(
                "project-task-complete", task["id"], as_user=self.tech
            )
        self.assertEqual(done.data["execution_schedule_status"], "completed_on_time")
        self.assertFalse(done.data["is_milestone"])

    def test_15_milestone_actual_completion(self):
        task = self._create_task(
            name="Lobby Reopened",
            planned_start="2026-08-20",
            planned_end="2026-08-20",
            is_milestone=True,
        )
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 21)
        ):
            done = self._action(
                "project-task-complete", task["id"], as_user=self.tech
            )
        self.assertEqual(done.data["completion_variance_days"], 1)
        self.assertEqual(done.data["execution_schedule_status"], "completed_late")

    def test_16_unscheduled_can_execute(self):
        task = self._create_task(
            name="Emergency Floor Preparation",
            planned_start=None,
            planned_end=None,
        )
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 10)
        ):
            self._action("project-task-start", task["id"], as_user=self.tech)
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 12)
        ):
            done = self._action(
                "project-task-complete", task["id"], as_user=self.tech
            )
        self.assertEqual(done.data["actual_start"], "2026-08-10")
        self.assertEqual(done.data["actual_end"], "2026-08-12")
        self.assertIsNone(done.data["planned_start"])
        self.assertEqual(done.data["execution_schedule_status"], "unscheduled")

    def test_17_gantt_returns_planned_actual_variance(self):
        task = self._create_task()
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 11)
        ):
            self._action("project-task-start", task["id"], as_user=self.tech)
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 14)
        ):
            self._action("project-task-complete", task["id"], as_user=self.tech)
        gantt = self.client.get(self.gantt_url)
        self.assertEqual(gantt.status_code, 200, gantt.data)
        row = next(t for t in gantt.data["tasks"] if t["id"] == task["id"])
        self.assertEqual(row["planned_start"], "2026-08-10")
        self.assertEqual(row["actual_start"], "2026-08-11")
        self.assertEqual(row["actual_end"], "2026-08-14")
        self.assertEqual(row["start_variance_days"], 1)
        self.assertEqual(row["completion_variance_days"], 2)
        self.assertEqual(row["execution_schedule_status"], "completed_late")

    def test_18_tenant_isolation_gantt(self):
        self.client.force_authenticate(self.fm_b)
        resp = self.client.get(self.gantt_url)
        self.assertIn(resp.status_code, (403, 404))

    def test_19_accomplishment_unchanged_by_late_dates(self):
        task = self._create_task(
            progress_percentage="50",
            status="in_progress",
        )
        ProjectTask.objects.filter(pk=task["id"]).update(
            actual_start=date(2026, 8, 20),
            planned_end=date(2026, 8, 12),
        )
        from apps.projects.models import Project

        project = Project.objects.get(pk=self.project_id)
        before = calculate_accomplishment(project)
        ProjectTask.objects.filter(pk=task["id"]).update(
            actual_start=date(2026, 8, 10),
        )
        after = calculate_accomplishment(project)
        self.assertEqual(before, after)

    def test_20_acceptance_scenarios_a_b_c(self):
        # A on time
        a = ProjectTask(
            planned_start=date(2026, 8, 10),
            planned_end=date(2026, 8, 12),
            actual_start=date(2026, 8, 10),
            actual_end=date(2026, 8, 12),
            status=ProjectTask.Status.COMPLETED,
        )
        ra = compute_execution_schedule(task=a, today=date(2026, 8, 20))
        self.assertEqual(ra["execution_schedule_status"], "completed_on_time")
        # B late
        b = ProjectTask(
            planned_start=date(2026, 8, 10),
            planned_end=date(2026, 8, 12),
            actual_start=date(2026, 8, 11),
            actual_end=date(2026, 8, 14),
            status=ProjectTask.Status.COMPLETED,
        )
        rb = compute_execution_schedule(task=b, today=date(2026, 8, 20))
        self.assertEqual(rb["start_variance_days"], 1)
        self.assertEqual(rb["completion_variance_days"], 2)
        # C early
        c = ProjectTask(
            planned_start=date(2026, 8, 10),
            planned_end=date(2026, 8, 14),
            actual_start=date(2026, 8, 9),
            actual_end=date(2026, 8, 13),
            status=ProjectTask.Status.COMPLETED,
        )
        rc = compute_execution_schedule(task=c, today=date(2026, 8, 20))
        self.assertEqual(rc["start_variance_days"], -1)
        self.assertEqual(rc["completion_variance_days"], -1)
