"""FO-106 Timeline, Notes & Issues API tests."""

from datetime import date, timedelta

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
    ProjectIssueComment,
    ProjectMember,
    ProjectNote,
)

User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class ProjectCollaborationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="FO106 Tenant A", code="fo106-a")
        cls.tenant_b = Tenant.objects.create(name="FO106 Tenant B", code="fo106-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="FO106 Org A", code="fo106-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="FO106 Org B", code="fo106-org-b"
        )
        cls.building_a = Building.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            name="Building A",
            code="fo106-bldg-a",
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
            "fo106-fm-a@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.fm_b = make_user(
            "fo106-fm-b@example.com", cls.tenant_b, cls.org_b, "facility_manager"
        )
        cls.viewer_a = make_user(
            "fo106-viewer-a@example.com", cls.tenant_a, cls.org_a, "viewer"
        )
        cls.employee_a = make_user(
            "fo106-emp-a@example.com", cls.tenant_a, cls.org_a, "employee"
        )
        cls.pm_user = make_user(
            "fo106-pm-a@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.member_user = make_user(
            "fo106-member-a@example.com", cls.tenant_a, cls.org_a, "viewer"
        )

    def setUp(self):
        self._auth(self.fm_a)
        project_resp = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org_a.id),
                "name": "Collaboration Host Project",
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
        ProjectMember.objects.create(
            tenant=self.tenant_a,
            project=self.project,
            user=self.member_user,
            role=ProjectMember.Role.MEMBER,
            is_active=True,
            added_by=self.fm_a,
        )
        self.notes_url = reverse(
            "project-note-list", kwargs={"project_id": self.project_id}
        )
        self.issues_url = reverse(
            "project-issue-list", kwargs={"project_id": self.project_id}
        )
        self.timeline_url = reverse(
            "project-timeline-list", kwargs={"project_id": self.project_id}
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def _note_url(self, note_id):
        return reverse(
            "project-note-detail",
            kwargs={"project_id": self.project_id, "pk": note_id},
        )

    def _issue_url(self, issue_id):
        return reverse(
            "project-issue-detail",
            kwargs={"project_id": self.project_id, "pk": issue_id},
        )

    def _issue_comments_url(self, issue_id):
        return reverse(
            "project-issue-comments",
            kwargs={"project_id": self.project_id, "pk": issue_id},
        )

    def _issue_comment_url(self, issue_id, comment_id):
        return reverse(
            "project-issue-comment-detail",
            kwargs={
                "project_id": self.project_id,
                "pk": issue_id,
                "comment_id": comment_id,
            },
        )

    # ------------------------------------------------------------------
    # Notes
    # ------------------------------------------------------------------

    def test_01_create_list_retrieve_note(self):
        resp = self.client.post(
            self.notes_url,
            {
                "title": "Kickoff notes",
                "note": "Discussed schedule and risks.",
                "category": "meeting",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        note_id = resp.data["id"]
        self.assertEqual(resp.data["category"], "meeting")
        self.assertEqual(resp.data["author"], self.fm_a.id)

        listed = self.client.get(self.notes_url)
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(listed.data["count"], 1)

        detail = self.client.get(self._note_url(note_id))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["title"], "Kickoff notes")

        self.assertTrue(
            ProjectHistory.objects.filter(
                project=self.project, action="note_created"
            ).exists()
        )

    def test_02_update_and_soft_delete_note(self):
        created = self.client.post(
            self.notes_url,
            {"title": "Temp", "note": "body", "category": "general"},
            format="json",
        )
        note_id = created.data["id"]
        patched = self.client.patch(
            self._note_url(note_id),
            {"title": "Updated title", "category": "decision"},
            format="json",
        )
        self.assertEqual(patched.status_code, status.HTTP_200_OK, patched.data)
        self.assertEqual(patched.data["title"], "Updated title")
        self.assertTrue(
            ProjectHistory.objects.filter(
                project=self.project, action="note_updated"
            ).exists()
        )

        deleted = self.client.delete(self._note_url(note_id))
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        note = ProjectNote.objects.get(pk=note_id)
        self.assertTrue(note.is_deleted)
        self.assertEqual(
            self.client.get(self._note_url(note_id)).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertTrue(
            ProjectHistory.objects.filter(
                project=self.project, action="note_deleted"
            ).exists()
        )

    def test_03_note_filters_search_and_ordering(self):
        self.client.post(
            self.notes_url,
            {"title": "Safety brief", "note": "PPE required", "category": "safety"},
            format="json",
        )
        self.client.post(
            self.notes_url,
            {"title": "Client call", "note": "Budget OK", "category": "client"},
            format="json",
        )
        filtered = self.client.get(self.notes_url, {"category": "safety"})
        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        for row in filtered.data["results"]:
            self.assertEqual(row["category"], "safety")

        searched = self.client.get(self.notes_url, {"search": "Budget"})
        self.assertEqual(searched.status_code, status.HTTP_200_OK)
        self.assertTrue(
            any("Budget" in row["note"] for row in searched.data["results"])
        )

        ordered = self.client.get(self.notes_url, {"ordering": "title"})
        self.assertEqual(ordered.status_code, status.HTTP_200_OK)
        titles = [row["title"] for row in ordered.data["results"]]
        self.assertEqual(titles, sorted(titles))

    def test_04_note_permissions_viewer_and_employee(self):
        created = self.client.post(
            self.notes_url,
            {"title": "Visible", "note": "x", "category": "general"},
            format="json",
        )
        note_id = created.data["id"]

        self._auth(self.viewer_a)
        self.assertEqual(
            self.client.get(self.notes_url).status_code, status.HTTP_200_OK
        )
        self.assertEqual(
            self.client.post(
                self.notes_url,
                {"title": "No", "note": "n", "category": "general"},
                format="json",
            ).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.patch(
                self._note_url(note_id), {"title": "Nope"}, format="json"
            ).status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self._auth(self.employee_a)
        self.assertEqual(
            self.client.get(self.notes_url).status_code, status.HTTP_403_FORBIDDEN
        )

    def test_05_note_tenant_isolation(self):
        created = self.client.post(
            self.notes_url,
            {"title": "Private", "note": "tenant a", "category": "general"},
            format="json",
        )
        note_id = created.data["id"]
        self._auth(self.fm_b)
        self.assertEqual(
            self.client.get(self.notes_url).status_code, status.HTTP_404_NOT_FOUND
        )
        self.assertEqual(
            self.client.get(self._note_url(note_id)).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    # ------------------------------------------------------------------
    # Issues
    # ------------------------------------------------------------------

    def test_10_create_list_retrieve_issue(self):
        resp = self.client.post(
            self.issues_url,
            {
                "title": "Leak in basement",
                "description": "Water near pump",
                "severity": "high",
                "owner": str(self.member_user.id),
                "due_date": str(date.today() + timedelta(days=7)),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        issue_id = resp.data["id"]
        self.assertEqual(resp.data["status"], "open")
        self.assertIsNone(resp.data["resolved_at"])

        listed = self.client.get(self.issues_url)
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(listed.data["count"], 1)

        detail = self.client.get(self._issue_url(issue_id))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["title"], "Leak in basement")
        self.assertTrue(
            ProjectHistory.objects.filter(
                project=self.project, action="issue_created"
            ).exists()
        )

    def test_11_issue_status_sets_and_clears_resolved_at(self):
        created = self.client.post(
            self.issues_url,
            {"title": "Resolve me", "description": "", "severity": "medium"},
            format="json",
        )
        issue_id = created.data["id"]

        resolved = self.client.patch(
            self._issue_url(issue_id),
            {"status": "resolved"},
            format="json",
        )
        self.assertEqual(resolved.status_code, status.HTTP_200_OK, resolved.data)
        self.assertIsNotNone(resolved.data["resolved_at"])
        self.assertTrue(
            ProjectHistory.objects.filter(
                project=self.project, action="issue_status_changed"
            ).exists()
        )

        reopened = self.client.patch(
            self._issue_url(issue_id),
            {"status": "investigating"},
            format="json",
        )
        self.assertEqual(reopened.status_code, status.HTTP_200_OK, reopened.data)
        self.assertIsNone(reopened.data["resolved_at"])

        closed = self.client.patch(
            self._issue_url(issue_id),
            {"status": "closed"},
            format="json",
        )
        self.assertEqual(closed.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(closed.data["resolved_at"])

    def test_12_issue_owner_must_be_active_member(self):
        outsider = User.objects.create_user(
            email="fo106-outsider@example.com",
            password="Password123!",
            tenant=self.tenant_a,
            organization=self.org_a,
            first_name="Out",
            last_name="Sider",
        )
        UserRole.objects.create(
            user=outsider, role=Role.objects.get(code="viewer")
        )
        resp = self.client.post(
            self.issues_url,
            {
                "title": "Bad owner",
                "description": "",
                "owner": str(outsider.id),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_13_issue_filters_and_soft_delete(self):
        a = self.client.post(
            self.issues_url,
            {"title": "Blocked pipe", "severity": "critical", "status": "blocked"},
            format="json",
        )
        self.client.post(
            self.issues_url,
            {"title": "Minor paint", "severity": "low", "status": "open"},
            format="json",
        )
        filtered = self.client.get(
            self.issues_url, {"status": "blocked", "severity": "critical"}
        )
        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        self.assertTrue(
            all(
                row["status"] == "blocked" and row["severity"] == "critical"
                for row in filtered.data["results"]
            )
        )

        searched = self.client.get(self.issues_url, {"search": "paint"})
        self.assertTrue(
            any("paint" in row["title"].lower() for row in searched.data["results"])
        )

        issue_id = a.data["id"]
        deleted = self.client.delete(self._issue_url(issue_id))
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(ProjectIssue.objects.get(pk=issue_id).is_deleted)
        self.assertTrue(
            ProjectHistory.objects.filter(
                project=self.project, action="issue_deleted"
            ).exists()
        )

    def test_14_issue_comments_crud(self):
        issue = self.client.post(
            self.issues_url,
            {"title": "Comment host", "description": "d"},
            format="json",
        )
        issue_id = issue.data["id"]
        comments_url = self._issue_comments_url(issue_id)

        created = self.client.post(
            comments_url, {"body": "Looking into it"}, format="json"
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED, created.data)
        comment_id = created.data["id"]
        self.assertTrue(created.data["is_internal"])
        self.assertTrue(
            ProjectHistory.objects.filter(
                project=self.project, action="issue_comment_added"
            ).exists()
        )

        listed = self.client.get(comments_url)
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(listed.data["count"], 1)

        deleted = self.client.delete(self._issue_comment_url(issue_id, comment_id))
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertTrue(ProjectIssueComment.objects.get(pk=comment_id).is_deleted)
        self.assertTrue(
            ProjectHistory.objects.filter(
                project=self.project, action="issue_comment_deleted"
            ).exists()
        )

    def test_15_issue_permissions_and_tenant_isolation(self):
        created = self.client.post(
            self.issues_url,
            {"title": "Perm check", "description": ""},
            format="json",
        )
        issue_id = created.data["id"]

        self._auth(self.viewer_a)
        self.assertEqual(
            self.client.get(self.issues_url).status_code, status.HTTP_200_OK
        )
        self.assertEqual(
            self.client.post(
                self.issues_url, {"title": "No", "description": ""}, format="json"
            ).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.post(
                self._issue_comments_url(issue_id),
                {"body": "viewer comment"},
                format="json",
            ).status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self._auth(self.fm_b)
        self.assertEqual(
            self.client.get(self.issues_url).status_code, status.HTTP_404_NOT_FOUND
        )

    # ------------------------------------------------------------------
    # Timeline
    # ------------------------------------------------------------------

    def test_20_timeline_aggregates_history_newest_first(self):
        self.client.post(
            self.notes_url,
            {"title": "N1", "note": "body", "category": "general"},
            format="json",
        )
        self.client.post(
            self.issues_url,
            {"title": "I1", "description": "d"},
            format="json",
        )
        resp = self.client.get(self.timeline_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        self.assertGreaterEqual(resp.data["count"], 2)
        results = resp.data["results"]
        timestamps = [row["timestamp"] for row in results]
        self.assertEqual(timestamps, sorted(timestamps, reverse=True))
        event_types = {row["event_type"] for row in results}
        self.assertIn("note_created", event_types)
        self.assertIn("issue_created", event_types)
        sample = results[0]
        for key in (
            "id",
            "timestamp",
            "actor",
            "event_type",
            "category",
            "title",
            "description",
            "related_object",
            "icon",
            "metadata",
        ):
            self.assertIn(key, sample)

    def test_21_timeline_category_and_search_filters(self):
        self.client.post(
            self.notes_url,
            {"title": "FilterNote", "note": "alpha", "category": "general"},
            format="json",
        )
        self.client.post(
            self.issues_url,
            {"title": "FilterIssue", "description": "beta"},
            format="json",
        )
        notes_only = self.client.get(self.timeline_url, {"event_category": "note"})
        self.assertEqual(notes_only.status_code, status.HTTP_200_OK)
        self.assertTrue(
            all(row["category"] == "note" for row in notes_only.data["results"])
        )

        searched = self.client.get(self.timeline_url, {"search": "FilterIssue"})
        self.assertEqual(searched.status_code, status.HTTP_200_OK)
        self.assertTrue(
            any(
                "FilterIssue" in (row["description"] or "")
                for row in searched.data["results"]
            )
        )

    def test_22_timeline_pagination_and_permissions(self):
        for i in range(12):
            self.client.post(
                self.notes_url,
                {"title": f"Note {i}", "note": f"body {i}", "category": "other"},
                format="json",
            )
        page = self.client.get(self.timeline_url, {"page_size": 5})
        self.assertEqual(page.status_code, status.HTTP_200_OK)
        self.assertLessEqual(len(page.data["results"]), 5)
        self.assertIn("next", page.data)

        self._auth(self.viewer_a)
        self.assertEqual(
            self.client.get(self.timeline_url).status_code, status.HTTP_200_OK
        )

        self._auth(self.employee_a)
        self.assertEqual(
            self.client.get(self.timeline_url).status_code, status.HTTP_403_FORBIDDEN
        )

    # ------------------------------------------------------------------
    # RBAC seed
    # ------------------------------------------------------------------

    def test_30_seed_rbac_grants_fo106_permissions(self):
        for code in (
            "projects.notes.view",
            "projects.notes.manage",
            "projects.issues.view",
            "projects.issues.manage",
            "projects.issues.comment",
            "projects.timeline.view",
        ):
            self.assertTrue(
                Permission.objects.filter(code=code).exists(),
                f"Missing permission {code}",
            )

        fm = Role.objects.get(code="facility_manager")
        admin = Role.objects.get(code="system_admin")
        viewer = Role.objects.get(code="viewer")
        for code in (
            "projects.notes.view",
            "projects.notes.manage",
            "projects.issues.view",
            "projects.issues.manage",
            "projects.issues.comment",
            "projects.timeline.view",
        ):
            self.assertTrue(
                RolePermission.objects.filter(role=fm, permission__code=code).exists()
            )
            self.assertTrue(
                RolePermission.objects.filter(
                    role=admin, permission__code=code
                ).exists()
            )

        for code in (
            "projects.notes.view",
            "projects.issues.view",
            "projects.timeline.view",
        ):
            self.assertTrue(
                RolePermission.objects.filter(
                    role=viewer, permission__code=code
                ).exists()
            )
        self.assertFalse(
            RolePermission.objects.filter(
                role=viewer, permission__code="projects.notes.manage"
            ).exists()
        )
        self.assertFalse(
            RolePermission.objects.filter(
                role=viewer, permission__code="projects.issues.manage"
            ).exists()
        )

    def test_31_no_fm_ticket_side_effect_on_issue_create(self):
        from apps.fm_tickets.models import FmTicket

        before = FmTicket.objects.count()
        self.client.post(
            self.issues_url,
            {"title": "No ticket", "description": "should stay local"},
            format="json",
        )
        self.assertEqual(FmTicket.objects.count(), before)

    def test_32_issue_create_with_resolved_status_sets_resolved_at(self):
        resp = self.client.post(
            self.issues_url,
            {
                "title": "Already resolved",
                "description": "",
                "status": "resolved",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertIsNotNone(resp.data["resolved_at"])
        # Sanity: resolved_at is recent
        resolved_at = ProjectIssue.objects.get(pk=resp.data["id"]).resolved_at
        self.assertIsNotNone(resolved_at)
        self.assertLessEqual(timezone.now() - resolved_at, timedelta(minutes=1))
