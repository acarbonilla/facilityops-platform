"""FO-107 Progress & Accomplishment Tracking API/service tests."""

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Permission, Role, RolePermission, UserRole
from apps.master_data.models import Building, Organization, Tenant
from apps.projects.models import (
    Project,
    ProjectHistory,
    ProjectIssue,
    ProjectMember,
    ProjectProgressSnapshot,
    ProjectTask,
    ProjectTaskComment,
)
from apps.projects.progress_service import (
    build_progress_summary,
    calculate_accomplishment,
    recalculate_project_progress,
    round_accomplishment,
)
from apps.projects.services import (
    add_task_comment,
    create_task,
    soft_delete_task,
    update_task,
)

User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class ProjectProgressTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="FO107 Tenant A", code="fo107-a")
        cls.tenant_b = Tenant.objects.create(name="FO107 Tenant B", code="fo107-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="FO107 Org A", code="fo107-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="FO107 Org B", code="fo107-org-b"
        )
        cls.building_a = Building.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            name="Building A",
            code="fo107-bldg-a",
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
            "fo107-fm-a@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.fm_b = make_user(
            "fo107-fm-b@example.com", cls.tenant_b, cls.org_b, "facility_manager"
        )
        cls.viewer_a = make_user(
            "fo107-viewer-a@example.com", cls.tenant_a, cls.org_a, "viewer"
        )
        cls.employee_a = make_user(
            "fo107-emp-a@example.com", cls.tenant_a, cls.org_a, "employee"
        )
        cls.pm_user = make_user(
            "fo107-pm-a@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.member_user = make_user(
            "fo107-member-a@example.com", cls.tenant_a, cls.org_a, "viewer"
        )

    def setUp(self):
        self._auth(self.fm_a)
        project_resp = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org_a.id),
                "name": "Lobby Flooring Replacement",
                "project_manager": str(self.pm_user.id),
                "planned_start_date": str(date.today() - timedelta(days=10)),
                "planned_end_date": str(date.today() + timedelta(days=50)),
                "status": "in_progress",
            },
            format="json",
        )
        self.assertEqual(
            project_resp.status_code, status.HTTP_201_CREATED, project_resp.data
        )
        self.project_id = project_resp.data["id"]
        self.project = Project.objects.get(pk=self.project_id)
        ProjectMember.objects.get_or_create(
            project=self.project,
            user=self.member_user,
            defaults={
                "tenant": self.tenant_a,
                "role": ProjectMember.Role.MEMBER,
                "is_active": True,
                "added_by": self.fm_a,
            },
        )
        self.tasks_url = reverse(
            "project-task-list", kwargs={"project_id": self.project_id}
        )
        self.progress_url = reverse(
            "project-progress", kwargs={"pk": self.project_id}
        )
        self.history_url = reverse(
            "project-progress-history", kwargs={"pk": self.project_id}
        )
        self.recalc_url = reverse(
            "project-recalculate-progress", kwargs={"pk": self.project_id}
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def _create_task(self, **overrides):
        payload = {
            "name": overrides.pop("name", "Task"),
            "person_in_charge": str(self.pm_user.id),
            "status": "not_started",
            "priority": "medium",
        }
        payload.update(overrides)
        resp = self.client.post(self.tasks_url, payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        return resp.data

    def _patch_task(self, task_id, **overrides):
        url = reverse(
            "project-task-detail",
            kwargs={"project_id": self.project_id, "pk": task_id},
        )
        resp = self.client.patch(url, overrides, format="json")
        return resp

    def _refresh_project(self):
        self.project.refresh_from_db()
        return self.project

    # ------------------------------------------------------------------
    # Formula / rounding
    # ------------------------------------------------------------------

    def test_01_zero_with_no_included_tasks(self):
        self.assertEqual(calculate_accomplishment(self.project), Decimal("0.00"))
        self.assertEqual(self._refresh_project().completion_percentage, Decimal("0.00"))

    def test_02_simple_average(self):
        a = self._create_task(name="A", status="completed")
        b = self._create_task(name="B", status="in_progress", progress_percentage="50.00")
        c = self._create_task(name="C", status="not_started")
        self.assertEqual(a["progress_percentage"], "100.00")
        self.assertEqual(c["progress_percentage"], "0.00")
        self.assertEqual(self._refresh_project().completion_percentage, Decimal("50.00"))
        self.assertEqual(b["progress_percentage"], "50.00")

    def test_03_cancelled_excluded(self):
        self._create_task(name="A", status="completed")
        cancelled = self._create_task(name="B", status="not_started")
        self._patch_task(cancelled["id"], status="cancelled")
        self._create_task(name="C", status="not_started")
        # (100 + 0) / 2 = 50; cancelled excluded
        self.assertEqual(self._refresh_project().completion_percentage, Decimal("50.00"))

    def test_04_soft_deleted_excluded(self):
        keep = self._create_task(name="Keep", status="completed")
        doomed = self._create_task(name="Doomed", status="not_started")
        url = reverse(
            "project-task-detail",
            kwargs={"project_id": self.project_id, "pk": doomed["id"]},
        )
        resp = self.client.delete(url)
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self._refresh_project().completion_percentage, Decimal("100.00"))
        self.assertTrue(ProjectTask.objects.get(pk=keep["id"]).status == "completed")

    def test_05_completed_contributes_100(self):
        self._create_task(name="Done", status="completed")
        self.assertEqual(calculate_accomplishment(self.project), Decimal("100.00"))

    def test_06_not_started_contributes_0(self):
        self._create_task(name="Todo", status="not_started")
        self.assertEqual(calculate_accomplishment(self.project), Decimal("0.00"))

    def test_07_blocked_preserves_progress(self):
        task = self._create_task(
            name="Blocked",
            status="in_progress",
            progress_percentage="40.00",
        )
        resp = self._patch_task(task["id"], status="blocked")
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(Decimal(resp.data["progress_percentage"]), Decimal("40.00"))
        self.assertEqual(self._refresh_project().completion_percentage, Decimal("40.00"))

    def test_08_on_hold_preserves_progress(self):
        task = self._create_task(
            name="Hold",
            status="in_progress",
            progress_percentage="25.00",
        )
        resp = self._patch_task(task["id"], status="on_hold")
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(Decimal(resp.data["progress_percentage"]), Decimal("25.00"))
        self.assertEqual(self._refresh_project().completion_percentage, Decimal("25.00"))

    def test_09_milestone_incomplete_contributes_0(self):
        self._create_task(
            name="MS",
            status="in_progress",
            progress_percentage="50.00",
            is_milestone=True,
        )
        self.assertEqual(calculate_accomplishment(self.project), Decimal("0.00"))

    def test_10_milestone_completed_contributes_100(self):
        self._create_task(name="MS", status="completed", is_milestone=True)
        self.assertEqual(calculate_accomplishment(self.project), Decimal("100.00"))

    def test_11_cancelled_milestone_excluded(self):
        self._create_task(name="Done", status="completed")
        ms = self._create_task(name="MS", status="not_started", is_milestone=True)
        self._patch_task(ms["id"], status="cancelled")
        self.assertEqual(self._refresh_project().completion_percentage, Decimal("100.00"))

    def test_12_rounding_half_up(self):
        # Sample Lobby Flooring: 100+100+50+0+0+0 = 250/6 = 41.666... → 42
        self._create_task(name="1", status="completed")
        self._create_task(name="2", status="completed")
        self._create_task(name="3", status="in_progress", progress_percentage="50.00")
        self._create_task(name="4", status="not_started")
        self._create_task(name="5", status="not_started")
        self._create_task(name="6", status="not_started", is_milestone=True)
        self.assertEqual(round_accomplishment(Decimal("41.666")), Decimal("42.00"))
        self.assertEqual(self._refresh_project().completion_percentage, Decimal("42.00"))

    def test_13_completion_percentage_readonly(self):
        resp = self.client.patch(
            reverse("project-detail", kwargs={"pk": self.project_id}),
            {"completion_percentage": "55.00"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(resp.data["completion_percentage"]), Decimal("0.00"))

    # ------------------------------------------------------------------
    # Recalculation triggers
    # ------------------------------------------------------------------

    def test_14_task_creation_recalculates(self):
        before = ProjectProgressSnapshot.objects.filter(project=self.project).count()
        self._create_task(name="New", status="completed")
        self.assertEqual(self._refresh_project().completion_percentage, Decimal("100.00"))
        self.assertGreater(
            ProjectProgressSnapshot.objects.filter(project=self.project).count(),
            before,
        )

    def test_15_task_progress_change_recalculates(self):
        task = self._create_task(name="P", status="in_progress", progress_percentage="10.00")
        self._patch_task(task["id"], progress_percentage="70.00")
        self.assertEqual(self._refresh_project().completion_percentage, Decimal("70.00"))
        snap = (
            ProjectProgressSnapshot.objects.filter(project=self.project)
            .order_by("-recorded_at")
            .first()
        )
        self.assertEqual(snap.source, "task_progress_changed")

    def test_16_task_status_change_recalculates(self):
        task = self._create_task(name="S", status="not_started")
        self._patch_task(task["id"], status="in_progress", progress_percentage="20.00")
        self.assertEqual(self._refresh_project().completion_percentage, Decimal("20.00"))

    def test_17_task_cancellation_recalculates(self):
        self._create_task(name="A", status="completed")
        b = self._create_task(name="B", status="not_started")
        self._patch_task(b["id"], status="cancelled")
        snap = (
            ProjectProgressSnapshot.objects.filter(project=self.project)
            .order_by("-recorded_at")
            .first()
        )
        self.assertEqual(snap.source, "task_cancelled")
        self.assertEqual(self._refresh_project().completion_percentage, Decimal("100.00"))

    def test_18_task_deletion_recalculates(self):
        self._create_task(name="A", status="completed")
        b = self._create_task(name="B", status="not_started")
        soft_delete_task(task=ProjectTask.objects.get(pk=b["id"]), actor=self.fm_a)
        snap = (
            ProjectProgressSnapshot.objects.filter(project=self.project)
            .order_by("-recorded_at")
            .first()
        )
        self.assertEqual(snap.source, "task_deleted")
        self.assertEqual(self._refresh_project().completion_percentage, Decimal("100.00"))

    def test_19_comment_does_not_recalculate(self):
        task = self._create_task(name="C", status="completed")
        before = ProjectProgressSnapshot.objects.filter(project=self.project).count()
        before_hist = ProjectHistory.objects.filter(
            project=self.project, action="project_accomplishment_changed"
        ).count()
        add_task_comment(
            task=ProjectTask.objects.get(pk=task["id"]),
            body="note",
            actor=self.fm_a,
        )
        self.assertEqual(
            ProjectProgressSnapshot.objects.filter(project=self.project).count(),
            before,
        )
        self.assertEqual(
            ProjectHistory.objects.filter(
                project=self.project, action="project_accomplishment_changed"
            ).count(),
            before_hist,
        )
        self.assertTrue(
            ProjectTaskComment.objects.filter(task_id=task["id"], is_deleted=False).exists()
        )

    def test_20_duplicate_unchanged_no_snapshot(self):
        self._create_task(name="A", status="completed")
        count = ProjectProgressSnapshot.objects.filter(project=self.project).count()
        result = recalculate_project_progress(
            self.project,
            actor=self.fm_a,
            source=ProjectProgressSnapshot.Source.MANUAL_RECALCULATION,
        )
        self.assertFalse(result["percentage_changed"])
        self.assertIsNone(result["snapshot"])
        self.assertEqual(
            ProjectProgressSnapshot.objects.filter(project=self.project).count(),
            count,
        )

    def test_21_changed_calculation_creates_snapshot(self):
        task = self._create_task(name="A", status="not_started")
        count = ProjectProgressSnapshot.objects.filter(project=self.project).count()
        update_task(
            task=ProjectTask.objects.get(pk=task["id"]),
            data={"status": "completed"},
            actor=self.fm_a,
        )
        self.assertGreater(
            ProjectProgressSnapshot.objects.filter(project=self.project).count(),
            count,
        )

    # ------------------------------------------------------------------
    # APIs / permissions / summary
    # ------------------------------------------------------------------

    def test_22_progress_endpoint_permission_and_summary(self):
        self._create_task(name="A", status="completed")
        self._create_task(name="B", status="blocked", progress_percentage="30.00")
        ProjectIssue.objects.create(
            tenant=self.tenant_a,
            project=self.project,
            title="Open issue",
            status=ProjectIssue.Status.OPEN,
            severity=ProjectIssue.Severity.HIGH,
            due_date=date.today() - timedelta(days=1),
        )
        resp = self.client.get(self.progress_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(resp.data["project_completion_percentage"], "65.00")
        self.assertEqual(resp.data["included_task_count"], 2)
        self.assertEqual(resp.data["completed_count"], 1)
        self.assertEqual(resp.data["blocked_count"], 1)
        self.assertEqual(resp.data["open_issue_count"], 1)
        self.assertEqual(resp.data["overdue_issue_count"], 1)
        self.assertEqual(resp.data["high_critical_open_issue_count"], 1)
        self.assertIsNotNone(resp.data["schedule_elapsed_percentage"])

    def test_23_milestone_and_upcoming_summary(self):
        self._create_task(
            name="MS",
            status="not_started",
            is_milestone=True,
            planned_start=str(date.today() + timedelta(days=2)),
            planned_end=str(date.today() + timedelta(days=2)),
        )
        self._create_task(
            name="Soon",
            status="not_started",
            planned_start=str(date.today()),
            planned_end=str(date.today() + timedelta(days=3)),
        )
        summary = build_progress_summary(self.project)
        self.assertEqual(summary["milestone_total"], 1)
        self.assertEqual(summary["milestone_completed"], 0)
        self.assertIsNotNone(summary["next_milestone"])
        self.assertEqual(summary["next_milestone"]["name"], "MS")
        self.assertEqual(len(summary["upcoming_due_tasks"]), 2)

    def test_24_delay_and_dependency_blocked_counts(self):
        from apps.projects.dependency_service import create_dependency

        pred = self._create_task(
            name="Pred",
            status="not_started",
            planned_start=str(date.today() - timedelta(days=10)),
            planned_end=str(date.today() - timedelta(days=2)),
        )
        succ = self._create_task(
            name="Succ",
            status="not_started",
            planned_start=str(date.today()),
            planned_end=str(date.today() + timedelta(days=5)),
        )
        create_dependency(
            project=self.project,
            predecessor_task=ProjectTask.objects.get(pk=pred["id"]),
            successor_task=ProjectTask.objects.get(pk=succ["id"]),
            actor=self.fm_a,
        )
        summary = build_progress_summary(self.project)
        self.assertEqual(summary["delayed_task_count"], 1)
        self.assertEqual(summary["dependency_blocked_count"], 1)

    def test_25_progress_history_filters_and_pagination(self):
        self._create_task(name="A", status="completed")
        task = self._create_task(name="B", status="in_progress", progress_percentage="10")
        self._patch_task(task["id"], progress_percentage="40.00")
        resp = self.client.get(self.history_url, {"source": "task_progress_changed"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get("results", resp.data)
        self.assertTrue(len(results) >= 1)
        self.assertTrue(all(r["source"] == "task_progress_changed" for r in results))

        scoped = self.client.get(
            self.history_url,
            {
                "date_from": str(date.today() - timedelta(days=1)),
                "date_to": str(date.today() + timedelta(days=1)),
                "ordering": "-recorded_at",
            },
        )
        self.assertEqual(scoped.status_code, status.HTTP_200_OK)

    def test_26_snapshot_tenant_and_project_scope(self):
        self._create_task(name="A", status="completed")
        snap = ProjectProgressSnapshot.objects.filter(project=self.project).first()
        self.assertEqual(snap.tenant_id, self.tenant_a.id)
        self.assertEqual(snap.project_id, self.project.id)

        self._auth(self.fm_b)
        resp = self.client.get(self.progress_url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_27_recalculate_permission_and_idempotent(self):
        self._create_task(name="A", status="completed")
        self._auth(self.viewer_a)
        denied = self.client.post(self.recalc_url, {}, format="json")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self._auth(self.fm_a)
        first = self.client.post(self.recalc_url, {"completion_percentage": "1"}, format="json")
        self.assertEqual(first.status_code, status.HTTP_200_OK, first.data)
        self.assertEqual(first.data["project_completion_percentage"], "100.00")
        count = ProjectProgressSnapshot.objects.filter(project=self.project).count()
        second = self.client.post(self.recalc_url, format="json")
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(
            ProjectProgressSnapshot.objects.filter(project=self.project).count(),
            count,
        )
        self.assertTrue(
            ProjectHistory.objects.filter(
                project=self.project, action="project_progress_recalculated"
            ).exists()
        )

    def test_28_employee_denied_progress(self):
        self._auth(self.employee_a)
        self.assertEqual(self.client.get(self.progress_url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get(self.history_url).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            self.client.post(self.recalc_url, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_29_viewer_can_view_not_recalculate(self):
        self._create_task(name="A", status="completed")
        self._auth(self.viewer_a)
        self.assertEqual(self.client.get(self.progress_url).status_code, status.HTTP_200_OK)
        self.assertEqual(
            self.client.post(self.recalc_url, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )

    # ------------------------------------------------------------------
    # Project status consistency
    # ------------------------------------------------------------------

    def test_30_cannot_complete_below_100(self):
        self._create_task(name="A", status="in_progress", progress_percentage="50.00")
        resp = self.client.patch(
            reverse("project-detail", kwargs={"pk": self.project_id}),
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", resp.data)

    def test_31_can_complete_at_100_sets_actual_end(self):
        self._create_task(name="A", status="completed")
        self.assertIsNone(self.project.actual_end_date)
        resp = self.client.patch(
            reverse("project-detail", kwargs={"pk": self.project_id}),
            {"status": "completed"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(resp.data["status"], "completed")
        self.assertEqual(resp.data["actual_end_date"], str(date.today()))
        # Do not auto-complete when % hits 100 without explicit status change.
        self.project.status = Project.Status.IN_PROGRESS
        self.project.actual_end_date = None
        self.project.completion_percentage = Decimal("100.00")
        self.project.save()
        self.assertEqual(self._refresh_project().status, "in_progress")

    def test_32_cancelled_project_preserves_accomplishment(self):
        self._create_task(name="A", status="in_progress", progress_percentage="40.00")
        pct = self._refresh_project().completion_percentage
        resp = self.client.patch(
            reverse("project-detail", kwargs={"pk": self.project_id}),
            {"status": "cancelled"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertEqual(Decimal(resp.data["completion_percentage"]), pct)

    # ------------------------------------------------------------------
    # Timeline / RBAC / backfill / list
    # ------------------------------------------------------------------

    def test_33_timeline_shows_accomplishment_events(self):
        self._create_task(name="A", status="completed")
        timeline = self.client.get(
            reverse("project-timeline-list", kwargs={"project_id": self.project_id})
        )
        self.assertEqual(timeline.status_code, status.HTTP_200_OK)
        results = timeline.data.get("results", timeline.data)
        types = {row["event_type"] for row in results}
        self.assertIn("project_accomplishment_changed", types)

    def test_34_seed_rbac_grants_fo107_permissions(self):
        call_command("seed_rbac")
        for code in ("projects.progress.view", "projects.progress.recalculate"):
            self.assertTrue(Permission.objects.filter(code=code).exists())
        fm = Role.objects.get(code="facility_manager")
        admin = Role.objects.get(code="system_admin")
        viewer = Role.objects.get(code="viewer")
        for role in (fm, admin):
            for code in ("projects.progress.view", "projects.progress.recalculate"):
                self.assertTrue(
                    RolePermission.objects.filter(
                        role=role, permission__code=code
                    ).exists(),
                    msg=f"{role.code} missing {code}",
                )
        self.assertTrue(
            RolePermission.objects.filter(
                role=viewer, permission__code="projects.progress.view"
            ).exists()
        )
        self.assertFalse(
            RolePermission.objects.filter(
                role=viewer, permission__code="projects.progress.recalculate"
            ).exists()
        )

    def test_35_backfill_idempotent(self):
        import importlib

        from django.apps import apps

        migration = importlib.import_module(
            "apps.projects.migrations.0005_project_progress_fo107"
        )

        self._create_task(name="A", status="in_progress", progress_percentage="33.00")
        Project.objects.filter(pk=self.project_id).update(
            completion_percentage=Decimal("0.00")
        )
        ProjectProgressSnapshot.objects.filter(project_id=self.project_id).delete()

        migration.backfill_project_progress(apps, None)
        self.project.refresh_from_db()
        self.assertEqual(self.project.completion_percentage, Decimal("33.00"))
        count = ProjectProgressSnapshot.objects.filter(project=self.project).count()
        self.assertGreaterEqual(count, 1)

        migration.backfill_project_progress(apps, None)
        self.assertEqual(
            ProjectProgressSnapshot.objects.filter(project=self.project).count(),
            count,
        )

    def test_36_project_list_shows_completion(self):
        self._create_task(name="A", status="completed")
        resp = self.client.get(reverse("project-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get("results", resp.data)
        match = next(r for r in results if r["id"] == self.project_id)
        self.assertEqual(Decimal(match["completion_percentage"]), Decimal("100.00"))

    def test_37_gantt_summary_still_ok(self):
        self._create_task(name="A", status="completed")
        resp = self.client.get(
            reverse("project-gantt", kwargs={"pk": self.project_id})
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("summary", resp.data)

    def test_38_query_count_bounded(self):
        for i in range(8):
            self._create_task(
                name=f"T{i}",
                status="in_progress" if i % 2 else "not_started",
                progress_percentage="10.00" if i % 2 else "0.00",
            )
        from django.test.utils import CaptureQueriesContext
        from django.db import connection

        with CaptureQueriesContext(connection) as ctx:
            build_progress_summary(self.project)
        self.assertLessEqual(len(ctx), 40)

    def test_39_member_can_view_progress(self):
        self._create_task(name="A", status="completed")
        self._auth(self.member_user)
        resp = self.client.get(self.progress_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_40_history_action_on_percentage_change(self):
        task = self._create_task(name="A", status="not_started")
        update_task(
            task=ProjectTask.objects.get(pk=task["id"]),
            data={"status": "completed"},
            actor=self.fm_a,
        )
        self.assertTrue(
            ProjectHistory.objects.filter(
                project=self.project,
                action="project_accomplishment_changed",
            ).exists()
        )

    def test_41_unrelated_name_update_no_recalc_source(self):
        task = self._create_task(name="A", status="completed")
        before = ProjectProgressSnapshot.objects.filter(project=self.project).count()
        resp = self._patch_task(task["id"], name="Renamed only")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(
            ProjectProgressSnapshot.objects.filter(project=self.project).count(),
            before,
        )

    def test_42_create_task_service_hooks(self):
        task = create_task(
            project=self.project,
            actor=self.fm_a,
            data={
                "name": "Svc",
                "person_in_charge": self.pm_user,
                "status": ProjectTask.Status.COMPLETED,
            },
        )
        self.assertEqual(self._refresh_project().completion_percentage, Decimal("100.00"))
        self.assertEqual(task.progress_percentage, Decimal("100.00"))

    def test_43_trend_and_latest_snapshot_in_summary(self):
        self._create_task(name="A", status="not_started")
        task = ProjectTask.objects.filter(project=self.project).first()
        update_task(
            task=task,
            data={
                "status": ProjectTask.Status.IN_PROGRESS,
                "progress_percentage": Decimal("50"),
            },
            actor=self.fm_a,
        )
        summary = build_progress_summary(self.project)
        self.assertIsNotNone(summary["latest_snapshot"])
        self.assertIn(summary["trend"], ("increased", "unchanged", "decreased"))

    def test_44_schedule_elapsed_optional_when_dates_missing(self):
        Project.objects.filter(pk=self.project_id).update(
            planned_start_date=None, planned_end_date=None
        )
        self.project.refresh_from_db()
        summary = build_progress_summary(self.project)
        self.assertIsNone(summary["schedule_elapsed_percentage"])
