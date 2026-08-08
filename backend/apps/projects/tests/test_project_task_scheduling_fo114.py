"""FO-114 Project Task scheduling & milestone refinement tests."""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Role, UserRole
from apps.master_data.models import Organization, Tenant
from apps.projects.dependency_service import compute_delay_flags, is_task_scheduled
from apps.projects.models import ProjectMember, ProjectTask
from apps.projects.progress_service import calculate_accomplishment

User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class ProjectTaskSchedulingFO114Tests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant = Tenant.objects.create(name="FO114 Tenant", code="fo114-a")
        cls.org = Organization.objects.create(
            tenant=cls.tenant, name="FO114 Org", code="fo114-org"
        )

        def make_user(email, role_code):
            user = User.objects.create_user(
                email=email,
                password="Password123!",
                tenant=cls.tenant,
                organization=cls.org,
                first_name=email.split("@")[0],
                last_name="User",
            )
            UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
            return user

        cls.fm = make_user("fo114-fm@example.com", "facility_manager")
        cls.tech = make_user("fo114-tech@example.com", "technician")

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
        self.deps_url = reverse(
            "project-dependency-list", kwargs={"project_id": self.project_id}
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
        payload = {"name": overrides.pop("name", "Task")}
        payload.update(overrides)
        response = self.client.post(self.tasks_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response.data

    def _patch_task(self, task_id, **overrides):
        url = reverse(
            "project-task-detail",
            kwargs={"project_id": self.project_id, "pk": task_id},
        )
        return self.client.patch(url, overrides, format="json")

    def _create_dep(self, predecessor_id, successor_id):
        return self.client.post(
            self.deps_url,
            {
                "predecessor_task": predecessor_id,
                "successor_task": successor_id,
            },
            format="json",
        )

    def test_01_unscheduled_task_accepted(self):
        task = self._create_task(name="Unscheduled Prep")
        self.assertIsNone(task["planned_start"])
        self.assertIsNone(task["planned_end"])
        self.assertFalse(task["is_milestone"])

    def test_02_normal_date_range_accepted(self):
        task = self._create_task(
            name="Remove Tiles",
            planned_start="2026-08-11",
            planned_end="2026-08-12",
        )
        self.assertEqual(task["planned_start"], "2026-08-11")
        self.assertEqual(task["planned_end"], "2026-08-12")
        self.assertFalse(task["is_milestone"])

    def test_03_same_day_normal_task_accepted(self):
        task = self._create_task(
            name="Inspect Area",
            planned_start="2026-08-10",
            planned_end="2026-08-10",
        )
        self.assertEqual(task["planned_start"], task["planned_end"])
        self.assertFalse(task["is_milestone"])

    def test_04_start_after_end_rejected(self):
        response = self.client.post(
            self.tasks_url,
            {
                "name": "Bad Range",
                "planned_start": "2026-08-15",
                "planned_end": "2026-08-12",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("planned_end", response.data)

    def test_05_identical_and_overlapping_ranges_allowed(self):
        a = self._create_task(
            name="A",
            planned_start="2026-08-11",
            planned_end="2026-08-12",
        )
        b = self._create_task(
            name="B",
            planned_start="2026-08-11",
            planned_end="2026-08-12",
        )
        c = self._create_task(
            name="C",
            planned_start="2026-08-11",
            planned_end="2026-08-13",
        )
        self.assertEqual(a["planned_start"], b["planned_start"])
        self.assertEqual(c["planned_start"], "2026-08-11")
        # Overlap alone does not create a dependency.
        deps = self.client.get(self.deps_url)
        results = deps.data.get("results", deps.data)
        self.assertEqual(len(results), 0)

    def test_06_missing_dates_do_not_imply_milestone(self):
        task = self._create_task(name="No Dates")
        self.assertFalse(task["is_milestone"])
        gantt = self.client.get(self.gantt_url)
        row = next(t for t in gantt.data["tasks"] if t["id"] == str(task["id"]))
        self.assertFalse(row["is_milestone"])
        self.assertFalse(row["is_scheduled"])

    def test_07_milestone_requires_explicit_flag_and_date(self):
        rejected = self.client.post(
            self.tasks_url,
            {"name": "Bad MS", "is_milestone": True},
            format="json",
        )
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)

        ms = self._create_task(
            name="Floor Approved",
            is_milestone=True,
            planned_start="2026-08-14",
        )
        self.assertTrue(ms["is_milestone"])
        self.assertEqual(ms["planned_start"], "2026-08-14")
        self.assertEqual(ms["planned_end"], "2026-08-14")

    def test_08_partial_schedule_rejected(self):
        start_only = self.client.post(
            self.tasks_url,
            {"name": "Start Only", "planned_start": "2026-08-11"},
            format="json",
        )
        self.assertEqual(start_only.status_code, status.HTTP_400_BAD_REQUEST)
        end_only = self.client.post(
            self.tasks_url,
            {"name": "End Only", "planned_end": "2026-08-12"},
            format="json",
        )
        self.assertEqual(end_only.status_code, status.HTTP_400_BAD_REQUEST)

    def test_09_outside_project_window_rejected(self):
        response = self.client.post(
            self.tasks_url,
            {
                "name": "Outside",
                "planned_start": "2026-08-01",
                "planned_end": "2026-08-02",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_10_unscheduled_not_delayed_scheduled_overdue_is(self):
        unscheduled = ProjectTask.objects.get(
            pk=self._create_task(name="No Schedule")["id"]
        )
        flags = compute_delay_flags(unscheduled, today=date(2026, 8, 25))
        self.assertFalse(flags["is_delayed"])
        self.assertFalse(is_task_scheduled(unscheduled))

        overdue = ProjectTask.objects.get(
            pk=self._create_task(
                name="Late",
                planned_start="2026-08-10",
                planned_end="2026-08-12",
            )["id"]
        )
        flags = compute_delay_flags(overdue, today=date(2026, 8, 25))
        self.assertTrue(flags["is_delayed"])

    def test_11_unscheduled_and_same_day_contribute_to_accomplishment(self):
        self._create_task(
            name="Scheduled Done",
            status="completed",
            person_in_charge=str(self.fm.id),
            planned_start="2026-08-10",
            planned_end="2026-08-10",
        )
        self._create_task(
            name="Unscheduled Half",
            status="in_progress",
            person_in_charge=str(self.tech.id),
            progress_percentage="50.00",
        )
        from apps.projects.models import Project

        project = Project.objects.get(pk=self.project_id)
        self.assertEqual(calculate_accomplishment(project), Decimal("75.00"))

    def test_12_dependency_without_dates_allowed(self):
        a = self._create_task(
            name="Remove Tiles",
            person_in_charge=str(self.fm.id),
        )
        b = self._create_task(
            name="Prepare Surface",
            person_in_charge=str(self.fm.id),
        )
        dep = self._create_dep(a["id"], b["id"])
        self.assertEqual(dep.status_code, status.HTTP_201_CREATED, dep.data)

        start_b = self.client.post(
            reverse(
                "project-task-start",
                kwargs={"project_id": self.project_id, "pk": b["id"]},
            ),
            {},
            format="json",
        )
        # Readiness still requires predecessor completion even without dates.
        self.assertEqual(start_b.status_code, status.HTTP_400_BAD_REQUEST)

    def test_13_fs_schedule_conflict_rejected_same_day_boundary_allowed(self):
        pred = self._create_task(
            name="Pred",
            planned_start="2026-08-10",
            planned_end="2026-08-12",
        )
        succ = self._create_task(
            name="Succ",
            planned_start="2026-08-13",
            planned_end="2026-08-14",
        )
        ok = self._create_dep(pred["id"], succ["id"])
        self.assertEqual(ok.status_code, status.HTTP_201_CREATED, ok.data)

        conflict = self._patch_task(
            succ["id"],
            planned_start="2026-08-11",
            planned_end="2026-08-14",
        )
        self.assertEqual(conflict.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(
            "task_schedule_dependency_conflict" in conflict.data
            or "planned_start" in conflict.data
        )

        same_day = self._create_task(
            name="Same Day FS",
            planned_start="2026-08-12",
            planned_end="2026-08-12",
        )
        # successor_start >= predecessor_end allowed on same calendar day.
        boundary = self._create_dep(pred["id"], same_day["id"])
        self.assertEqual(
            boundary.status_code, status.HTTP_201_CREATED, boundary.data
        )

    def test_14_gantt_milestone_flag_from_is_milestone_only(self):
        same_day = self._create_task(
            name="One Day",
            planned_start="2026-08-10",
            planned_end="2026-08-10",
        )
        ms = self._create_task(
            name="Acceptance",
            is_milestone=True,
            planned_start="2026-08-20",
        )
        gantt = self.client.get(self.gantt_url)
        by_id = {t["id"]: t for t in gantt.data["tasks"]}
        self.assertFalse(by_id[str(same_day["id"])]["is_milestone"])
        self.assertTrue(by_id[str(ms["id"])]["is_milestone"])

    def test_15_technician_can_execute_unscheduled_assigned_task(self):
        task = self._create_task(
            name="Unscheduled Exec",
            person_in_charge=str(self.tech.id),
        )
        self.client.force_authenticate(self.tech)
        started = self.client.post(
            reverse(
                "project-task-start",
                kwargs={"project_id": self.project_id, "pk": task["id"]},
            ),
            {},
            format="json",
        )
        self.assertEqual(started.status_code, status.HTTP_200_OK, started.data)
        self.assertEqual(started.data["status"], "in_progress")

        my_work = self.client.get(reverse("project-my-work"))
        self.assertEqual(my_work.status_code, status.HTTP_200_OK, my_work.data)
        unscheduled_ids = {row["id"] for row in my_work.data["unscheduled"]}
        # After start it may leave unscheduled bucket depending on status filters;
        # ensure the task remains present somewhere in the dashboard payload.
        all_ids = set()
        for key in (
            "overdue",
            "due_today",
            "due_this_week",
            "in_progress",
            "upcoming",
            "unscheduled",
            "recently_completed",
        ):
            all_ids.update(row["id"] for row in my_work.data.get(key, []))
        self.assertIn(str(task["id"]), all_ids)

    def test_16_unscheduled_appears_in_my_work_bucket_before_start(self):
        task = self._create_task(
            name="Bucket Unscheduled",
            person_in_charge=str(self.tech.id),
        )
        self.client.force_authenticate(self.tech)
        my_work = self.client.get(reverse("project-my-work"))
        self.assertEqual(my_work.status_code, status.HTTP_200_OK, my_work.data)
        self.assertIn(
            str(task["id"]),
            {row["id"] for row in my_work.data["unscheduled"]},
        )
