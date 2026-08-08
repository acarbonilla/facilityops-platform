"""FO-105 Gantt Chart & Task Dependencies API tests."""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Role, UserRole
from apps.master_data.models import Building, Organization, Tenant
from apps.projects.dependency_service import (
    compute_delay_flags,
    create_dependency,
    get_dependency_readiness,
    soft_delete_dependency,
    would_create_cycle,
)
from apps.projects.models import (
    Project,
    ProjectHistory,
    ProjectMember,
    ProjectTask,
    ProjectTaskDependency,
)
from apps.projects.services import soft_delete_project, soft_delete_task, update_task

User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class ProjectDependencyTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="FO105 Tenant A", code="fo105-a")
        cls.tenant_b = Tenant.objects.create(name="FO105 Tenant B", code="fo105-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="FO105 Org A", code="fo105-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="FO105 Org B", code="fo105-org-b"
        )
        Building.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            name="Building A",
            code="fo105-bldg-a",
        )

        def make_user(email, tenant, org, role_code, *, is_active=True):
            user = User.objects.create_user(
                email=email,
                password="Password123!",
                tenant=tenant,
                organization=org,
                first_name=email.split("@")[0],
                last_name="User",
                is_active=is_active,
            )
            UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
            return user

        cls.fm_a = make_user(
            "fo105-fm-a@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.fm_b = make_user(
            "fo105-fm-b@example.com", cls.tenant_b, cls.org_b, "facility_manager"
        )
        cls.viewer_a = make_user(
            "fo105-viewer-a@example.com", cls.tenant_a, cls.org_a, "viewer"
        )
        cls.employee_a = make_user(
            "fo105-emp-a@example.com", cls.tenant_a, cls.org_a, "employee"
        )
        cls.pm_user = make_user(
            "fo105-pm-a@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.member_user = make_user(
            "fo105-member-a@example.com", cls.tenant_a, cls.org_a, "viewer"
        )

    def setUp(self):
        self._auth(self.fm_a)
        project_resp = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org_a.id),
                "name": "Gantt Host Project",
                "project_manager": str(self.pm_user.id),
                "planned_start_date": str(date.today() - timedelta(days=60)),
                "planned_end_date": str(date.today() + timedelta(days=90)),
            },
            format="json",
        )
        self.assertEqual(
            project_resp.status_code, status.HTTP_201_CREATED, project_resp.data
        )
        self.project_id = project_resp.data["id"]
        self.project = Project.objects.get(pk=self.project_id)
        self.tasks_url = reverse(
            "project-task-list", kwargs={"project_id": self.project_id}
        )
        self.deps_url = reverse(
            "project-dependency-list", kwargs={"project_id": self.project_id}
        )
        self.gantt_url = reverse("project-gantt", kwargs={"pk": self.project_id})
        ProjectMember.objects.create(
            tenant=self.tenant_a,
            project=self.project,
            user=self.member_user,
            role=ProjectMember.Role.MEMBER,
            is_active=True,
            added_by=self.fm_a,
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def _create_task(self, **overrides):
        payload = {"name": "Task"}
        payload.update(overrides)
        self._auth(self.fm_a)
        response = self.client.post(self.tasks_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response.data

    def _task_url(self, task_id):
        return reverse(
            "project-task-detail",
            kwargs={"project_id": self.project_id, "pk": task_id},
        )

    def _dep_url(self, dependency_id):
        return reverse(
            "project-dependency-detail",
            kwargs={"project_id": self.project_id, "pk": dependency_id},
        )

    def _create_dep(self, predecessor_id, successor_id, **extra):
        payload = {
            "predecessor_task": str(predecessor_id),
            "successor_task": str(successor_id),
        }
        payload.update(extra)
        self._auth(self.fm_a)
        response = self.client.post(self.deps_url, payload, format="json")
        return response

    def _complete_task(self, task_id):
        self._auth(self.fm_a)
        response = self.client.patch(
            self._task_url(task_id),
            {
                "person_in_charge": str(self.member_user.id),
                "status": "completed",
                "actual_end": str(date.today()),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        return response.data

    # ------------------------------------------------------------------
    # Auth / permissions
    # ------------------------------------------------------------------

    def test_01_deps_list_requires_auth(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.deps_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_02_employee_denied_deps_and_gantt(self):
        self._auth(self.employee_a)
        self.assertEqual(
            self.client.get(self.deps_url).status_code, status.HTTP_403_FORBIDDEN
        )
        self.assertEqual(
            self.client.get(self.gantt_url).status_code, status.HTTP_403_FORBIDDEN
        )

    def test_03_viewer_can_view_not_manage_deps(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        created = self._create_dep(a["id"], b["id"])
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)

        self._auth(self.viewer_a)
        listed = self.client.get(self.deps_url)
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        gantt = self.client.get(self.gantt_url)
        self.assertEqual(gantt.status_code, status.HTTP_200_OK)
        blocked = self.client.post(
            self.deps_url,
            {
                "predecessor_task": a["id"],
                "successor_task": b["id"],
            },
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)

    def test_04_tenant_isolation_deps_and_gantt(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        self._create_dep(a["id"], b["id"])
        self._auth(self.fm_b)
        self.assertEqual(
            self.client.get(self.deps_url).status_code, status.HTTP_404_NOT_FOUND
        )
        self.assertEqual(
            self.client.get(self.gantt_url).status_code, status.HTTP_404_NOT_FOUND
        )

    # ------------------------------------------------------------------
    # CRUD / uniqueness / type
    # ------------------------------------------------------------------

    def test_05_create_list_retrieve_delete_dependency(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        created = self._create_dep(a["id"], b["id"])
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        self.assertEqual(created.data["dependency_type"], "finish_to_start")
        dep_id = created.data["id"]

        listed = self.client.get(self.deps_url)
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        results = listed.data.get("results", listed.data)
        self.assertEqual(len(results), 1)

        detail = self.client.get(self._dep_url(dep_id))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(str(detail.data["predecessor_task"]), str(a["id"]))

        deleted = self.client.delete(self._dep_url(dep_id))
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(
            ProjectTaskDependency.objects.get(pk=dep_id).is_deleted
        )

    def test_06_duplicate_active_dependency_rejected(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        first = self._create_dep(a["id"], b["id"])
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        second = self._create_dep(a["id"], b["id"])
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_07_soft_deleted_dependency_can_be_recreated(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        first = self._create_dep(a["id"], b["id"])
        soft_delete_dependency(
            dependency=ProjectTaskDependency.objects.get(pk=first.data["id"]),
            actor=self.fm_a,
        )
        second = self._create_dep(a["id"], b["id"])
        self.assertEqual(second.status_code, status.HTTP_201_CREATED, second.data)

    def test_08_self_dependency_rejected(self):
        a = self._create_task(name="A")
        response = self._create_dep(a["id"], a["id"])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_09_only_finish_to_start_allowed(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        response = self._create_dep(
            a["id"], b["id"], dependency_type="start_to_start"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_10_cross_project_task_rejected(self):
        a = self._create_task(name="A")
        other = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org_a.id),
                "name": "Other Project",
                "project_manager": str(self.pm_user.id),
            },
            format="json",
        )
        other_id = other.data["id"]
        other_task = self.client.post(
            reverse("project-task-list", kwargs={"project_id": other_id}),
            {"name": "Other task"},
            format="json",
        )
        response = self._create_dep(a["id"], other_task.data["id"])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # Cycle detection
    # ------------------------------------------------------------------

    def test_11_direct_cycle_rejected(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        self.assertEqual(self._create_dep(a["id"], b["id"]).status_code, 201)
        response = self._create_dep(b["id"], a["id"])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(
            would_create_cycle(self.project.id, b["id"], a["id"])
        )

    def test_12_transitive_cycle_rejected(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        c = self._create_task(name="C")
        self.assertEqual(self._create_dep(a["id"], b["id"]).status_code, 201)
        self.assertEqual(self._create_dep(b["id"], c["id"]).status_code, 201)
        response = self._create_dep(c["id"], a["id"])
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_13_soft_deleted_edge_excluded_from_cycle_graph(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        first = self._create_dep(a["id"], b["id"])
        soft_delete_dependency(
            dependency=ProjectTaskDependency.objects.get(pk=first.data["id"]),
            actor=self.fm_a,
        )
        # A→B deleted; B→A must be allowed (no active path A→…→B).
        response = self._create_dep(b["id"], a["id"])
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    # ------------------------------------------------------------------
    # FS readiness / status gate
    # ------------------------------------------------------------------

    def test_14_successor_not_ready_until_predecessor_completed(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        self._create_dep(a["id"], b["id"])
        readiness = self.client.get(
            reverse(
                "project-task-dependency-readiness",
                kwargs={"project_id": self.project_id, "pk": b["id"]},
            )
        )
        self.assertEqual(readiness.status_code, status.HTTP_200_OK)
        self.assertFalse(readiness.data["is_dependency_ready"])
        self.assertEqual(readiness.data["blocking_predecessor_count"], 1)
        self.assertEqual(readiness.data["predecessor_count"], 1)

        blocked = self.client.patch(
            self._task_url(b["id"]),
            {
                "person_in_charge": str(self.member_user.id),
                "status": "in_progress",
            },
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", blocked.data)
        self.assertEqual(
            str(blocked.data.get("code")[0]), "task_dependency_incomplete"
        )

    def test_15_ready_after_all_predecessors_completed(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        c = self._create_task(name="C")
        self._create_dep(a["id"], c["id"])
        self._create_dep(b["id"], c["id"])
        self._complete_task(a["id"])
        still = get_dependency_readiness(ProjectTask.objects.get(pk=c["id"]))
        self.assertFalse(still["is_dependency_ready"])
        self._complete_task(b["id"])
        ready = get_dependency_readiness(ProjectTask.objects.get(pk=c["id"]))
        self.assertTrue(ready["is_dependency_ready"])
        started = self.client.patch(
            self._task_url(c["id"]),
            {
                "person_in_charge": str(self.member_user.id),
                "status": "in_progress",
            },
            format="json",
        )
        self.assertEqual(started.status_code, status.HTTP_200_OK, started.data)

    def test_16_does_not_auto_set_blocked_status(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        self._create_dep(a["id"], b["id"])
        task_b = ProjectTask.objects.get(pk=b["id"])
        self.assertEqual(task_b.status, ProjectTask.Status.NOT_STARTED)
        detail = self.client.get(self._task_url(b["id"]))
        self.assertFalse(detail.data["is_dependency_ready"])
        self.assertEqual(detail.data["status"], "not_started")

    def test_17_completed_status_also_gated(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        self._create_dep(a["id"], b["id"])
        blocked = self.client.patch(
            self._task_url(b["id"]),
            {
                "person_in_charge": str(self.member_user.id),
                "status": "completed",
            },
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(blocked.data.get("code")[0]), "task_dependency_incomplete"
        )

    def test_18_progress_coerce_to_completed_gated_by_existing_deps(self):
        a = self._create_task(name="A")
        b = self._create_task(
            name="B",
            person_in_charge=str(self.member_user.id),
        )
        c = self._create_task(name="C")
        self._create_dep(a["id"], b["id"])
        self._create_dep(c["id"], b["id"])
        self._complete_task(a["id"])
        self._complete_task(c["id"])
        started = self.client.patch(
            self._task_url(b["id"]),
            {"status": "in_progress"},
            format="json",
        )
        self.assertEqual(started.status_code, status.HTTP_200_OK, started.data)
        # Reopen predecessor C so B is in_progress with an unfinished FS pred.
        reopened = self.client.patch(
            self._task_url(c["id"]),
            {"status": "not_started", "progress_percentage": "0.00"},
            format="json",
        )
        self.assertEqual(reopened.status_code, status.HTTP_200_OK, reopened.data)
        blocked = self.client.patch(
            self._task_url(b["id"]),
            {"progress_percentage": "100.00"},
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            str(blocked.data.get("code")[0]), "task_dependency_incomplete"
        )

    def test_18b_cannot_add_unfinished_predecessor_to_started_successor(self):
        a = self._create_task(name="A")
        b = self._create_task(
            name="B",
            person_in_charge=str(self.member_user.id),
        )
        self._create_dep(a["id"], b["id"])
        self._complete_task(a["id"])
        started = self.client.patch(
            self._task_url(b["id"]),
            {"status": "in_progress"},
            format="json",
        )
        self.assertEqual(started.status_code, status.HTTP_200_OK, started.data)
        c = self._create_task(name="C")
        blocked = self._create_dep(c["id"], b["id"])
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("successor_task", blocked.data)

    def test_18c_completed_predecessor_may_link_to_started_successor(self):
        a = self._create_task(name="A")
        b = self._create_task(
            name="B",
            person_in_charge=str(self.member_user.id),
        )
        c = self._create_task(name="C")
        self._create_dep(a["id"], b["id"])
        self._complete_task(a["id"])
        self._complete_task(c["id"])
        started = self.client.patch(
            self._task_url(b["id"]),
            {"status": "in_progress"},
            format="json",
        )
        self.assertEqual(started.status_code, status.HTTP_200_OK, started.data)
        linked = self._create_dep(c["id"], b["id"])
        self.assertEqual(linked.status_code, status.HTTP_201_CREATED, linked.data)

    # ------------------------------------------------------------------
    # Soft-delete policy
    # ------------------------------------------------------------------

    def test_19_cannot_delete_task_with_active_deps(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        dep = self._create_dep(a["id"], b["id"])
        self.assertEqual(dep.status_code, 201)

        as_pred = self.client.delete(self._task_url(a["id"]))
        self.assertEqual(as_pred.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("predecessor_dependency_count", as_pred.data)
        self.assertEqual(int(str(as_pred.data["predecessor_dependency_count"][0])), 1)

        as_succ = self.client.delete(self._task_url(b["id"]))
        self.assertEqual(as_succ.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(int(str(as_succ.data["successor_dependency_count"][0])), 1)

    def test_20_can_delete_task_after_deps_removed(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        dep = self._create_dep(a["id"], b["id"])
        self.client.delete(self._dep_url(dep.data["id"]))
        deleted = self.client.delete(self._task_url(a["id"]))
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)

    def test_21_soft_deleted_deps_do_not_block_task_delete(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        dep = self._create_dep(a["id"], b["id"])
        soft_delete_dependency(
            dependency=ProjectTaskDependency.objects.get(pk=dep.data["id"]),
            actor=self.fm_a,
        )
        deleted = self.client.delete(self._task_url(a["id"]))
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # Gantt payload
    # ------------------------------------------------------------------

    def test_22_gantt_shape_and_summary(self):
        today = date.today()
        a = self._create_task(
            name="Scheduled",
            planned_start=str(today),
            planned_end=str(today + timedelta(days=5)),
        )
        b = self._create_task(name="Unscheduled")
        c = self._create_task(
            name="Milestone",
            is_milestone=True,
            planned_start=str(today + timedelta(days=10)),
        )
        self._create_dep(a["id"], b["id"])
        response = self.client.get(self.gantt_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("project", response.data)
        self.assertIn("tasks", response.data)
        self.assertIn("dependencies", response.data)
        self.assertIn("summary", response.data)
        summary = response.data["summary"]
        self.assertEqual(summary["total_tasks"], 3)
        self.assertEqual(summary["scheduled_tasks"], 2)  # a + milestone end=start
        self.assertEqual(summary["unscheduled_tasks"], 1)
        self.assertEqual(summary["milestones"], 1)
        self.assertEqual(summary["dependency_blocked_tasks"], 1)

        by_id = {t["id"]: t for t in response.data["tasks"]}
        self.assertTrue(by_id[str(a["id"])]["is_scheduled"])
        self.assertFalse(by_id[str(b["id"])]["is_scheduled"])
        self.assertFalse(by_id[str(b["id"])]["is_dependency_ready"])
        self.assertEqual(by_id[str(b["id"])]["predecessor_ids"], [str(a["id"])])
        self.assertEqual(by_id[str(a["id"])]["successor_ids"], [str(b["id"])])

    def test_23_gantt_excludes_deleted_tasks_and_deps(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        dep = self._create_dep(a["id"], b["id"])
        soft_delete_dependency(
            dependency=ProjectTaskDependency.objects.get(pk=dep.data["id"]),
            actor=self.fm_a,
        )
        soft_delete_task(
            task=ProjectTask.objects.get(pk=b["id"]),
            actor=self.fm_a,
        )
        response = self.client.get(self.gantt_url)
        self.assertEqual(len(response.data["tasks"]), 1)
        self.assertEqual(len(response.data["dependencies"]), 0)

    def test_24_gantt_hidden_for_soft_deleted_project(self):
        soft_delete_project(project=self.project, actor=self.fm_a)
        response = self.client.get(self.gantt_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------------
    # Delay flags
    # ------------------------------------------------------------------

    def test_25_is_delayed_and_delay_days(self):
        today = timezone.localdate()
        task = ProjectTask.objects.create(
            tenant=self.tenant_a,
            project=self.project,
            name="Late",
            status=ProjectTask.Status.NOT_STARTED,
            planned_start=today - timedelta(days=10),
            planned_end=today - timedelta(days=3),
            sequence=1,
        )
        flags = compute_delay_flags(task, today=today)
        self.assertTrue(flags["is_delayed"])
        self.assertFalse(flags["is_completed_late"])
        self.assertEqual(flags["delay_days"], 3)

    def test_26_is_completed_late(self):
        today = timezone.localdate()
        task = ProjectTask.objects.create(
            tenant=self.tenant_a,
            project=self.project,
            name="Finished late",
            status=ProjectTask.Status.COMPLETED,
            progress_percentage=Decimal("100.00"),
            person_in_charge=self.member_user,
            planned_start=today - timedelta(days=10),
            planned_end=today - timedelta(days=5),
            actual_start=today - timedelta(days=10),
            actual_end=today - timedelta(days=1),
            sequence=2,
        )
        flags = compute_delay_flags(task, today=today)
        self.assertFalse(flags["is_delayed"])
        self.assertTrue(flags["is_completed_late"])
        self.assertEqual(flags["delay_days"], 4)

    def test_27_cancelled_not_delayed(self):
        today = timezone.localdate()
        task = ProjectTask.objects.create(
            tenant=self.tenant_a,
            project=self.project,
            name="Cancelled old",
            status=ProjectTask.Status.CANCELLED,
            planned_end=today - timedelta(days=2),
            sequence=3,
        )
        flags = compute_delay_flags(task, today=today)
        self.assertFalse(flags["is_delayed"])
        self.assertEqual(flags["delay_days"], 0)

    def test_28_task_list_includes_derived_fields(self):
        today = timezone.localdate()
        self._create_task(
            name="Late",
            planned_start=str(today - timedelta(days=10)),
            planned_end=str(today - timedelta(days=2)),
        )
        listed = self.client.get(self.tasks_url)
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        row = listed.data["results"][0]
        self.assertIn("is_dependency_ready", row)
        self.assertIn("is_delayed", row)
        self.assertIn("delay_days", row)
        self.assertTrue(row["is_delayed"])

    # ------------------------------------------------------------------
    # Filters
    # ------------------------------------------------------------------

    def test_29_filter_dependency_blocked(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        self._create_dep(a["id"], b["id"])
        blocked = self.client.get(self.tasks_url, {"dependency_blocked": "true"})
        ready = self.client.get(self.tasks_url, {"dependency_blocked": "false"})
        self.assertEqual(len(blocked.data["results"]), 1)
        self.assertEqual(str(blocked.data["results"][0]["id"]), str(b["id"]))
        self.assertEqual(len(ready.data["results"]), 1)
        self.assertEqual(str(ready.data["results"][0]["id"]), str(a["id"]))

    def test_30_filter_delayed_and_unscheduled(self):
        today = timezone.localdate()
        self._create_task(
            name="Delayed",
            planned_start=str(today - timedelta(days=5)),
            planned_end=str(today - timedelta(days=1)),
        )
        self._create_task(name="Open")
        delayed = self.client.get(self.tasks_url, {"delayed": "true"})
        unscheduled = self.client.get(self.tasks_url, {"unscheduled": "true"})
        self.assertEqual(len(delayed.data["results"]), 1)
        self.assertEqual(len(unscheduled.data["results"]), 1)

    def test_31_filter_is_milestone(self):
        self._create_task(name="Normal")
        self._create_task(name="MS", is_milestone=True)
        response = self.client.get(self.tasks_url, {"is_milestone": "true"})
        self.assertEqual(len(response.data["results"]), 1)
        self.assertTrue(response.data["results"][0]["is_milestone"])

    # ------------------------------------------------------------------
    # Predecessors / successors endpoints
    # ------------------------------------------------------------------

    def test_32_predecessors_and_successors_endpoints(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        c = self._create_task(name="C")
        self._create_dep(a["id"], b["id"])
        self._create_dep(b["id"], c["id"])
        preds = self.client.get(
            reverse(
                "project-task-predecessors",
                kwargs={"project_id": self.project_id, "pk": b["id"]},
            )
        )
        succs = self.client.get(
            reverse(
                "project-task-successors",
                kwargs={"project_id": self.project_id, "pk": b["id"]},
            )
        )
        self.assertEqual(len(preds.data), 1)
        self.assertEqual(str(preds.data[0]["predecessor_task"]), str(a["id"]))
        self.assertEqual(len(succs.data), 1)
        self.assertEqual(str(succs.data[0]["successor_task"]), str(c["id"]))

    # ------------------------------------------------------------------
    # History
    # ------------------------------------------------------------------

    def test_33_history_records_dependency_created_and_removed(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        created = self._create_dep(a["id"], b["id"])
        self.client.delete(self._dep_url(created.data["id"]))
        actions = set(
            ProjectHistory.objects.filter(project=self.project).values_list(
                "action", flat=True
            )
        )
        self.assertIn("dependency_created", actions)
        self.assertIn("dependency_removed", actions)

    # ------------------------------------------------------------------
    # RBAC seed
    # ------------------------------------------------------------------

    def test_34_seed_rbac_grants_fo105_permissions(self):
        from apps.access_control.models import Permission, RolePermission

        for code in (
            "projects.gantt.view",
            "projects.dependencies.view",
            "projects.dependencies.manage",
        ):
            self.assertTrue(
                Permission.objects.filter(code=code).exists(),
                f"Missing permission {code}",
            )

        fm = Role.objects.get(code="facility_manager")
        viewer = Role.objects.get(code="viewer")
        for code in (
            "projects.gantt.view",
            "projects.dependencies.view",
            "projects.dependencies.manage",
        ):
            self.assertTrue(
                RolePermission.objects.filter(
                    role=fm, permission__code=code
                ).exists()
            )
        self.assertTrue(
            RolePermission.objects.filter(
                role=viewer, permission__code="projects.gantt.view"
            ).exists()
        )
        self.assertTrue(
            RolePermission.objects.filter(
                role=viewer, permission__code="projects.dependencies.view"
            ).exists()
        )
        self.assertFalse(
            RolePermission.objects.filter(
                role=viewer, permission__code="projects.dependencies.manage"
            ).exists()
        )

    # ------------------------------------------------------------------
    # Service-level extras
    # ------------------------------------------------------------------

    def test_35_service_create_dependency_and_cycle_helper(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        dep = create_dependency(
            project=self.project,
            predecessor_task=ProjectTask.objects.get(pk=a["id"]),
            successor_task=ProjectTask.objects.get(pk=b["id"]),
            actor=self.fm_a,
        )
        self.assertFalse(
            would_create_cycle(self.project.id, a["id"], b["id"])
        )
        self.assertTrue(
            would_create_cycle(self.project.id, b["id"], a["id"])
        )
        self.assertEqual(
            dep.dependency_type,
            ProjectTaskDependency.DependencyType.FINISH_TO_START,
        )

    def test_36_update_task_service_raises_dependency_error(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        create_dependency(
            project=self.project,
            predecessor_task=ProjectTask.objects.get(pk=a["id"]),
            successor_task=ProjectTask.objects.get(pk=b["id"]),
            actor=self.fm_a,
        )
        task_b = ProjectTask.objects.get(pk=b["id"])
        with self.assertRaises(DjangoValidationError) as ctx:
            update_task(
                task=task_b,
                data={
                    "person_in_charge": self.member_user,
                    "status": ProjectTask.Status.IN_PROGRESS,
                },
                actor=self.fm_a,
            )
        self.assertIn("status", ctx.exception.message_dict)
        self.assertEqual(
            ctx.exception.message_dict.get("code"),
            ["task_dependency_incomplete"],
        )

    def test_37_milestone_equal_start_end_is_scheduled(self):
        today = date.today()
        ms = self._create_task(
            name="MS",
            is_milestone=True,
            planned_start=str(today),
        )
        self.assertEqual(ms["planned_start"], ms["planned_end"])
        gantt = self.client.get(self.gantt_url)
        row = next(t for t in gantt.data["tasks"] if t["id"] == str(ms["id"]))
        self.assertTrue(row["is_scheduled"])
        self.assertTrue(row["is_milestone"])

    def test_38_deps_queryset_excludes_deleted_project(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        self._create_dep(a["id"], b["id"])
        soft_delete_project(project=self.project, actor=self.fm_a)
        self.assertEqual(
            self.client.get(self.deps_url).status_code, status.HTTP_404_NOT_FOUND
        )

    def test_39_blocking_predecessors_payload_shape(self):
        a = self._create_task(name="Pred")
        b = self._create_task(name="Succ")
        self._create_dep(a["id"], b["id"])
        readiness = get_dependency_readiness(ProjectTask.objects.get(pk=b["id"]))
        blocking = readiness["blocking_predecessors"][0]
        self.assertEqual(blocking["id"], str(a["id"]))
        self.assertIn("task_code", blocking)
        self.assertIn("name", blocking)
        self.assertIn("status", blocking)
        self.assertIn("planned_end", blocking)

    def test_40_not_started_allowed_while_blocked(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        self._create_dep(a["id"], b["id"])
        # Renaming while dependency-blocked is fine.
        patched = self.client.patch(
            self._task_url(b["id"]),
            {"name": "Still waiting"},
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertEqual(patched.data["name"], "Still waiting")
        self.assertFalse(patched.data["is_dependency_ready"])

    def test_41_on_hold_and_blocked_status_not_gated(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        self._create_dep(a["id"], b["id"])
        for target in ("on_hold", "blocked"):
            response = self.client.patch(
                self._task_url(b["id"]),
                {"status": target},
                format="json",
            )
            self.assertEqual(
                response.status_code, status.HTTP_200_OK, response.data
            )

    def test_42_diamond_dependency_all_preds_required(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        c = self._create_task(name="C")
        d = self._create_task(name="D")
        for pred in (a, b, c):
            self.assertEqual(
                self._create_dep(pred["id"], d["id"]).status_code, 201
            )
        readiness = get_dependency_readiness(ProjectTask.objects.get(pk=d["id"]))
        self.assertEqual(readiness["blocking_predecessor_count"], 3)
        self._complete_task(a["id"])
        self._complete_task(b["id"])
        readiness = get_dependency_readiness(ProjectTask.objects.get(pk=d["id"]))
        self.assertEqual(readiness["blocking_predecessor_count"], 1)
        self._complete_task(c["id"])
        readiness = get_dependency_readiness(ProjectTask.objects.get(pk=d["id"]))
        self.assertTrue(readiness["is_dependency_ready"])

    def test_43_gantt_delayed_count(self):
        today = timezone.localdate()
        self._create_task(
            name="Late",
            planned_start=str(today - timedelta(days=5)),
            planned_end=str(today - timedelta(days=1)),
        )
        self._create_task(
            name="On track",
            planned_start=str(today),
            planned_end=str(today + timedelta(days=5)),
        )
        gantt = self.client.get(self.gantt_url)
        self.assertEqual(gantt.data["summary"]["delayed_tasks"], 1)

    def test_44_deleted_task_excluded_from_active_dependency_list(self):
        a = self._create_task(name="A")
        b = self._create_task(name="B")
        dep = self._create_dep(a["id"], b["id"])
        # Soft-delete dep first so task B can be deleted.
        soft_delete_dependency(
            dependency=ProjectTaskDependency.objects.get(pk=dep.data["id"]),
            actor=self.fm_a,
        )
        listed = self.client.get(self.deps_url)
        results = listed.data.get("results", listed.data)
        self.assertEqual(len(results), 0)
