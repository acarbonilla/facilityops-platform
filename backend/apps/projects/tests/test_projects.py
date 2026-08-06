"""FO-103 Project Management foundation API tests."""

import tempfile
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Role, UserRole
from apps.attachments.ownership import AttachmentOwnerType
from apps.inspection.models import Inspection
from apps.maintenance.models import MaintenanceWorkOrder
from apps.master_data.models import Building, Organization, Tenant
from apps.projects.models import Project, ProjectHistory, ProjectMember

User = get_user_model()

JPEG_BYTES = (
    b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    b"\xff\xd9"
)


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class ProjectFoundationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="FO103 Tenant A", code="fo103-a")
        cls.tenant_b = Tenant.objects.create(name="FO103 Tenant B", code="fo103-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="FO103 Org A", code="fo103-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="FO103 Org B", code="fo103-org-b"
        )
        cls.building_a = Building.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            name="Building A",
            code="fo103-bldg-a",
        )
        cls.building_b = Building.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            name="Building B",
            code="fo103-bldg-b",
        )
        cls.building_a2 = Building.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            name="Building A2",
            code="fo103-bldg-a2",
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
            "fo103-fm-a@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.fm_b = make_user(
            "fo103-fm-b@example.com", cls.tenant_b, cls.org_b, "facility_manager"
        )
        cls.viewer_a = make_user(
            "fo103-viewer-a@example.com", cls.tenant_a, cls.org_a, "viewer"
        )
        cls.employee_a = make_user(
            "fo103-emp-a@example.com", cls.tenant_a, cls.org_a, "employee"
        )
        cls.admin_a = make_user(
            "fo103-admin-a@example.com", cls.tenant_a, cls.org_a, "system_admin"
        )
        cls.admin_global = make_user(
            "fo103-admin-global@example.com", None, None, "system_admin"
        )
        cls.pm_user = make_user(
            "fo103-pm-a@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.member_user = make_user(
            "fo103-member-a@example.com", cls.tenant_a, cls.org_a, "viewer"
        )
        cls.inactive_user = make_user(
            "fo103-inactive@example.com",
            cls.tenant_a,
            cls.org_a,
            "viewer",
            is_active=False,
        )
        cls.other_tenant_user = make_user(
            "fo103-other@example.com", cls.tenant_b, cls.org_b, "facility_manager"
        )

    def setUp(self):
        self.list_url = reverse("project-list")

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def _create_payload(self, **overrides):
        payload = {
            "organization": str(self.org_a.id),
            "name": "HVAC Upgrade",
            "description": "Replace chillers",
            "status": Project.Status.DRAFT,
            "priority": Project.Priority.MEDIUM,
        }
        payload.update(overrides)
        return payload

    def _create_project(self, user=None, **overrides):
        self._auth(user or self.fm_a)
        response = self.client.post(
            self.list_url, self._create_payload(**overrides), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response

    # ------------------------------------------------------------------
    # Authorization / tenant isolation
    # ------------------------------------------------------------------

    def test_01_authorized_list(self):
        self._create_project()
        self._auth(self.fm_a)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["count"], 1)

    def test_02_employee_denied(self):
        self._auth(self.employee_a)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = self.client.post(
            self.list_url, self._create_payload(), format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_03_tenant_isolation(self):
        created = self._create_project()
        project_id = created.data["id"]

        self._auth(self.fm_b)
        list_response = self.client.get(self.list_url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in list_response.data["results"]]
        self.assertNotIn(project_id, ids)

        detail = self.client.get(reverse("project-detail", args=[project_id]))
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_04_tenant_derived_from_user(self):
        response = self._create_project()
        self.assertEqual(str(response.data["tenant"]), str(self.tenant_a.id))

    def test_05_tenant_spoof_ignored(self):
        self._auth(self.fm_a)
        response = self.client.post(
            self.list_url,
            self._create_payload(tenant=str(self.tenant_b.id)),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(str(response.data["tenant"]), str(self.tenant_a.id))

    def test_05b_system_admin_global_uses_org_tenant(self):
        self._auth(self.admin_global)
        response = self.client.post(
            self.list_url,
            self._create_payload(organization=str(self.org_b.id), name="Global Admin"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(str(response.data["tenant"]), str(self.tenant_b.id))

    # ------------------------------------------------------------------
    # Model / validation
    # ------------------------------------------------------------------

    def test_06_project_code_generated(self):
        response = self._create_project()
        code = response.data["project_code"]
        self.assertTrue(code.startswith("PRJ-"))
        year = date.today().strftime("%Y")
        self.assertIn(year, code)

    def test_07_project_code_unique_per_tenant(self):
        first = self._create_project(name="First")
        second = self._create_project(name="Second")
        self.assertNotEqual(first.data["project_code"], second.data["project_code"])

        # Same code allowed across tenants via model save with explicit codes
        year = date.today().strftime("%Y")
        shared_code = f"PRJ-{year}-9999"
        Project.objects.create(
            tenant=self.tenant_a,
            organization=self.org_a,
            name="Tenant A shared",
            project_code=shared_code,
        )
        Project.objects.create(
            tenant=self.tenant_b,
            organization=self.org_b,
            name="Tenant B shared",
            project_code=shared_code,
        )
        self.assertEqual(
            Project.objects.filter(project_code=shared_code).count(), 2
        )

    def test_08_name_required(self):
        self._auth(self.fm_a)
        response = self.client.post(
            self.list_url,
            self._create_payload(name=""),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)

    def test_09_date_range_validation(self):
        self._auth(self.fm_a)
        today = date.today()
        response = self.client.post(
            self.list_url,
            self._create_payload(
                planned_start_date=str(today),
                planned_end_date=str(today - timedelta(days=1)),
            ),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("planned_end_date", response.data)

    def test_10_pm_must_same_tenant(self):
        self._auth(self.fm_a)
        response = self.client.post(
            self.list_url,
            self._create_payload(project_manager=str(self.other_tenant_user.id)),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("project_manager", response.data)

    def test_11_inactive_pm_rejected(self):
        self._auth(self.fm_a)
        response = self.client.post(
            self.list_url,
            self._create_payload(project_manager=str(self.inactive_user.id)),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("project_manager", response.data)

    def test_12_org_building_validation(self):
        self._auth(self.fm_a)
        # Org from other tenant
        response = self.client.post(
            self.list_url,
            self._create_payload(organization=str(self.org_b.id)),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Building from other tenant
        response = self.client.post(
            self.list_url,
            self._create_payload(building=str(self.building_b.id)),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # CRUD / soft delete
    # ------------------------------------------------------------------

    def test_13_detail_update_delete(self):
        created = self._create_project(name="Lifecycle")
        project_id = created.data["id"]
        detail_url = reverse("project-detail", args=[project_id])

        self._auth(self.fm_a)
        detail = self.client.get(detail_url)
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["name"], "Lifecycle")
        self.assertIn("members", detail.data)
        self.assertIn("recent_history", detail.data)

        patch = self.client.patch(
            detail_url,
            {"name": "Lifecycle Updated", "priority": Project.Priority.HIGH},
            format="json",
        )
        self.assertEqual(patch.status_code, status.HTTP_200_OK)
        self.assertEqual(patch.data["name"], "Lifecycle Updated")
        self.assertEqual(patch.data["priority"], Project.Priority.HIGH)
        self.assertEqual(
            patch.data["completion_percentage"],
            "0.00",
        )

        delete = self.client.delete(detail_url)
        self.assertEqual(delete.status_code, status.HTTP_204_NO_CONTENT)
        project = Project.objects.get(pk=project_id)
        self.assertTrue(project.is_deleted)
        self.assertIsNotNone(project.deleted_at)

    def test_14_deleted_excluded_from_list(self):
        created = self._create_project(name="To Delete")
        project_id = created.data["id"]
        self._auth(self.fm_a)
        self.client.delete(reverse("project-detail", args=[project_id]))
        response = self.client.get(self.list_url)
        ids = [row["id"] for row in response.data["results"]]
        self.assertNotIn(project_id, ids)

    def test_14b_completed_cannot_delete(self):
        created = self._create_project(name="Completed Block")
        project_id = created.data["id"]
        self._auth(self.fm_a)
        self.client.patch(
            reverse("project-detail", args=[project_id]),
            {"status": Project.Status.COMPLETED},
            format="json",
        )
        delete = self.client.delete(reverse("project-detail", args=[project_id]))
        self.assertEqual(delete.status_code, status.HTTP_400_BAD_REQUEST)

    def test_14c_completion_percentage_readonly(self):
        created = self._create_project()
        project_id = created.data["id"]
        self._auth(self.fm_a)
        response = self.client.patch(
            reverse("project-detail", args=[project_id]),
            {"completion_percentage": "55.00"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(response.data["completion_percentage"]), Decimal("0.00"))

    # ------------------------------------------------------------------
    # Members
    # ------------------------------------------------------------------

    def test_15_membership_duplicates_prevented(self):
        created = self._create_project()
        project_id = created.data["id"]
        members_url = reverse("project-members", args=[project_id])

        self._auth(self.fm_a)
        first = self.client.post(
            members_url,
            {"user": str(self.member_user.id), "role": ProjectMember.Role.MEMBER},
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)

        duplicate = self.client.post(
            members_url,
            {"user": str(self.member_user.id), "role": ProjectMember.Role.VIEWER},
            format="json",
        )
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)

    def test_16_member_must_same_tenant(self):
        created = self._create_project()
        project_id = created.data["id"]
        members_url = reverse("project-members", args=[project_id])
        self._auth(self.fm_a)
        response = self.client.post(
            members_url,
            {"user": str(self.other_tenant_user.id), "role": ProjectMember.Role.MEMBER},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_17_member_permissions(self):
        created = self._create_project(project_manager=str(self.pm_user.id))
        project_id = created.data["id"]
        members_url = reverse("project-members", args=[project_id])

        self._auth(self.viewer_a)
        denied = self.client.post(
            members_url,
            {"user": str(self.member_user.id), "role": ProjectMember.Role.MEMBER},
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self._auth(self.fm_a)
        allowed = self.client.post(
            members_url,
            {"user": str(self.member_user.id), "role": ProjectMember.Role.MEMBER},
            format="json",
        )
        self.assertEqual(allowed.status_code, status.HTTP_201_CREATED, allowed.data)

        member_id = allowed.data["id"]
        destroy_url = reverse(
            "project-destroy-member",
            kwargs={"pk": project_id, "member_id": member_id},
        )
        removed = self.client.delete(destroy_url)
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)

    def test_18_pm_membership_consistency(self):
        created = self._create_project(project_manager=str(self.pm_user.id))
        project_id = created.data["id"]
        membership = ProjectMember.objects.get(
            project_id=project_id,
            user=self.pm_user,
            is_deleted=False,
        )
        self.assertEqual(membership.role, ProjectMember.Role.PROJECT_MANAGER)
        self.assertTrue(membership.is_active)

        self._auth(self.fm_a)
        self.client.patch(
            reverse("project-detail", args=[project_id]),
            {"project_manager": str(self.member_user.id)},
            format="json",
        )
        membership.refresh_from_db()
        self.assertEqual(membership.role, ProjectMember.Role.MEMBER)
        new_pm = ProjectMember.objects.get(
            project_id=project_id,
            user=self.member_user,
            is_deleted=False,
        )
        self.assertEqual(new_pm.role, ProjectMember.Role.PROJECT_MANAGER)

    # ------------------------------------------------------------------
    # Filters / search / sort / pagination / metrics / history
    # ------------------------------------------------------------------

    def test_19_search_filters_sort_pagination(self):
        self._create_project(name="Alpha Chiller", description="north wing")
        self._create_project(
            name="Beta Roof",
            description="south wing",
            status=Project.Status.PLANNED,
            priority=Project.Priority.HIGH,
            project_manager=str(self.pm_user.id),
            building=str(self.building_a.id),
            planned_start_date=str(date.today()),
            planned_end_date=str(date.today() + timedelta(days=30)),
        )

        self._auth(self.fm_a)
        search = self.client.get(self.list_url, {"search": "Chiller"})
        self.assertEqual(search.status_code, status.HTTP_200_OK)
        self.assertTrue(
            any("Chiller" in row["name"] for row in search.data["results"])
        )

        status_filter = self.client.get(
            self.list_url, {"status": Project.Status.PLANNED}
        )
        self.assertTrue(
            all(
                row["status"] == Project.Status.PLANNED
                for row in status_filter.data["results"]
            )
        )

        priority_filter = self.client.get(
            self.list_url, {"priority": Project.Priority.HIGH}
        )
        self.assertTrue(
            all(
                row["priority"] == Project.Priority.HIGH
                for row in priority_filter.data["results"]
            )
        )

        org_filter = self.client.get(
            self.list_url, {"organization": str(self.org_a.id)}
        )
        self.assertGreaterEqual(org_filter.data["count"], 1)

        building_filter = self.client.get(
            self.list_url, {"building": str(self.building_a.id)}
        )
        self.assertTrue(
            all(
                str(row["building"]) == str(self.building_a.id)
                for row in building_filter.data["results"]
            )
        )

        pm_filter = self.client.get(
            self.list_url, {"project_manager": str(self.pm_user.id)}
        )
        self.assertTrue(
            all(
                str(row["project_manager"]) == str(self.pm_user.id)
                for row in pm_filter.data["results"]
            )
        )

        date_filter = self.client.get(
            self.list_url,
            {
                "planned_start_date_from": str(date.today()),
                "planned_end_date_to": str(date.today() + timedelta(days=60)),
            },
        )
        self.assertEqual(date_filter.status_code, status.HTTP_200_OK)

        ordered = self.client.get(self.list_url, {"ordering": "name"})
        names = [row["name"] for row in ordered.data["results"]]
        self.assertEqual(names, sorted(names))

        page = self.client.get(self.list_url, {"page_size": 1})
        self.assertEqual(len(page.data["results"]), 1)
        self.assertIn("count", page.data)

        metrics = self.client.get(reverse("project-metrics"))
        self.assertEqual(metrics.status_code, status.HTTP_200_OK)
        for key in (
            "total",
            "draft",
            "planned",
            "in_progress",
            "on_hold",
            "delayed",
            "completed",
        ):
            self.assertIn(key, metrics.data)

    def test_20_audit_history(self):
        created = self._create_project(name="Audited")
        project_id = created.data["id"]
        self._auth(self.fm_a)
        self.client.patch(
            reverse("project-detail", args=[project_id]),
            {"description": "Changed"},
            format="json",
        )
        history = self.client.get(reverse("project-history", args=[project_id]))
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        actions = [row["action"] for row in history.data["results"]]
        self.assertIn("created", actions)
        self.assertIn("updated", actions)
        self.assertTrue(
            ProjectHistory.objects.filter(project_id=project_id).exists()
        )

    # ------------------------------------------------------------------
    # Attachments
    # ------------------------------------------------------------------

    def test_21_attachment_auth_and_no_path_exposure(self):
        created = self._create_project(name="Attach Me")
        project_id = created.data["id"]

        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(
                ATTACHMENT_STORAGE_BACKEND="local",
                ATTACHMENT_STORAGE_ROOT=str(Path(tmp)),
                ATTACHMENT_MAX_UPLOAD_BYTES=1024,
            ):
                self._auth(self.fm_a)
                upload = self.client.post(
                    reverse("attachments-list"),
                    {
                        "file": SimpleUploadedFile(
                            "evidence.jpg", JPEG_BYTES, content_type="image/jpeg"
                        ),
                        "owner_type": AttachmentOwnerType.PROJECT,
                        "owner_id": project_id,
                    },
                    format="multipart",
                )
                self.assertEqual(
                    upload.status_code, status.HTTP_201_CREATED, upload.data
                )
                self.assertNotIn("storage_key", upload.data)
                self.assertNotIn("file_path", upload.data)
                self.assertNotIn("path", upload.data)

                listed = self.client.get(
                    reverse("attachments-list"),
                    {
                        "owner_type": AttachmentOwnerType.PROJECT,
                        "owner_id": project_id,
                    },
                )
                self.assertEqual(listed.status_code, status.HTTP_200_OK)
                for row in listed.data["results"]:
                    self.assertNotIn("storage_key", row)

                self._auth(self.employee_a)
                denied = self.client.get(
                    reverse("attachments-list"),
                    {
                        "owner_type": AttachmentOwnerType.PROJECT,
                        "owner_id": project_id,
                    },
                )
                self.assertIn(
                    denied.status_code,
                    (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND),
                )

    # ------------------------------------------------------------------
    # Smoke: other modules still importable
    # ------------------------------------------------------------------

    def test_22_inspection_maintenance_still_importable(self):
        self.assertTrue(hasattr(Inspection, "Status"))
        self.assertTrue(hasattr(MaintenanceWorkOrder, "Status"))
        self.assertTrue(hasattr(Project, "Status"))

    def test_23_viewer_can_list_not_create(self):
        self._create_project()
        self._auth(self.viewer_a)
        listed = self.client.get(self.list_url)
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        created = self.client.post(
            self.list_url, self._create_payload(name="Viewer Block"), format="json"
        )
        self.assertEqual(created.status_code, status.HTTP_403_FORBIDDEN)
