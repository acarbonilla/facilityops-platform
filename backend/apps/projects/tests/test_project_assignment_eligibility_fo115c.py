"""FO-115C Project Manager & Task PIC role-based assignment tests."""

from datetime import date
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
from apps.projects.assignment_eligibility import (
    user_is_eligible_project_manager,
    user_is_eligible_task_pic,
)
from apps.projects.models import Project, ProjectMember, ProjectTask
from apps.projects.workspace_access import can_access_project_workspace

User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class ProjectAssignmentEligibilityFO115CTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant = Tenant.objects.create(name="FO115C Tenant", code="fo115c-a")
        cls.org = Organization.objects.create(
            tenant=cls.tenant, name="FO115C Org", code="fo115c-org"
        )
        cls.tenant_b = Tenant.objects.create(name="FO115C Tenant B", code="fo115c-b")
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="FO115C Org B", code="fo115c-org-b"
        )

        def make_user(email, role_code, tenant=None, org=None):
            user = User.objects.create_user(
                email=email,
                password="Password123!",
                tenant=tenant or cls.tenant,
                organization=org or cls.org,
                first_name=email.split("@")[0].split("-")[-1].title(),
                last_name="User",
            )
            UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
            return user

        cls.fm = make_user("fo115c-john@example.com", "facility_manager")
        cls.tech_jane = make_user("fo115c-jane@example.com", "technician")
        cls.tech_mark = make_user("fo115c-mark@example.com", "technician")
        cls.viewer = make_user("fo115c-victor@example.com", "viewer")
        cls.employee = make_user("fo115c-emma@example.com", "employee")
        cls.inactive_fm = make_user("fo115c-inactive@example.com", "facility_manager")
        cls.inactive_fm.is_active = False
        cls.inactive_fm.save(update_fields=["is_active"])
        cls.fm_b = make_user(
            "fo115c-fm-b@example.com",
            "facility_manager",
            tenant=cls.tenant_b,
            org=cls.org_b,
        )
        cls.tech_b = make_user(
            "fo115c-tech-b@example.com",
            "technician",
            tenant=cls.tenant_b,
            org=cls.org_b,
        )

    def setUp(self):
        self.client.force_authenticate(self.fm)
        project = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org.id),
                "name": "Lobby Repainting",
                "project_manager": str(self.fm.id),
                "planned_start_date": "2026-08-10",
                "planned_end_date": "2026-08-20",
            },
            format="json",
        )
        self.assertEqual(project.status_code, status.HTTP_201_CREATED, project.data)
        self.project_id = project.data["id"]
        self.project = Project.objects.get(pk=self.project_id)
        self.tasks_url = reverse(
            "project-task-list", kwargs={"project_id": self.project_id}
        )
        self.pm_options_url = reverse(
            "project-assignment-options-project-managers"
        )
        self.pic_options_url = reverse(
            "project-assignment-options-task-pic",
            kwargs={"project_id": self.project_id},
        )

    def test_01_manager_options_include_facility_manager(self):
        resp = self.client.get(self.pm_options_url)
        self.assertEqual(resp.status_code, 200, resp.data)
        ids = {row["id"] for row in resp.data["results"]}
        self.assertIn(str(self.fm.id), ids)

    def test_02_manager_options_exclude_technician_employee_viewer(self):
        resp = self.client.get(self.pm_options_url)
        ids = {row["id"] for row in resp.data["results"]}
        self.assertNotIn(str(self.tech_jane.id), ids)
        self.assertNotIn(str(self.employee.id), ids)
        self.assertNotIn(str(self.viewer.id), ids)
        self.assertNotIn(str(self.inactive_fm.id), ids)
        self.assertNotIn(str(self.fm_b.id), ids)

    def test_03_invalid_manager_assignment_rejected(self):
        resp = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org.id),
                "name": "Bad Manager Project",
                "project_manager": str(self.tech_jane.id),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("project_manager", resp.data)

    def test_04_valid_manager_assignment_succeeds(self):
        self.assertTrue(user_is_eligible_project_manager(self.fm))
        self.assertFalse(user_is_eligible_project_manager(self.tech_jane))

    def test_05_pic_options_include_technicians_and_manager(self):
        resp = self.client.get(self.pic_options_url)
        self.assertEqual(resp.status_code, 200, resp.data)
        ids = {row["id"] for row in resp.data["results"]}
        self.assertIn(str(self.tech_jane.id), ids)
        self.assertIn(str(self.tech_mark.id), ids)
        self.assertIn(str(self.fm.id), ids)
        self.assertNotIn(str(self.employee.id), ids)
        self.assertNotIn(str(self.viewer.id), ids)
        self.assertNotIn(str(self.tech_b.id), ids)

    def test_06_technician_need_not_be_project_member(self):
        self.assertFalse(
            ProjectMember.objects.filter(
                project_id=self.project_id,
                user=self.tech_jane,
                is_deleted=False,
            ).exists()
        )
        task = self.client.post(
            self.tasks_url,
            {
                "name": "Inspect & Prepare Work Area",
                "person_in_charge": str(self.tech_jane.id),
                "planned_start": "2026-08-10",
                "planned_end": "2026-08-11",
            },
            format="json",
        )
        self.assertEqual(task.status_code, 201, task.data)
        self.assertEqual(str(task.data["person_in_charge"]), str(self.tech_jane.id))
        self.assertFalse(
            ProjectMember.objects.filter(
                project_id=self.project_id,
                user=self.tech_jane,
                is_deleted=False,
            ).exists()
        )

    def test_07_invalid_pic_rejected(self):
        for user in (self.employee, self.viewer, self.tech_b):
            resp = self.client.post(
                self.tasks_url,
                {
                    "name": f"Bad PIC {user.email}",
                    "person_in_charge": str(user.id),
                },
                format="json",
            )
            self.assertEqual(resp.status_code, 400, resp.data)
            self.assertIn("person_in_charge", resp.data)

    def test_08_viewer_member_not_pic_eligible(self):
        ProjectMember.objects.create(
            tenant=self.tenant,
            project_id=self.project_id,
            user=self.viewer,
            role=ProjectMember.Role.VIEWER,
            is_active=True,
            added_by=self.fm,
        )
        self.assertFalse(user_is_eligible_task_pic(self.viewer, self.project))
        resp = self.client.post(
            self.tasks_url,
            {
                "name": "Viewer PIC attempt",
                "person_in_charge": str(self.viewer.id),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400, resp.data)

    def test_09_pic_grants_workspace_and_my_work_not_manage(self):
        task = self.client.post(
            self.tasks_url,
            {
                "name": "Prep Area",
                "person_in_charge": str(self.tech_jane.id),
            },
            format="json",
        )
        self.assertEqual(task.status_code, 201, task.data)
        self.project.refresh_from_db()
        self.assertTrue(can_access_project_workspace(self.tech_jane, self.project))

        self.client.force_authenticate(self.tech_jane)
        projects = self.client.get(reverse("project-list"))
        self.assertEqual(projects.status_code, 200)
        ids = {row["id"] for row in projects.data["results"]}
        self.assertIn(self.project_id, ids)

        my_work = self.client.get(reverse("project-my-work"))
        self.assertEqual(my_work.status_code, 200)

        # Technician cannot update Project.
        patched = self.client.patch(
            reverse("project-detail", kwargs={"pk": self.project_id}),
            {"name": "Hacked"},
            format="json",
        )
        self.assertIn(patched.status_code, (403, 404))

    def test_10_reassignment_and_unassignment_access(self):
        task = self.client.post(
            self.tasks_url,
            {
                "name": "Task One",
                "person_in_charge": str(self.tech_jane.id),
            },
            format="json",
        )
        task_id = task.data["id"]
        self.assertTrue(can_access_project_workspace(self.tech_jane, self.project))

        reassigned = self.client.patch(
            reverse(
                "project-task-detail",
                kwargs={"project_id": self.project_id, "pk": task_id},
            ),
            {"person_in_charge": str(self.tech_mark.id)},
            format="json",
        )
        self.assertEqual(reassigned.status_code, 200, reassigned.data)
        self.assertFalse(can_access_project_workspace(self.tech_jane, self.project))
        self.assertTrue(can_access_project_workspace(self.tech_mark, self.project))

        unassigned = self.client.patch(
            reverse(
                "project-task-detail",
                kwargs={"project_id": self.project_id, "pk": task_id},
            ),
            {"person_in_charge": None},
            format="json",
        )
        self.assertEqual(unassigned.status_code, 200, unassigned.data)
        self.assertFalse(can_access_project_workspace(self.tech_mark, self.project))

    def test_11_multiple_assignments_preserve_access(self):
        t1 = self.client.post(
            self.tasks_url,
            {"name": "T1", "person_in_charge": str(self.tech_jane.id)},
            format="json",
        )
        t2 = self.client.post(
            self.tasks_url,
            {"name": "T2", "person_in_charge": str(self.tech_jane.id)},
            format="json",
        )
        self.client.patch(
            reverse(
                "project-task-detail",
                kwargs={"project_id": self.project_id, "pk": t1.data["id"]},
            ),
            {"person_in_charge": str(self.tech_mark.id)},
            format="json",
        )
        self.assertTrue(can_access_project_workspace(self.tech_jane, self.project))
        self.client.patch(
            reverse(
                "project-task-detail",
                kwargs={"project_id": self.project_id, "pk": t2.data["id"]},
            ),
            {"person_in_charge": None},
            format="json",
        )
        self.assertFalse(can_access_project_workspace(self.tech_jane, self.project))

    def test_12_explicit_member_retains_view_after_unassign(self):
        ProjectMember.objects.create(
            tenant=self.tenant,
            project_id=self.project_id,
            user=self.tech_jane,
            role=ProjectMember.Role.MEMBER,
            is_active=True,
            added_by=self.fm,
        )
        task = self.client.post(
            self.tasks_url,
            {"name": "Member Task", "person_in_charge": str(self.tech_jane.id)},
            format="json",
        )
        self.client.patch(
            reverse(
                "project-task-detail",
                kwargs={"project_id": self.project_id, "pk": task.data["id"]},
            ),
            {"person_in_charge": None},
            format="json",
        )
        self.assertTrue(can_access_project_workspace(self.tech_jane, self.project))

    def test_13_execution_sets_actual_dates(self):
        task = self.client.post(
            self.tasks_url,
            {
                "name": "Execute",
                "person_in_charge": str(self.tech_jane.id),
                "planned_start": "2026-08-10",
                "planned_end": "2026-08-12",
            },
            format="json",
        )
        self.assertEqual(task.status_code, 201, task.data)
        task_id = task.data["id"]
        self.client.force_authenticate(self.tech_jane)
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 10)
        ):
            started = self.client.post(
                reverse(
                    "project-task-start",
                    kwargs={"project_id": self.project_id, "pk": task_id},
                ),
                {},
                format="json",
            )
        self.assertEqual(started.status_code, 200, started.data)
        self.assertEqual(started.data["actual_start"], "2026-08-10")
        with mock.patch(
            "django.utils.timezone.localdate", return_value=date(2026, 8, 12)
        ):
            done = self.client.post(
                reverse(
                    "project-task-complete",
                    kwargs={"project_id": self.project_id, "pk": task_id},
                ),
                {},
                format="json",
            )
        self.assertEqual(done.status_code, 200, done.data)
        self.assertEqual(done.data["actual_end"], "2026-08-12")

    def test_14_legacy_invalid_manager_readable_until_changed(self):
        # Simulate legacy project with technician as manager in DB.
        Project.objects.filter(pk=self.project_id).update(
            project_manager=self.tech_jane
        )
        detail = self.client.get(
            reverse("project-detail", kwargs={"pk": self.project_id})
        )
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(str(detail.data["project_manager"]), str(self.tech_jane.id))
        # Changing other fields while keeping same manager still allowed.
        patched = self.client.patch(
            reverse("project-detail", kwargs={"pk": self.project_id}),
            {"description": "Legacy keep manager"},
            format="json",
        )
        self.assertEqual(patched.status_code, 200, patched.data)
        # Changing to another invalid manager rejected.
        bad = self.client.patch(
            reverse("project-detail", kwargs={"pk": self.project_id}),
            {"project_manager": str(self.employee.id)},
            format="json",
        )
        self.assertEqual(bad.status_code, 400, bad.data)

    def test_15_cross_tenant_pic_options_blocked(self):
        self.client.force_authenticate(self.fm_b)
        resp = self.client.get(self.pic_options_url)
        self.assertIn(resp.status_code, (403, 404))
