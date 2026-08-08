"""FO-104 Project Task & Assignment Management API tests."""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Role, UserRole
from apps.master_data.models import Building, Organization, Tenant
from apps.projects.models import (
    Project,
    ProjectHistory,
    ProjectMember,
    ProjectTask,
    ProjectTaskChecklistItem,
    ProjectTaskComment,
)
from apps.projects.services import soft_delete_task

User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class ProjectTaskTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="FO104 Tenant A", code="fo104-a")
        cls.tenant_b = Tenant.objects.create(name="FO104 Tenant B", code="fo104-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="FO104 Org A", code="fo104-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="FO104 Org B", code="fo104-org-b"
        )
        cls.building_a = Building.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            name="Building A",
            code="fo104-bldg-a",
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
            "fo104-fm-a@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.fm_b = make_user(
            "fo104-fm-b@example.com", cls.tenant_b, cls.org_b, "facility_manager"
        )
        cls.viewer_a = make_user(
            "fo104-viewer-a@example.com", cls.tenant_a, cls.org_a, "viewer"
        )
        cls.employee_a = make_user(
            "fo104-emp-a@example.com", cls.tenant_a, cls.org_a, "employee"
        )
        cls.pm_user = make_user(
            "fo104-pm-a@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.member_user = make_user(
            "fo104-member-a@example.com", cls.tenant_a, cls.org_a, "viewer"
        )
        cls.inactive_user = make_user(
            "fo104-inactive@example.com",
            cls.tenant_a,
            cls.org_a,
            "viewer",
            is_active=False,
        )
        cls.other_tenant_user = make_user(
            "fo104-other@example.com", cls.tenant_b, cls.org_b, "facility_manager"
        )

    def setUp(self):
        self._auth(self.fm_a)
        project_resp = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org_a.id),
                "name": "Task Host Project",
                "project_manager": str(self.pm_user.id),
                "planned_start_date": str(date.today()),
                "planned_end_date": str(date.today() + timedelta(days=60)),
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
        # Active member for PIC assignment tests.
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

    def _task_url(self, task_id):
        return reverse(
            "project-task-detail",
            kwargs={"project_id": self.project_id, "pk": task_id},
        )

    def _create_task(self, **overrides):
        payload = {"name": "Install valves", "description": "Phase 1"}
        payload.update(overrides)
        self._auth(self.fm_a)
        response = self.client.post(self.tasks_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response

    # ------------------------------------------------------------------
    # Auth / tenant
    # ------------------------------------------------------------------

    def test_01_list_requires_auth(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(self.tasks_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_02_employee_denied_task_list(self):
        self._auth(self.employee_a)
        response = self.client.get(self.tasks_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_03_viewer_can_list_not_create(self):
        self._create_task()
        self._auth(self.viewer_a)
        listed = self.client.get(self.tasks_url)
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        created = self.client.post(
            self.tasks_url, {"name": "Viewer blocked"}, format="json"
        )
        self.assertEqual(created.status_code, status.HTTP_403_FORBIDDEN)

    def test_04_tenant_isolation(self):
        created = self._create_task()
        self._auth(self.fm_b)
        listed = self.client.get(self.tasks_url)
        self.assertEqual(listed.status_code, status.HTTP_404_NOT_FOUND)
        detail = self.client.get(self._task_url(created.data["id"]))
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------------
    # Task code / CRUD
    # ------------------------------------------------------------------

    def test_05_task_code_generated(self):
        response = self._create_task()
        self.assertTrue(response.data["task_code"].startswith(f"{self.project.project_code}-T"))
        self.assertTrue(response.data["task_code"].endswith("001"))

    def test_06_task_codes_sequential_and_never_reuse(self):
        first = self._create_task(name="T1")
        second = self._create_task(name="T2")
        self.assertEqual(first.data["task_code"][-3:], "001")
        self.assertEqual(second.data["task_code"][-3:], "002")
        soft_delete_task(
            task=ProjectTask.objects.get(pk=first.data["id"]),
            actor=self.fm_a,
        )
        third = self._create_task(name="T3")
        self.assertEqual(third.data["task_code"][-3:], "003")

    def test_07_create_retrieve_update_delete(self):
        created = self._create_task(name="Original")
        task_id = created.data["id"]
        detail = self.client.get(self._task_url(task_id))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["name"], "Original")

        patched = self.client.patch(
            self._task_url(task_id),
            {"name": "Renamed", "priority": ProjectTask.Priority.HIGH},
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertEqual(patched.data["name"], "Renamed")
        self.assertEqual(patched.data["priority"], ProjectTask.Priority.HIGH)

        deleted = self.client.delete(self._task_url(task_id))
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        task = ProjectTask.objects.get(pk=task_id)
        self.assertTrue(task.is_deleted)
        missing = self.client.get(self._task_url(task_id))
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)

    def test_08_soft_delete_completed_task_allowed(self):
        created = self._create_task(
            person_in_charge=str(self.pm_user.id),
            status=ProjectTask.Status.COMPLETED,
        )
        deleted = self.client.delete(self._task_url(created.data["id"]))
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(
            ProjectTask.objects.get(pk=created.data["id"]).is_deleted
        )

    def test_09_default_status_and_progress(self):
        created = self._create_task()
        self.assertEqual(created.data["status"], ProjectTask.Status.NOT_STARTED)
        self.assertEqual(Decimal(created.data["progress_percentage"]), Decimal("0.00"))

    # ------------------------------------------------------------------
    # Progress / status sync
    # ------------------------------------------------------------------

    def test_10_completed_forces_progress_100(self):
        created = self._create_task(person_in_charge=str(self.pm_user.id))
        patched = self.client.patch(
            self._task_url(created.data["id"]),
            {
                "status": ProjectTask.Status.COMPLETED,
                "progress_percentage": "40.00",
            },
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertEqual(patched.data["status"], ProjectTask.Status.COMPLETED)
        self.assertEqual(Decimal(patched.data["progress_percentage"]), Decimal("100.00"))

    def test_11_not_started_forces_progress_0(self):
        created = self._create_task(
            person_in_charge=str(self.pm_user.id),
            status=ProjectTask.Status.IN_PROGRESS,
            progress_percentage="50.00",
        )
        patched = self.client.patch(
            self._task_url(created.data["id"]),
            {"status": ProjectTask.Status.NOT_STARTED},
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertEqual(Decimal(patched.data["progress_percentage"]), Decimal("0.00"))

    def test_12_cancelled_preserves_progress(self):
        created = self._create_task(
            person_in_charge=str(self.pm_user.id),
            status=ProjectTask.Status.IN_PROGRESS,
            progress_percentage="45.00",
        )
        patched = self.client.patch(
            self._task_url(created.data["id"]),
            {"status": ProjectTask.Status.CANCELLED},
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertEqual(Decimal(patched.data["progress_percentage"]), Decimal("45.00"))

    def test_13_in_progress_zero_coerces_to_one(self):
        created = self._create_task(person_in_charge=str(self.pm_user.id))
        patched = self.client.patch(
            self._task_url(created.data["id"]),
            {
                "status": ProjectTask.Status.IN_PROGRESS,
                "progress_percentage": "0.00",
            },
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertEqual(patched.data["status"], ProjectTask.Status.IN_PROGRESS)
        self.assertEqual(Decimal(patched.data["progress_percentage"]), Decimal("1.00"))

    def test_14_in_progress_100_coerces_to_completed(self):
        created = self._create_task(person_in_charge=str(self.pm_user.id))
        patched = self.client.patch(
            self._task_url(created.data["id"]),
            {
                "status": ProjectTask.Status.IN_PROGRESS,
                "progress_percentage": "100.00",
            },
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertEqual(patched.data["status"], ProjectTask.Status.COMPLETED)
        self.assertEqual(Decimal(patched.data["progress_percentage"]), Decimal("100.00"))

    def test_15_blocked_preserves_progress(self):
        created = self._create_task(
            person_in_charge=str(self.pm_user.id),
            status=ProjectTask.Status.IN_PROGRESS,
            progress_percentage="30.00",
        )
        patched = self.client.patch(
            self._task_url(created.data["id"]),
            {"status": ProjectTask.Status.BLOCKED},
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertEqual(Decimal(patched.data["progress_percentage"]), Decimal("30.00"))

    def test_16_progress_out_of_range_rejected(self):
        created = self._create_task()
        patched = self.client.patch(
            self._task_url(created.data["id"]),
            {"progress_percentage": "150.00"},
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # PIC rules
    # ------------------------------------------------------------------

    def test_17_pic_optional_on_create(self):
        created = self._create_task()
        self.assertIsNone(created.data["person_in_charge"])

    def test_18_pic_required_for_in_progress(self):
        created = self._create_task()
        patched = self.client.patch(
            self._task_url(created.data["id"]),
            {"status": ProjectTask.Status.IN_PROGRESS, "progress_percentage": "10"},
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("person_in_charge", patched.data)

    def test_19_pic_required_for_completed(self):
        created = self._create_task()
        patched = self.client.patch(
            self._task_url(created.data["id"]),
            {"status": ProjectTask.Status.COMPLETED},
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_400_BAD_REQUEST)

    def test_20_pic_project_manager_allowed(self):
        created = self._create_task(person_in_charge=str(self.pm_user.id))
        self.assertEqual(str(created.data["person_in_charge"]), str(self.pm_user.id))

    def test_21_pic_active_member_allowed(self):
        created = self._create_task(person_in_charge=str(self.member_user.id))
        self.assertEqual(
            str(created.data["person_in_charge"]), str(self.member_user.id)
        )

    def test_22_pic_inactive_rejected(self):
        response = self.client.post(
            self.tasks_url,
            {
                "name": "Bad PIC",
                "person_in_charge": str(self.inactive_user.id),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_23_pic_other_tenant_rejected(self):
        response = self.client.post(
            self.tasks_url,
            {
                "name": "Bad PIC tenant",
                "person_in_charge": str(self.other_tenant_user.id),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_24_pic_non_member_rejected(self):
        stranger = User.objects.create_user(
            email="fo104-stranger@example.com",
            password="Password123!",
            tenant=self.tenant_a,
            organization=self.org_a,
        )
        response = self.client.post(
            self.tasks_url,
            {"name": "No member", "person_in_charge": str(stranger.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_25_assign_endpoint(self):
        created = self._create_task()
        url = reverse(
            "project-task-assign",
            kwargs={"project_id": self.project_id, "pk": created.data["id"]},
        )
        assigned = self.client.post(
            url, {"person_in_charge": str(self.member_user.id)}, format="json"
        )
        self.assertEqual(assigned.status_code, status.HTTP_200_OK, assigned.data)
        self.assertEqual(
            str(assigned.data["person_in_charge"]), str(self.member_user.id)
        )

    def test_26_assign_idempotent_same_pic(self):
        created = self._create_task(person_in_charge=str(self.pm_user.id))
        url = reverse(
            "project-task-assign",
            kwargs={"project_id": self.project_id, "pk": created.data["id"]},
        )
        before = ProjectHistory.objects.filter(
            project=self.project, action="task_assigned"
        ).count()
        again = self.client.post(
            url, {"person_in_charge_id": str(self.pm_user.id)}, format="json"
        )
        self.assertEqual(again.status_code, status.HTTP_200_OK, again.data)
        after = ProjectHistory.objects.filter(
            project=self.project, action="task_assigned"
        ).count()
        self.assertEqual(before, after)

    # ------------------------------------------------------------------
    # Schedule / milestone
    # ------------------------------------------------------------------

    def test_27_planned_end_before_start_rejected(self):
        response = self.client.post(
            self.tasks_url,
            {
                "name": "Bad dates",
                "planned_start": str(date.today() + timedelta(days=10)),
                "planned_end": str(date.today()),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_28_task_dates_outside_project_window_rejected(self):
        response = self.client.post(
            self.tasks_url,
            {
                "name": "Outside",
                "planned_start": str(date.today() - timedelta(days=5)),
                "planned_end": str(date.today() + timedelta(days=1)),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_29_incomplete_project_schedule_allows_any_range(self):
        self._auth(self.fm_a)
        project = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org_a.id),
                "name": "No schedule",
            },
            format="json",
        )
        url = reverse(
            "project-task-list", kwargs={"project_id": project.data["id"]}
        )
        response = self.client.post(
            url,
            {
                "name": "Any dates",
                "planned_start": str(date.today() - timedelta(days=100)),
                "planned_end": str(date.today() + timedelta(days=100)),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_30_milestone_zero_duration(self):
        start = date.today() + timedelta(days=5)
        response = self._create_task(
            name="Milestone",
            is_milestone=True,
            planned_start=str(start),
        )
        self.assertEqual(response.data["planned_start"], str(start))
        self.assertEqual(response.data["planned_end"], str(start))

    # ------------------------------------------------------------------
    # Checklist / comments / reorder / summary
    # ------------------------------------------------------------------

    def test_31_checklist_crud(self):
        created = self._create_task()
        task_id = created.data["id"]
        checklist_url = reverse(
            "project-task-checklist",
            kwargs={"project_id": self.project_id, "pk": task_id},
        )
        created_item = self.client.post(
            checklist_url, {"text": "Shut valves"}, format="json"
        )
        self.assertEqual(
            created_item.status_code, status.HTTP_201_CREATED, created_item.data
        )
        item_id = created_item.data["id"]
        listed = self.client.get(checklist_url)
        self.assertEqual(len(listed.data), 1)

        item_url = reverse(
            "project-task-checklist-item",
            kwargs={
                "project_id": self.project_id,
                "pk": task_id,
                "item_id": item_id,
            },
        )
        patched = self.client.patch(
            item_url, {"is_completed": True}, format="json"
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertTrue(patched.data["is_completed"])
        self.assertIsNotNone(patched.data["completed_at"])

        deleted = self.client.delete(item_url)
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(
            ProjectTaskChecklistItem.objects.get(pk=item_id).is_deleted
        )

    def test_32_comments_crud(self):
        created = self._create_task()
        task_id = created.data["id"]
        comments_url = reverse(
            "project-task-comments",
            kwargs={"project_id": self.project_id, "pk": task_id},
        )
        created_comment = self.client.post(
            comments_url, {"body": "Internal note"}, format="json"
        )
        self.assertEqual(
            created_comment.status_code,
            status.HTTP_201_CREATED,
            created_comment.data,
        )
        self.assertTrue(created_comment.data["is_internal"])
        comment_id = created_comment.data["id"]

        listed = self.client.get(comments_url)
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(listed.data["count"], 1)

        detail = self.client.get(self._task_url(task_id))
        self.assertEqual(detail.data["comments_count"], 1)

        delete_url = reverse(
            "project-task-comment-detail",
            kwargs={
                "project_id": self.project_id,
                "pk": task_id,
                "comment_id": comment_id,
            },
        )
        deleted = self.client.delete(delete_url)
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(ProjectTaskComment.objects.get(pk=comment_id).is_deleted)

    def test_33_viewer_cannot_comment(self):
        created = self._create_task()
        comments_url = reverse(
            "project-task-comments",
            kwargs={"project_id": self.project_id, "pk": created.data["id"]},
        )
        self._auth(self.viewer_a)
        response = self.client.post(
            comments_url, {"body": "Nope"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_34_reorder_tasks(self):
        t1 = self._create_task(name="A")
        t2 = self._create_task(name="B")
        t3 = self._create_task(name="C")
        reorder_url = reverse(
            "project-task-reorder", kwargs={"project_id": self.project_id}
        )
        response = self.client.post(
            reorder_url,
            {
                "task_ids": [
                    t3.data["id"],
                    t1.data["id"],
                    t2.data["id"],
                ]
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        order = [row["id"] for row in response.data]
        self.assertEqual(
            order,
            [t3.data["id"], t1.data["id"], t2.data["id"]],
        )

    def test_35_task_summary_on_project_detail(self):
        self._create_task()
        self._create_task(
            name="Done",
            person_in_charge=str(self.pm_user.id),
            status=ProjectTask.Status.COMPLETED,
        )
        detail = self.client.get(reverse("project-detail", args=[self.project_id]))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        summary = detail.data["task_summary"]
        self.assertEqual(summary["total"], 2)
        self.assertEqual(summary["not_started"], 1)
        self.assertEqual(summary["completed"], 1)

    def test_36_task_summary_endpoint(self):
        self._create_task()
        url = reverse("project-task-summary", args=[self.project_id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], 1)

    # ------------------------------------------------------------------
    # Filters / history / permissions alias
    # ------------------------------------------------------------------

    def test_37_filters_search_ordering(self):
        self._create_task(
            name="Alpha Task",
            priority=ProjectTask.Priority.HIGH,
            person_in_charge=str(self.pm_user.id),
            is_milestone=True,
            planned_start=str(date.today() + timedelta(days=1)),
            planned_end=str(date.today() + timedelta(days=2)),
        )
        self._create_task(name="Beta Task", priority=ProjectTask.Priority.LOW)

        search = self.client.get(self.tasks_url, {"search": "Alpha"})
        self.assertTrue(any("Alpha" in row["name"] for row in search.data["results"]))

        by_status = self.client.get(
            self.tasks_url, {"status": ProjectTask.Status.NOT_STARTED}
        )
        self.assertTrue(
            all(
                row["status"] == ProjectTask.Status.NOT_STARTED
                for row in by_status.data["results"]
            )
        )

        by_priority = self.client.get(
            self.tasks_url, {"priority": ProjectTask.Priority.HIGH}
        )
        self.assertTrue(
            all(
                row["priority"] == ProjectTask.Priority.HIGH
                for row in by_priority.data["results"]
            )
        )

        by_pic = self.client.get(
            self.tasks_url, {"person_in_charge": str(self.pm_user.id)}
        )
        self.assertGreaterEqual(by_pic.data["count"], 1)

        milestones = self.client.get(self.tasks_url, {"is_milestone": "true"})
        self.assertTrue(all(row["is_milestone"] for row in milestones.data["results"]))

        ordered = self.client.get(self.tasks_url, {"ordering": "name"})
        names = [row["name"] for row in ordered.data["results"]]
        self.assertEqual(names, sorted(names))

        progress = self.client.get(
            self.tasks_url, {"progress_min": "0", "progress_max": "0"}
        )
        self.assertEqual(progress.status_code, status.HTTP_200_OK)

    def test_38_history_recorded(self):
        created = self._create_task(name="History task")
        task_id = created.data["id"]
        self.client.patch(
            self._task_url(task_id),
            {
                "person_in_charge": str(self.pm_user.id),
                "status": ProjectTask.Status.IN_PROGRESS,
                "progress_percentage": "20",
            },
            format="json",
        )
        actions = set(
            ProjectHistory.objects.filter(project=self.project).values_list(
                "action", flat=True
            )
        )
        self.assertIn("task_created", actions)
        self.assertIn("task_updated", actions)
        self.assertIn("task_status_changed", actions)
        self.assertIn("task_assigned", actions)

    def test_39_projects_manage_alias_allows_task_create(self):
        # facility_manager has projects.manage — already covered; assert create works.
        self._auth(self.fm_a)
        response = self.client.post(
            self.tasks_url, {"name": "Via manage"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_40_on_hold_preserves_progress(self):
        created = self._create_task(
            person_in_charge=str(self.pm_user.id),
            status=ProjectTask.Status.IN_PROGRESS,
            progress_percentage="55.00",
        )
        patched = self.client.patch(
            self._task_url(created.data["id"]),
            {"status": ProjectTask.Status.ON_HOLD},
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertEqual(Decimal(patched.data["progress_percentage"]), Decimal("55.00"))

    def test_41_actual_dates_not_writable_via_patch(self):
        """FO-115B: Actual Start/End are system-derived — not client PATCH fields."""
        created = self._create_task()
        patched = self.client.patch(
            self._task_url(created.data["id"]),
            {
                "actual_start": str(date.today() + timedelta(days=2)),
                "actual_end": str(date.today()),
            },
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertIsNone(patched.data.get("actual_start"))
        self.assertIsNone(patched.data.get("actual_end"))

    def test_42_detail_includes_checklist_and_comments(self):
        created = self._create_task()
        task_id = created.data["id"]
        self.client.post(
            reverse(
                "project-task-checklist",
                kwargs={"project_id": self.project_id, "pk": task_id},
            ),
            {"text": "Check A"},
            format="json",
        )
        self.client.post(
            reverse(
                "project-task-comments",
                kwargs={"project_id": self.project_id, "pk": task_id},
            ),
            {"body": "Note"},
            format="json",
        )
        detail = self.client.get(self._task_url(task_id))
        self.assertEqual(len(detail.data["checklist_items"]), 1)
        self.assertEqual(len(detail.data["comments"]), 1)

    def test_43_empty_comment_rejected(self):
        created = self._create_task()
        response = self.client.post(
            reverse(
                "project-task-comments",
                kwargs={"project_id": self.project_id, "pk": created.data["id"]},
            ),
            {"body": "   "},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_44_reorder_rejects_foreign_task_ids(self):
        t1 = self._create_task(name="Only")
        reorder_url = reverse(
            "project-task-reorder", kwargs={"project_id": self.project_id}
        )
        response = self.client.post(
            reorder_url,
            {"task_ids": [t1.data["id"], "00000000-0000-0000-0000-000000000099"]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
