"""FO-108 FacilityOps Module Integration — project operational links."""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.management import call_command
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Permission, Role, RolePermission, UserRole
from apps.fm_tickets.models import FmTicket
from apps.inspection.models import Inspection
from apps.maintenance.models import MaintenanceWorkOrder
from apps.master_data.models import (
    Asset,
    AssetType,
    Building,
    Organization,
    Tenant,
)
from apps.projects.link_service import (
    LINK_TYPE_FM,
    LINK_TYPE_INSPECTION,
    LINK_TYPE_MWO,
    assert_task_has_no_active_operational_links,
    build_safe_summary,
    create_link,
    reverse_project_summaries_for_target,
    soft_delete_link,
    update_link,
    user_can_view_target,
    validate_exactly_one_target,
)
from apps.projects.models import (
    Project,
    ProjectHistory,
    ProjectOperationalLink,
    ProjectTask,
)
from apps.projects.services import soft_delete_project, soft_delete_task

User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class ProjectLinkTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(name="FO108 Tenant A", code="fo108-a")
        cls.tenant_b = Tenant.objects.create(name="FO108 Tenant B", code="fo108-b")
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="FO108 Org A", code="fo108-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="FO108 Org B", code="fo108-org-b"
        )
        cls.building_a = Building.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            name="Building A",
            code="fo108-bldg-a",
        )
        cls.building_b = Building.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            name="Building B",
            code="fo108-bldg-b",
        )
        cls.asset_type_a = AssetType.objects.create(
            tenant=cls.tenant_a, name="Type A", code="fo108-type-a"
        )
        cls.asset_a = Asset.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            asset_type=cls.asset_type_a,
            name="Asset A",
            code="fo108-asset-a",
        )
        cls.asset_type_b = AssetType.objects.create(
            tenant=cls.tenant_b, name="Type B", code="fo108-type-b"
        )
        cls.asset_b = Asset.objects.create(
            tenant=cls.tenant_b,
            organization=cls.org_b,
            building=cls.building_b,
            asset_type=cls.asset_type_b,
            name="Asset B",
            code="fo108-asset-b",
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
            "fo108-fm-a@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )
        cls.fm_b = make_user(
            "fo108-fm-b@example.com", cls.tenant_b, cls.org_b, "facility_manager"
        )
        cls.viewer_a = make_user(
            "fo108-viewer-a@example.com", cls.tenant_a, cls.org_a, "viewer"
        )
        cls.employee_a = make_user(
            "fo108-emp-a@example.com", cls.tenant_a, cls.org_a, "employee"
        )
        cls.pm_user = make_user(
            "fo108-pm-a@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )

        # Dual-auth user: projects access without FM ticket view.
        cls.projects_only = User.objects.create_user(
            email="fo108-proj-only@example.com",
            password="Password123!",
            tenant=cls.tenant_a,
            organization=cls.org_a,
            first_name="Proj",
            last_name="Only",
        )
        custom_role = Role.objects.create(
            code="fo108_projects_only",
            name="FO108 Projects Only",
            is_active=True,
        )
        for code in (
            "projects.view",
            "projects.manage",
            "projects.links.view",
            "projects.links.manage",
            "projects.tasks.view",
            "projects.tasks.manage",
            "maintenance.view",
            "inspection.view",
        ):
            perm = Permission.objects.get(code=code)
            RolePermission.objects.create(role=custom_role, permission=perm)
        UserRole.objects.create(user=cls.projects_only, role=custom_role)

    def setUp(self):
        self._auth(self.fm_a)
        project_resp = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org_a.id),
                "name": "Link Host Project",
                "project_manager": str(self.pm_user.id),
                "planned_start_date": str(date.today() - timedelta(days=30)),
                "planned_end_date": str(date.today() + timedelta(days=60)),
            },
            format="json",
        )
        self.assertEqual(
            project_resp.status_code, status.HTTP_201_CREATED, project_resp.data
        )
        self.project_id = project_resp.data["id"]
        self.project = Project.objects.get(pk=self.project_id)
        self.links_url = reverse(
            "project-link-list", kwargs={"project_id": self.project_id}
        )
        self.options_url = reverse(
            "project-link-options", kwargs={"project_id": self.project_id}
        )
        self.tasks_url = reverse(
            "project-task-list", kwargs={"project_id": self.project_id}
        )

        self.ticket_a = FmTicket.objects.create(
            tenant=self.tenant_a,
            organization=self.org_a,
            building=self.building_a,
            requester=self.fm_a,
            title="Ticket Alpha",
            description="A",
            status=FmTicket.Status.OPEN,
            priority=FmTicket.Priority.MEDIUM,
        )
        self.ticket_a2 = FmTicket.objects.create(
            tenant=self.tenant_a,
            organization=self.org_a,
            building=self.building_a,
            requester=self.fm_a,
            title="Ticket Beta Searchable",
            description="B",
            status=FmTicket.Status.OPEN,
            priority=FmTicket.Priority.LOW,
        )
        self.ticket_b = FmTicket.objects.create(
            tenant=self.tenant_b,
            organization=self.org_b,
            building=self.building_b,
            requester=self.fm_b,
            title="Ticket Other Tenant",
            description="X",
            status=FmTicket.Status.OPEN,
            priority=FmTicket.Priority.MEDIUM,
        )
        self.wo_a = MaintenanceWorkOrder.objects.create(
            tenant=self.tenant_a,
            organization=self.org_a,
            building=self.building_a,
            asset=self.asset_a,
            requester=self.fm_a,
            title="WO Alpha",
            description="Work",
            status=MaintenanceWorkOrder.Status.OPEN,
            priority=MaintenanceWorkOrder.Priority.MEDIUM,
        )
        self.wo_b = MaintenanceWorkOrder.objects.create(
            tenant=self.tenant_b,
            organization=self.org_b,
            building=self.building_b,
            asset=self.asset_b,
            requester=self.fm_b,
            title="WO Other",
            description="Work",
            status=MaintenanceWorkOrder.Status.OPEN,
            priority=MaintenanceWorkOrder.Priority.MEDIUM,
        )
        self.inspection_a = Inspection.objects.create(
            tenant=self.tenant_a,
            organization=self.org_a,
            building=self.building_a,
            title="Inspection Alpha",
            status=Inspection.Status.SCHEDULED,
            priority=Inspection.Priority.MEDIUM,
        )
        self.inspection_b = Inspection.objects.create(
            tenant=self.tenant_b,
            organization=self.org_b,
            building=self.building_b,
            title="Inspection Other",
            status=Inspection.Status.SCHEDULED,
            priority=Inspection.Priority.MEDIUM,
        )

    def _auth(self, user):
        self.client.force_authenticate(user=user)

    def _link_detail(self, link_id):
        return reverse(
            "project-link-detail",
            kwargs={"project_id": self.project_id, "pk": link_id},
        )

    def _create_task(self, **overrides):
        payload = {
            "name": "Linked Task",
            "status": "not_started",
            "priority": "medium",
            "person_in_charge": str(self.pm_user.id),
            **overrides,
        }
        response = self.client.post(self.tasks_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response.data

    def _create_link(self, **payload):
        return self.client.post(self.links_url, payload, format="json")

    # ------------------------------------------------------------------
    # Create / list / retrieve
    # ------------------------------------------------------------------

    def test_01_create_fm_ticket_link(self):
        response = self._create_link(
            link_type="fm_ticket",
            fm_ticket=str(self.ticket_a.id),
            relationship="related",
            notes="tie-in",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(response.data["target_accessible"])
        self.assertEqual(response.data["link_type"], "fm_ticket")
        self.assertEqual(response.data["target_id"], str(self.ticket_a.id))
        self.assertEqual(response.data["target_number"], self.ticket_a.ticket_number)
        self.assertTrue(
            ProjectHistory.objects.filter(
                project=self.project, action="operational_link_created"
            ).exists()
        )

    def test_02_create_maintenance_work_order_link(self):
        response = self._create_link(
            link_type="maintenance_work_order",
            maintenance_work_order=str(self.wo_a.id),
            relationship="execution",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["link_type"], "maintenance_work_order")
        self.assertEqual(response.data["target_id"], str(self.wo_a.id))

    def test_03_create_inspection_link(self):
        response = self._create_link(
            link_type="inspection",
            inspection=str(self.inspection_a.id),
            relationship="evidence",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["link_type"], "inspection")
        self.assertEqual(response.data["target_id"], str(self.inspection_a.id))

    def test_04_list_and_retrieve_link(self):
        created = self._create_link(
            fm_ticket=str(self.ticket_a.id), relationship="source"
        )
        self.assertEqual(created.status_code, 201, created.data)
        listed = self.client.get(self.links_url)
        self.assertEqual(listed.status_code, 200)
        results = listed.data.get("results", listed.data)
        self.assertEqual(len(results), 1)
        detail = self.client.get(self._link_detail(created.data["id"]))
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["id"], created.data["id"])

    def test_05_infer_link_type_from_target(self):
        response = self._create_link(fm_ticket=str(self.ticket_a.id))
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["link_type"], "fm_ticket")

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def test_06_exactly_one_target_required(self):
        response = self._create_link(relationship="related")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self._create_link(
            fm_ticket=str(self.ticket_a.id),
            inspection=str(self.inspection_a.id),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_07_link_type_mismatch_rejected(self):
        response = self._create_link(
            link_type="inspection",
            fm_ticket=str(self.ticket_a.id),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_08_duplicate_active_link_rejected(self):
        first = self._create_link(fm_ticket=str(self.ticket_a.id))
        self.assertEqual(first.status_code, 201, first.data)
        second = self._create_link(fm_ticket=str(self.ticket_a.id))
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_09_soft_deleted_link_allows_relink(self):
        first = self._create_link(fm_ticket=str(self.ticket_a.id))
        self.assertEqual(first.status_code, 201, first.data)
        deleted = self.client.delete(self._link_detail(first.data["id"]))
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        second = self._create_link(fm_ticket=str(self.ticket_a.id))
        self.assertEqual(second.status_code, 201, second.data)

    def test_10_cross_tenant_target_rejected(self):
        response = self._create_link(fm_ticket=str(self.ticket_b.id))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self._create_link(maintenance_work_order=str(self.wo_b.id))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self._create_link(inspection=str(self.inspection_b.id))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_11_validate_exactly_one_target_helper(self):
        with self.assertRaises(DjangoValidationError):
            validate_exactly_one_target()
        with self.assertRaises(DjangoValidationError):
            validate_exactly_one_target(
                fm_ticket=self.ticket_a, inspection=self.inspection_a
            )
        field = validate_exactly_one_target(fm_ticket=self.ticket_a)
        self.assertEqual(field, "fm_ticket")

    # ------------------------------------------------------------------
    # Update / delete
    # ------------------------------------------------------------------

    def test_12_update_relationship_notes_task_only(self):
        task = self._create_task(name="Assoc Task")
        created = self._create_link(fm_ticket=str(self.ticket_a.id))
        self.assertEqual(created.status_code, 201, created.data)
        response = self.client.patch(
            self._link_detail(created.data["id"]),
            {
                "relationship": "follow_up",
                "notes": "updated notes",
                "project_task": task["id"],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["relationship"], "follow_up")
        self.assertEqual(response.data["notes"], "updated notes")
        self.assertEqual(response.data["project_task_id"], task["id"])
        self.assertTrue(
            ProjectHistory.objects.filter(
                project=self.project, action="operational_link_updated"
            ).exists()
        )

    def test_13_update_cannot_change_target(self):
        created = self._create_link(fm_ticket=str(self.ticket_a.id))
        link = ProjectOperationalLink.objects.get(pk=created.data["id"])
        with self.assertRaises(DjangoValidationError):
            update_link(
                link=link,
                actor=self.fm_a,
                data={"fm_ticket": self.ticket_a2},
            )

    def test_14_soft_delete_link_records_history(self):
        created = self._create_link(fm_ticket=str(self.ticket_a.id))
        response = self.client.delete(self._link_detail(created.data["id"]))
        self.assertEqual(response.status_code, 204)
        link = ProjectOperationalLink.objects.get(pk=created.data["id"])
        self.assertTrue(link.is_deleted)
        self.assertTrue(
            ProjectHistory.objects.filter(
                project=self.project, action="operational_link_removed"
            ).exists()
        )

    # ------------------------------------------------------------------
    # Task association / soft-delete block
    # ------------------------------------------------------------------

    def test_15_create_with_project_task(self):
        task = self._create_task()
        response = self._create_link(
            fm_ticket=str(self.ticket_a.id),
            project_task=task["id"],
            relationship="corrective_action",
        )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["project_task_id"], task["id"])

    def test_16_task_from_other_project_rejected(self):
        other = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org_a.id),
                "name": "Other Project",
                "project_manager": str(self.pm_user.id),
            },
            format="json",
        )
        self.assertEqual(other.status_code, 201, other.data)
        other_task = self.client.post(
            reverse("project-task-list", kwargs={"project_id": other.data["id"]}),
            {
                "name": "Foreign",
                "person_in_charge": str(self.pm_user.id),
            },
            format="json",
        )
        self.assertEqual(other_task.status_code, 201, other_task.data)
        response = self._create_link(
            fm_ticket=str(self.ticket_a.id),
            project_task=other_task.data["id"],
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_17_soft_delete_task_blocked_by_active_link(self):
        task = self._create_task()
        created = self._create_link(
            fm_ticket=str(self.ticket_a.id),
            project_task=task["id"],
        )
        self.assertEqual(created.status_code, 201, created.data)
        response = self.client.delete(
            reverse(
                "project-task-detail",
                kwargs={"project_id": self.project_id, "pk": task["id"]},
            )
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("operational_link", str(response.data).lower())

    def test_18_soft_deleted_link_does_not_block_task_delete(self):
        task = self._create_task()
        created = self._create_link(
            fm_ticket=str(self.ticket_a.id),
            project_task=task["id"],
        )
        self.client.delete(self._link_detail(created.data["id"]))
        response = self.client.delete(
            reverse(
                "project-task-detail",
                kwargs={"project_id": self.project_id, "pk": task["id"]},
            )
        )
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_19_assert_task_links_helper_payload(self):
        task = ProjectTask.objects.get(pk=self._create_task()["id"])
        create_link(
            project=self.project,
            actor=self.fm_a,
            fm_ticket=self.ticket_a,
            project_task=task,
        )
        with self.assertRaises(DjangoValidationError) as ctx:
            assert_task_has_no_active_operational_links(task)
        self.assertIn("operational_link_ids", ctx.exception.message_dict)

    # ------------------------------------------------------------------
    # Dual auth / permissions
    # ------------------------------------------------------------------

    def test_20_dual_auth_restricted_summary(self):
        link = create_link(
            project=self.project,
            actor=self.fm_a,
            fm_ticket=self.ticket_a,
        )
        summary = build_safe_summary(self.projects_only, link)
        self.assertFalse(summary["target_accessible"])
        self.assertNotIn("target_title", summary)
        self.assertNotIn("target_number", summary)

        self._auth(self.projects_only)
        listed = self.client.get(self.links_url)
        self.assertEqual(listed.status_code, 200)
        results = listed.data.get("results", listed.data)
        self.assertEqual(len(results), 1)
        self.assertFalse(results[0]["target_accessible"])

    def test_21_projects_only_cannot_create_fm_link(self):
        self._auth(self.projects_only)
        response = self._create_link(fm_ticket=str(self.ticket_a.id))
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_400_BAD_REQUEST),
        )

    def test_22_viewer_can_list_not_manage(self):
        self._create_link(fm_ticket=str(self.ticket_a.id))
        self._auth(self.viewer_a)
        listed = self.client.get(self.links_url)
        self.assertEqual(listed.status_code, 200)
        create = self._create_link(fm_ticket=str(self.ticket_a2.id))
        self.assertEqual(create.status_code, status.HTTP_403_FORBIDDEN)

    def test_23_employee_denied_project_links(self):
        self._auth(self.employee_a)
        response = self.client.get(self.links_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_24_cross_tenant_project_access_denied(self):
        self._auth(self.fm_b)
        response = self.client.get(self.links_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # ------------------------------------------------------------------
    # Link options
    # ------------------------------------------------------------------

    def test_25_link_options_fm_ticket_search(self):
        response = self.client.get(
            self.options_url,
            {"type": "fm_ticket", "search": "Searchable"},
        )
        self.assertEqual(response.status_code, 200, response.data)
        results = response.data.get("results", response.data)
        ids = {item["id"] for item in results}
        self.assertIn(str(self.ticket_a2.id), ids)
        self.assertNotIn(str(self.ticket_b.id), ids)

    def test_26_link_options_excludes_already_linked(self):
        self._create_link(fm_ticket=str(self.ticket_a.id))
        response = self.client.get(self.options_url, {"type": "fm_ticket"})
        self.assertEqual(response.status_code, 200)
        results = response.data.get("results", response.data)
        ids = {item["id"] for item in results}
        self.assertNotIn(str(self.ticket_a.id), ids)
        self.assertIn(str(self.ticket_a2.id), ids)

    def test_27_link_options_mwo_and_inspection(self):
        for link_type, target_id in (
            ("maintenance_work_order", str(self.wo_a.id)),
            ("inspection", str(self.inspection_a.id)),
        ):
            response = self.client.get(self.options_url, {"type": link_type})
            self.assertEqual(response.status_code, 200, response.data)
            results = response.data.get("results", response.data)
            ids = {item["id"] for item in results}
            self.assertIn(target_id, ids)

    def test_28_link_options_requires_type(self):
        response = self.client.get(self.options_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # ------------------------------------------------------------------
    # No target mutation / soft-delete project
    # ------------------------------------------------------------------

    def test_29_create_link_does_not_mutate_target(self):
        before_status = self.ticket_a.status
        before_title = self.ticket_a.title
        before_updated = self.ticket_a.updated_at
        self._create_link(fm_ticket=str(self.ticket_a.id), notes="private note")
        self.ticket_a.refresh_from_db()
        self.assertEqual(self.ticket_a.status, before_status)
        self.assertEqual(self.ticket_a.title, before_title)
        self.assertEqual(self.ticket_a.updated_at, before_updated)

    def test_30_soft_delete_project_hides_links_without_cascade_targets(self):
        self._create_link(fm_ticket=str(self.ticket_a.id))
        soft_delete_project(project=self.project, actor=self.fm_a)
        self.ticket_a.refresh_from_db()
        self.assertFalse(self.ticket_a.is_deleted)
        listed = self.client.get(self.links_url)
        self.assertEqual(listed.status_code, status.HTTP_404_NOT_FOUND)
        # Link row remains (not cascade-deleted with target); project soft-deleted.
        self.assertTrue(
            ProjectOperationalLink.objects.filter(
                project_id=self.project_id, is_deleted=False
            ).exists()
        )

    # ------------------------------------------------------------------
    # Reverse lookup
    # ------------------------------------------------------------------

    def test_31_reverse_lookup_fm_ticket_linked_projects(self):
        self._create_link(
            fm_ticket=str(self.ticket_a.id), relationship="related"
        )
        url = reverse("fm-ticket-detail", kwargs={"pk": self.ticket_a.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("linked_projects", response.data)
        self.assertEqual(len(response.data["linked_projects"]), 1)
        self.assertEqual(
            response.data["linked_projects"][0]["id"], self.project_id
        )

    def test_32_reverse_lookup_work_order(self):
        self._create_link(maintenance_work_order=str(self.wo_a.id))
        url = reverse("maintenance-work-order-detail", kwargs={"pk": self.wo_a.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data["linked_projects"]), 1)

    def test_33_reverse_lookup_inspection(self):
        self._create_link(inspection=str(self.inspection_a.id))
        url = reverse("inspection-detail", kwargs={"pk": self.inspection_a.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(len(response.data["linked_projects"]), 1)

    def test_34_employee_requester_reverse_lookup_empty(self):
        emp_ticket = FmTicket.objects.create(
            tenant=self.tenant_a,
            organization=self.org_a,
            building=self.building_a,
            requester=self.employee_a,
            title="Employee Ticket",
            description="E",
            status=FmTicket.Status.OPEN,
            priority=FmTicket.Priority.MEDIUM,
        )
        create_link(
            project=self.project,
            actor=self.fm_a,
            fm_ticket=emp_ticket,
        )
        self._auth(self.employee_a)
        url = reverse("fm-ticket-detail", kwargs={"pk": emp_ticket.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200, response.data)
        # Employee detail serializer has no linked_projects, or empty via helper.
        linked = response.data.get("linked_projects", [])
        self.assertEqual(linked, [])

    def test_35_reverse_helper_respects_project_access(self):
        create_link(
            project=self.project,
            actor=self.fm_a,
            fm_ticket=self.ticket_a,
        )
        summaries = reverse_project_summaries_for_target(
            self.fm_b, LINK_TYPE_FM, self.ticket_a
        )
        self.assertEqual(summaries, [])
        summaries_ok = reverse_project_summaries_for_target(
            self.fm_a, LINK_TYPE_FM, self.ticket_a
        )
        self.assertEqual(len(summaries_ok), 1)

    # ------------------------------------------------------------------
    # Timeline / user_can_view_target / relationships
    # ------------------------------------------------------------------

    def test_36_timeline_includes_link_events(self):
        created = self._create_link(fm_ticket=str(self.ticket_a.id))
        self.client.patch(
            self._link_detail(created.data["id"]),
            {"relationship": "evidence"},
            format="json",
        )
        self.client.delete(self._link_detail(created.data["id"]))
        timeline = self.client.get(
            reverse("project-timeline-list", kwargs={"project_id": self.project_id})
        )
        self.assertEqual(timeline.status_code, 200)
        results = timeline.data.get("results", timeline.data)
        event_types = {entry["event_type"] for entry in results}
        self.assertIn("operational_link_created", event_types)
        self.assertIn("operational_link_updated", event_types)
        self.assertIn("operational_link_removed", event_types)

    def test_37_user_can_view_target_checks(self):
        self.assertTrue(
            user_can_view_target(self.fm_a, LINK_TYPE_FM, self.ticket_a)
        )
        self.assertFalse(
            user_can_view_target(self.projects_only, LINK_TYPE_FM, self.ticket_a)
        )
        self.assertTrue(
            user_can_view_target(self.fm_a, LINK_TYPE_MWO, self.wo_a)
        )
        self.assertTrue(
            user_can_view_target(self.fm_a, LINK_TYPE_INSPECTION, self.inspection_a)
        )

    def test_38_all_relationship_values_accepted(self):
        for idx, rel in enumerate(ProjectOperationalLink.Relationship.values):
            ticket = FmTicket.objects.create(
                tenant=self.tenant_a,
                organization=self.org_a,
                building=self.building_a,
                requester=self.fm_a,
                title=f"Rel Ticket {idx}",
                description="r",
                status=FmTicket.Status.OPEN,
                priority=FmTicket.Priority.LOW,
            )
            response = self._create_link(
                fm_ticket=str(ticket.id), relationship=rel
            )
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(response.data["relationship"], rel)

    def test_39_model_check_constraint_exactly_one(self):
        link = ProjectOperationalLink(
            tenant=self.tenant_a,
            project=self.project,
            link_type="fm_ticket",
            fm_ticket=self.ticket_a,
            inspection=self.inspection_a,
            relationship="related",
        )
        with self.assertRaises(DjangoValidationError):
            link.save()

    def test_40_soft_delete_link_service(self):
        link = create_link(
            project=self.project,
            actor=self.fm_a,
            inspection=self.inspection_a,
        )
        soft_delete_link(link=link, actor=self.fm_a)
        link.refresh_from_db()
        self.assertTrue(link.is_deleted)

    def test_41_clear_project_task_on_update(self):
        task = self._create_task()
        created = self._create_link(
            fm_ticket=str(self.ticket_a.id),
            project_task=task["id"],
        )
        response = self.client.patch(
            self._link_detail(created.data["id"]),
            {"project_task": None},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(response.data["project_task_id"])

    def test_42_same_target_on_two_projects_allowed(self):
        other = self.client.post(
            reverse("project-list"),
            {
                "organization": str(self.org_a.id),
                "name": "Second Project",
                "project_manager": str(self.pm_user.id),
            },
            format="json",
        )
        self.assertEqual(other.status_code, 201, other.data)
        first = self._create_link(fm_ticket=str(self.ticket_a.id))
        self.assertEqual(first.status_code, 201, first.data)
        second = self.client.post(
            reverse("project-link-list", kwargs={"project_id": other.data["id"]}),
            {"fm_ticket": str(self.ticket_a.id)},
            format="json",
        )
        self.assertEqual(second.status_code, 201, second.data)

    def test_43_deleted_target_cannot_be_linked(self):
        self.ticket_a2.is_deleted = True
        self.ticket_a2.save(update_fields=["is_deleted", "updated_at"])
        response = self._create_link(fm_ticket=str(self.ticket_a2.id))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_44_wo_link_does_not_mutate_wo(self):
        before = self.wo_a.status
        self._create_link(
            maintenance_work_order=str(self.wo_a.id),
            relationship="execution",
        )
        self.wo_a.refresh_from_db()
        self.assertEqual(self.wo_a.status, before)

    def test_45_inspection_link_does_not_mutate_inspection(self):
        before = self.inspection_a.status
        self._create_link(inspection=str(self.inspection_a.id))
        self.inspection_a.refresh_from_db()
        self.assertEqual(self.inspection_a.status, before)
