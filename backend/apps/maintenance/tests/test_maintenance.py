from datetime import timedelta

from apps.access_control.models import Permission, Role, RolePermission, UserRole
from apps.maintenance.models import (
    MaintenanceAssignment,
    MaintenanceAttachment,
    MaintenanceCompletion,
    MaintenanceEscalation,
    MaintenanceHistory,
    MaintenanceLabor,
    MaintenanceMaterial,
    MaintenanceSLA,
    MaintenanceStatusHistory,
    MaintenanceTask,
    MaintenanceWorkOrder,
)
from apps.maintenance.tasks import check_maintenance_sla_breaches
from apps.maintenance.work_order_escalation_service import check_work_order_escalations
from apps.maintenance.work_order_sla_service import recalculate_work_order_sla
from apps.master_data.models import (
    Area,
    Asset,
    AssetType,
    Building,
    Department,
    Floor,
    Organization,
    Tenant,
)
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class MaintenanceTestDataMixin:
    def create_maintenance_permissions(self):
        permission_definitions = [
            ("maintenance.view", "maintenance", "view", "View maintenance work orders"),
            (
                "maintenance.create",
                "maintenance",
                "create",
                "Create maintenance work orders",
            ),
            (
                "maintenance.update",
                "maintenance",
                "update",
                "Update maintenance work orders",
            ),
            (
                "maintenance.submit",
                "maintenance",
                "submit",
                "Submit maintenance work orders",
            ),
            (
                "maintenance.assign",
                "maintenance",
                "assign",
                "Assign maintenance work orders",
            ),
            (
                "maintenance.reassign",
                "maintenance",
                "reassign",
                "Reassign maintenance work orders",
            ),
            (
                "maintenance.unassign",
                "maintenance",
                "unassign",
                "Unassign maintenance work orders",
            ),
            (
                "maintenance.view_assignment",
                "maintenance",
                "view_assignment",
                "View assignment history",
            ),
            (
                "maintenance.start",
                "maintenance",
                "start",
                "Start maintenance work orders",
            ),
            ("maintenance.hold", "maintenance", "hold", "Hold maintenance work orders"),
            (
                "maintenance.resume",
                "maintenance",
                "resume",
                "Resume maintenance work orders",
            ),
            (
                "maintenance.complete",
                "maintenance",
                "complete",
                "Complete maintenance work orders",
            ),
            (
                "maintenance.cancel",
                "maintenance",
                "cancel",
                "Cancel maintenance work orders",
            ),
            (
                "maintenance.reopen",
                "maintenance",
                "reopen",
                "Reopen maintenance work orders",
            ),
            (
                "maintenance.manage",
                "maintenance",
                "manage",
                "Manage maintenance work orders",
            ),
            (
                "maintenance.work_order.view",
                "maintenance.work_order",
                "view",
                "View maintenance work orders",
            ),
            (
                "maintenance.work_order.create",
                "maintenance.work_order",
                "create",
                "Create maintenance work orders",
            ),
        ]
        permissions = {}
        for code, module, action, name in permission_definitions:
            permissions[code] = Permission.objects.create(
                code=code,
                module=module,
                action=action,
                name=name,
            )
        return permissions

    def assign_permissions(self, user, *permission_codes):
        role = Role.objects.create(
            name=f"Role {user.email}",
            code=f"role-{user.email.split('@')[0]}",
        )
        for permission_code in permission_codes:
            RolePermission.objects.create(
                role=role,
                permission=Permission.objects.get(code=permission_code),
            )
        UserRole.objects.create(user=user, role=role)

    def create_master_data(self):
        tenant = Tenant.objects.create(name="Tenant", code="tenant")
        organization = Organization.objects.create(
            tenant=tenant,
            name="Organization",
            code="organization",
        )
        department = Department.objects.create(
            tenant=tenant,
            organization=organization,
            name="Facilities",
            code="facilities",
        )
        building = Building.objects.create(
            tenant=tenant,
            organization=organization,
            name="Main Building",
            code="main-building",
        )
        floor = Floor.objects.create(
            tenant=tenant,
            building=building,
            name="Ground Floor",
            code="ground-floor",
            level_number=0,
        )
        area = Area.objects.create(
            tenant=tenant,
            building=building,
            floor=floor,
            name="Lobby",
            code="lobby",
        )
        asset_type = AssetType.objects.create(
            tenant=tenant,
            name="General Equipment",
            code="general-equipment",
        )
        asset = Asset.objects.create(
            tenant=tenant,
            organization=organization,
            building=building,
            floor=floor,
            area=area,
            asset_type=asset_type,
            name="Lobby Fan",
            code="lobby-fan",
        )
        return {
            "tenant": tenant,
            "organization": organization,
            "department": department,
            "building": building,
            "floor": floor,
            "area": area,
            "asset": asset,
        }

    def create_work_order_payload(self, data):
        return {
            "tenant": str(data["tenant"].id),
            "organization": str(data["organization"].id),
            "department": str(data["department"].id),
            "building": str(data["building"].id),
            "floor": str(data["floor"].id),
            "area": str(data["area"].id),
            "asset": str(data["asset"].id),
            "title": "Replace AHU belt",
            "description": "Drive belt needs replacement.",
            "priority": MaintenanceWorkOrder.Priority.HIGH,
            "due_at": (timezone.now() + timedelta(days=1)).isoformat(),
        }


class MaintenanceModelTests(MaintenanceTestDataMixin, APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="requester@example.com",
            password="Password123!",
        )
        self.assignee = User.objects.create_user(
            email="assignee@example.com",
            password="Password123!",
        )
        self.data = self.create_master_data()

    def test_work_order_creation_generates_number_and_sla(self):
        work_order = MaintenanceWorkOrder.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            asset=self.data["asset"],
            requester=self.user,
            assignee=self.assignee,
            title="Generator inspection",
            description="Inspect generator condition.",
            priority=MaintenanceWorkOrder.Priority.MEDIUM,
        )
        sla = MaintenanceSLA.objects.create(
            work_order=work_order,
            response_due_at=timezone.now() + timedelta(hours=4),
            resolution_due_at=timezone.now() + timedelta(days=1),
        )

        self.assertTrue(work_order.work_order_number.startswith("MWO-"))
        self.assertEqual(str(work_order), work_order.work_order_number)
        self.assertEqual(sla.work_order, work_order)

    def test_related_models_create_expected_relations(self):
        work_order = MaintenanceWorkOrder.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            asset=self.data["asset"],
            requester=self.user,
            title="Pump repair",
            description="Repair the booster pump.",
            priority=MaintenanceWorkOrder.Priority.HIGH,
        )
        assignment = MaintenanceAssignment.objects.create(
            work_order=work_order,
            assigned_to=self.assignee,
            assigned_by=self.user,
        )
        task = MaintenanceTask.objects.create(
            work_order=work_order,
            title="Inspect pump",
            sequence=1,
        )
        material = MaintenanceMaterial.objects.create(
            work_order=work_order,
            task=task,
            name="Seal kit",
            quantity="1.00",
            unit="kit",
        )
        labor = MaintenanceLabor.objects.create(
            work_order=work_order,
            task=task,
            performed_by=self.assignee,
            description="Inspection labor",
            hours="1.50",
        )
        history = MaintenanceHistory.objects.create(
            work_order=work_order,
            actor=self.user,
            action="created",
            description="Work order created.",
        )
        status_history = MaintenanceStatusHistory.objects.create(
            work_order=work_order,
            from_status=None,
            to_status=MaintenanceWorkOrder.Status.OPEN,
            changed_by=self.user,
        )

        self.assertEqual(assignment.work_order, work_order)
        self.assertEqual(task.work_order, work_order)
        self.assertEqual(material.work_order, work_order)
        self.assertEqual(labor.work_order, work_order)
        self.assertEqual(history.work_order, work_order)
        self.assertEqual(status_history.work_order, work_order)


class MaintenanceApiTests(MaintenanceTestDataMixin, APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="manager@example.com",
            password="Password123!",
        )
        self.other_user = User.objects.create_user(
            email="worker@example.com",
            password="Password123!",
        )
        self.viewer = User.objects.create_user(
            email="viewer@example.com",
            password="Password123!",
        )
        self.permissions = self.create_maintenance_permissions()
        self.assign_permissions(
            self.user,
            "maintenance.view",
            "maintenance.create",
            "maintenance.update",
            "maintenance.submit",
            "maintenance.assign",
            "maintenance.start",
            "maintenance.hold",
            "maintenance.resume",
            "maintenance.complete",
            "maintenance.cancel",
            "maintenance.reopen",
            "maintenance.manage",
        )
        self.assign_permissions(self.viewer, "maintenance.view")
        self.data = self.create_master_data()
        for account in (self.user, self.other_user, self.viewer):
            account.tenant = self.data["tenant"]
            account.organization = self.data["organization"]
            account.save(update_fields=("tenant", "organization", "updated_at"))
        self.work_order = MaintenanceWorkOrder.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            asset=self.data["asset"],
            requester=self.user,
            title="Existing work order",
            description="Existing maintenance issue.",
            priority=MaintenanceWorkOrder.Priority.MEDIUM,
            due_at=timezone.now() + timedelta(days=1),
        )
        self.draft_work_order = MaintenanceWorkOrder.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            asset=self.data["asset"],
            requester=self.user,
            title="Draft work order",
            description="Draft maintenance issue.",
            priority=MaintenanceWorkOrder.Priority.LOW,
            status=MaintenanceWorkOrder.Status.DRAFT,
            due_at=timezone.now() + timedelta(days=2),
        )
        MaintenanceSLA.objects.create(
            work_order=self.work_order,
            response_due_at=timezone.now() + timedelta(hours=4),
            resolution_due_at=timezone.now() + timedelta(days=1),
            sla_status=MaintenanceSLA.Status.NOT_STARTED,
        )
        self.overdue_work_order = MaintenanceWorkOrder.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            asset=self.data["asset"],
            requester=self.other_user,
            assignee=self.other_user,
            title="Critical pump outage",
            description="Critical outage in the lobby pump room.",
            priority=MaintenanceWorkOrder.Priority.CRITICAL,
            status=MaintenanceWorkOrder.Status.ASSIGNED,
            requested_at=timezone.now() - timedelta(days=2),
            due_at=timezone.now() - timedelta(days=1),
        )
        MaintenanceAttachment.objects.create(
            work_order=self.overdue_work_order,
            uploaded_by=self.user,
            file_name="pump-photo.jpg",
            file_path="seed/pump-photo.jpg",
            content_type="image/jpeg",
            size_bytes=2048,
            note="Inspection photo.",
        )

    def test_work_order_list_requires_authentication(self):
        response = self.client.get(reverse("maintenance-work-order-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_work_order_list_requires_permission(self):
        self.client.force_authenticate(self.other_user)
        response = self.client.get(reverse("maintenance-work-order-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_work_order_list_returns_data_for_authorized_user(self):
        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("maintenance-work-order-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 3)

    def test_list_and_detail_query_counts_are_bounded(self):
        self.client.force_authenticate(self.user)
        with CaptureQueriesContext(connection) as list_queries:
            list_response = self.client.get(reverse("maintenance-work-order-list"))
        with CaptureQueriesContext(connection) as detail_queries:
            detail_response = self.client.get(
                reverse("maintenance-work-order-detail", args=[self.work_order.id])
            )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertLessEqual(len(list_queries), 12)
        self.assertLessEqual(len(detail_queries), 20)

    def test_exact_work_order_view_permission_is_accepted(self):
        exact_user = User.objects.create_user(
            email="exact-view@example.com",
            password="Password123!",
            tenant=self.data["tenant"],
            organization=self.data["organization"],
        )
        self.assign_permissions(exact_user, "maintenance.work_order.view")
        self.client.force_authenticate(exact_user)

        response = self.client.get(reverse("maintenance-work-order-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 3)

    def test_tenant_scope_blocks_list_detail_and_dashboard_leakage(self):
        other_tenant = Tenant.objects.create(name="Other Tenant", code="other-tenant")
        self.viewer.tenant = other_tenant
        self.viewer.organization = None
        self.viewer.save(update_fields=("tenant", "organization", "updated_at"))
        self.client.force_authenticate(self.viewer)

        list_response = self.client.get(reverse("maintenance-work-order-list"))
        detail_response = self.client.get(
            reverse("maintenance-work-order-detail", args=[self.work_order.id])
        )
        dashboard_response = self.client.get(
            reverse("maintenance-work-order-dashboard")
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 0)
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(dashboard_response.status_code, status.HTTP_200_OK)
        self.assertEqual(dashboard_response.data["total_work_orders"], 0)

    def test_cross_tenant_assignment_is_rejected(self):
        other_tenant = Tenant.objects.create(
            name="Assignment Tenant", code="assignment-tenant"
        )
        cross_tenant_user = User.objects.create_user(
            email="cross-tenant-tech@example.com",
            password="Password123!",
            tenant=other_tenant,
        )
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse("maintenance-work-order-assign", args=[self.work_order.id]),
            {"assigned_to": str(cross_tenant_user.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assigned_to", response.data)

    def test_work_order_list_supports_search_ordering_and_boolean_filters(self):
        self.client.force_authenticate(self.user)
        response = self.client.get(
            reverse("maintenance-work-order-list"),
            {
                "search": "critical outage",
                "ordering": "-priority",
                "overdue": "true",
                "has_attachments": "true",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            response.data["results"][0]["id"], str(self.overdue_work_order.id)
        )
        self.assertEqual(response.data["results"][0]["attachments_count"], 1)

    def test_dashboard_endpoint_returns_summary_metrics(self):
        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("maintenance-work-order-dashboard"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_work_orders"], 3)
        self.assertEqual(response.data["open"], 1)
        self.assertEqual(response.data["assigned"], 1)
        self.assertEqual(response.data["critical"], 1)
        self.assertEqual(response.data["overdue"], 1)

    def test_work_order_create_requires_permission(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.post(
            reverse("maintenance-work-order-list"),
            self.create_work_order_payload(self.data),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_work_order_create_sets_requester_from_authenticated_user(self):
        self.client.force_authenticate(self.user)
        payload = self.create_work_order_payload(self.data)
        payload["requester"] = str(self.other_user.id)
        response = self.client.post(
            reverse("maintenance-work-order-list"),
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_work_order = MaintenanceWorkOrder.objects.get(id=response.data["id"])
        self.assertEqual(created_work_order.requester, self.user)
        self.assertEqual(created_work_order.history_entries.count(), 1)
        self.assertEqual(created_work_order.status_history_entries.count(), 1)
        self.assertTrue(
            MaintenanceSLA.objects.filter(work_order=created_work_order).exists()
        )

    def test_work_order_detail_includes_sla(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            reverse("maintenance-work-order-detail", args=[self.work_order.id])
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["sla"]["sla_status"], MaintenanceSLA.Status.NOT_STARTED
        )

    def test_work_order_update_creates_history_entry(self):
        self.client.force_authenticate(self.user)
        response = self.client.patch(
            reverse("maintenance-work-order-detail", args=[self.work_order.id]),
            {"title": "Updated work order title"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.work_order.refresh_from_db()
        self.assertEqual(self.work_order.title, "Updated work order title")
        self.assertEqual(
            self.work_order.history_entries.filter(action="updated").count(),
            1,
        )

    def test_work_order_create_rejects_missing_asset(self):
        self.client.force_authenticate(self.user)
        payload = self.create_work_order_payload(self.data)
        payload["asset"] = ""
        response = self.client.post(
            reverse("maintenance-work-order-list"),
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("asset", response.data)

    def test_history_endpoint_requires_view_permission(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            reverse("maintenance-work-order-history", args=[self.work_order.id])
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_assign_endpoint_requires_assign_permission(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.post(
            reverse("maintenance-work-order-assign", args=[self.work_order.id]),
            {"assigned_to": str(self.other_user.id)},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_assign_endpoint_creates_assignment_and_updates_status(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            reverse("maintenance-work-order-assign", args=[self.work_order.id]),
            {
                "assigned_to": str(self.other_user.id),
                "notes": "Assign to technician.",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.work_order.refresh_from_db()
        self.assertEqual(self.work_order.assignee, self.other_user)
        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.ASSIGNED)
        self.assertEqual(self.work_order.assignments.count(), 1)
        assignment = self.work_order.assignments.get()
        self.assertEqual(assignment.tenant, self.work_order.tenant)
        self.assertEqual(
            assignment.assignment_status,
            MaintenanceAssignment.AssignmentStatus.ASSIGNED,
        )

    def test_assign_endpoint_rejects_inactive_user(self):
        self.other_user.is_active = False
        self.other_user.save(update_fields=("is_active",))
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse("maintenance-work-order-assign", args=[self.work_order.id]),
            {"assigned_to": str(self.other_user.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("assigned_to", response.data)

    def test_reassign_and_unassign_create_history_and_update_status(self):
        replacement = User.objects.create_user(
            email="replacement@example.com", password="Password123!"
        )
        self.client.force_authenticate(self.user)
        assign_response = self.client.post(
            reverse("maintenance-work-order-assign", args=[self.work_order.id]),
            {"assigned_to": str(self.other_user.id), "notes": "Initial"},
            format="json",
        )
        self.assertEqual(assign_response.status_code, status.HTTP_200_OK)

        reassign_response = self.client.post(
            reverse("maintenance-work-order-reassign", args=[self.work_order.id]),
            {
                "assigned_to": str(replacement.id),
                "reason": "Technician unavailable",
                "notes": "Move to replacement",
            },
            format="json",
        )
        self.assertEqual(reassign_response.status_code, status.HTTP_200_OK)
        self.work_order.refresh_from_db()
        self.assertEqual(self.work_order.assignee, replacement)
        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.ASSIGNED)
        reassignment = self.work_order.assignments.filter(is_active=True).get()
        self.assertEqual(
            reassignment.assignment_status,
            MaintenanceAssignment.AssignmentStatus.REASSIGNED,
        )
        self.assertEqual(reassignment.previous_assigned_to, self.other_user)

        unassign_response = self.client.post(
            reverse("maintenance-work-order-unassign", args=[self.work_order.id]),
            {"reason": "Return to queue", "notes": "Await scheduling"},
            format="json",
        )
        self.assertEqual(unassign_response.status_code, status.HTTP_200_OK)
        self.work_order.refresh_from_db()
        self.assertIsNone(self.work_order.assignee)
        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.OPEN)
        self.assertEqual(self.work_order.assignments.count(), 3)

    def test_reassign_and_unassign_require_reason(self):
        self.client.force_authenticate(self.user)
        self.client.post(
            reverse("maintenance-work-order-assign", args=[self.work_order.id]),
            {"assigned_to": str(self.other_user.id)},
            format="json",
        )

        reassign_response = self.client.post(
            reverse("maintenance-work-order-reassign", args=[self.work_order.id]),
            {"assigned_to": str(self.user.id), "reason": ""},
            format="json",
        )
        unassign_response = self.client.post(
            reverse("maintenance-work-order-unassign", args=[self.work_order.id]),
            {"reason": ""},
            format="json",
        )

        self.assertEqual(reassign_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reason", reassign_response.data)
        self.assertEqual(unassign_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reason", unassign_response.data)

    def test_assign_rejects_completed_or_cancelled_work_order(self):
        self.client.force_authenticate(self.user)
        for work_order_status in (
            MaintenanceWorkOrder.Status.COMPLETED,
            MaintenanceWorkOrder.Status.CANCELLED,
        ):
            work_order = self.work_order
            work_order.status = work_order_status
            if work_order_status == MaintenanceWorkOrder.Status.CANCELLED:
                work_order.cancellation_reason = "Cancelled for test"
                work_order.completed_at = None
            else:
                work_order.completed_at = timezone.now()
                work_order.cancellation_reason = ""
            work_order.save()
            response = self.client.post(
                reverse("maintenance-work-order-assign", args=[work_order.id]),
                {"assigned_to": str(self.other_user.id)},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_assignments_endpoint_requires_assignment_view_permission(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            reverse("maintenance-work-order-assignments", args=[self.work_order.id])
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_submit_endpoint_updates_draft_to_open(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            reverse("maintenance-work-order-submit", args=[self.draft_work_order.id]),
            {"note": "Ready for workflow."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.draft_work_order.refresh_from_db()
        self.assertEqual(self.draft_work_order.status, MaintenanceWorkOrder.Status.OPEN)

    def test_start_endpoint_rejects_invalid_open_transition(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            reverse("maintenance-work-order-start", args=[self.work_order.id]),
            {"note": "Try to start too early."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)

    def test_start_endpoint_moves_assigned_to_in_progress(self):
        self.client.force_authenticate(self.user)
        self.work_order.status = MaintenanceWorkOrder.Status.ASSIGNED
        self.work_order.assignee = self.other_user
        self.work_order.save()

        response = self.client.post(
            reverse("maintenance-work-order-start", args=[self.work_order.id]),
            {"note": "Technician started work."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.work_order.refresh_from_db()
        self.assertEqual(
            self.work_order.status, MaintenanceWorkOrder.Status.IN_PROGRESS
        )

    def test_hold_endpoint_requires_reason(self):
        self.client.force_authenticate(self.user)
        self.work_order.status = MaintenanceWorkOrder.Status.IN_PROGRESS
        self.work_order.save()

        response = self.client.post(
            reverse("maintenance-work-order-hold", args=[self.work_order.id]),
            {"notes": "Need a reason."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reason", response.data)

    def test_resume_endpoint_moves_on_hold_to_in_progress(self):
        self.client.force_authenticate(self.user)
        self.work_order.status = MaintenanceWorkOrder.Status.ON_HOLD
        self.work_order.save()

        response = self.client.post(
            reverse("maintenance-work-order-resume", args=[self.work_order.id]),
            {"note": "Parts are available."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.work_order.refresh_from_db()
        self.assertEqual(
            self.work_order.status, MaintenanceWorkOrder.Status.IN_PROGRESS
        )

    def test_complete_endpoint_requires_complete_permission(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.post(
            reverse("maintenance-work-order-complete", args=[self.work_order.id]),
            {
                "completion_notes": "Complete the job.",
                "actual_hours": "1.50",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_complete_endpoint_validates_incomplete_tasks(self):
        self.client.force_authenticate(self.user)
        self.work_order.assignee = self.other_user
        self.work_order.status = MaintenanceWorkOrder.Status.IN_PROGRESS
        self.work_order.save()
        MaintenanceTask.objects.create(
            work_order=self.work_order,
            title="Incomplete task",
            sequence=1,
            status=MaintenanceTask.Status.PENDING,
        )

        response = self.client.post(
            reverse("maintenance-work-order-complete", args=[self.work_order.id]),
            {
                "completion_notes": "Work completed successfully.",
                "actual_hours": "2.50",
                "completed_at": timezone.now().isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tasks", response.data)

    def test_complete_endpoint_creates_completion_record(self):
        self.client.force_authenticate(self.user)
        self.work_order.assignee = self.other_user
        self.work_order.status = MaintenanceWorkOrder.Status.IN_PROGRESS
        self.work_order.save()
        MaintenanceTask.objects.create(
            work_order=self.work_order,
            title="Finished task",
            sequence=1,
            status=MaintenanceTask.Status.COMPLETED,
            completed_at=timezone.now(),
        )
        response = self.client.post(
            reverse("maintenance-work-order-complete", args=[self.work_order.id]),
            {
                "completion_notes": "Work completed successfully.",
                "actual_hours": "4.50",
                "completed_at": timezone.now().isoformat(),
                "resolution_summary": "Replaced worn belt.",
                "downtime_minutes": 30,
                "follow_up_required": False,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.work_order.refresh_from_db()
        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.COMPLETED)
        self.assertTrue(
            MaintenanceCompletion.objects.filter(work_order=self.work_order).exists()
        )
        completion_record = MaintenanceCompletion.objects.get(
            work_order=self.work_order
        )
        self.assertEqual(str(completion_record.actual_hours), "4.50")
        self.assertEqual(
            self.work_order.history_entries.filter(action="completed").count(),
            1,
        )

    def test_cancel_endpoint_requires_reason(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            reverse("maintenance-work-order-cancel", args=[self.work_order.id]),
            {},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reason", response.data)

    def test_reopen_endpoint_reopens_completed_work_order(self):
        self.client.force_authenticate(self.user)
        self.work_order.status = MaintenanceWorkOrder.Status.COMPLETED
        self.work_order.completed_at = timezone.now()
        self.work_order.assignee = self.other_user
        self.work_order.save()

        response = self.client.post(
            reverse("maintenance-work-order-reopen", args=[self.work_order.id]),
            {"reason": "Issue returned", "notes": "Observed recurring vibration."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.work_order.refresh_from_db()
        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.REOPENED)
        self.assertIsNone(self.work_order.assignee)
        self.assertIsNone(self.work_order.completed_at)

    def test_reopen_endpoint_reopens_cancelled_work_order(self):
        self.client.force_authenticate(self.user)
        self.work_order.status = MaintenanceWorkOrder.Status.CANCELLED
        self.work_order.cancellation_reason = "Duplicate request"
        self.work_order.save()

        response = self.client.post(
            reverse("maintenance-work-order-reopen", args=[self.work_order.id]),
            {"reason": "Original cancellation was incorrect."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.work_order.refresh_from_db()
        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.REOPENED)
        self.assertEqual(self.work_order.cancellation_reason, "")

    def test_status_history_records_action_and_reason(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            reverse("maintenance-work-order-cancel", args=[self.work_order.id]),
            {"reason": "Duplicate request", "notes": "Closing the duplicate."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        status_history = self.work_order.status_history_entries.latest("changed_at")
        self.assertEqual(
            status_history.action,
            MaintenanceStatusHistory.Action.CANCEL,
        )
        self.assertEqual(status_history.reason, "Duplicate request")
        self.assertEqual(status_history.note, "Closing the duplicate.")

    def _create_workflow_order(self, title):
        payload = self.create_work_order_payload(self.data)
        payload["title"] = title
        response = self.client.post(
            reverse("maintenance-work-order-list"), payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return MaintenanceWorkOrder.objects.get(id=response.data["id"])

    def _assign_start_complete(self, work_order):
        assign = self.client.post(
            reverse("maintenance-work-order-assign", args=[work_order.id]),
            {"assigned_to": str(self.other_user.id)},
            format="json",
        )
        self.assertEqual(assign.status_code, status.HTTP_200_OK)
        start = self.client.post(
            reverse("maintenance-work-order-start", args=[work_order.id]),
            {},
            format="json",
        )
        self.assertEqual(start.status_code, status.HTTP_200_OK)
        complete = self.client.post(
            reverse("maintenance-work-order-complete", args=[work_order.id]),
            {"completion_notes": "Validated completion.", "actual_hours": "1.50"},
            format="json",
        )
        self.assertEqual(complete.status_code, status.HTTP_200_OK)

    def test_complete_create_assign_start_complete_lifecycle(self):
        self.client.force_authenticate(self.user)
        work_order = self._create_workflow_order("Lifecycle scenario one")

        self._assign_start_complete(work_order)

        work_order.refresh_from_db()
        self.assertEqual(work_order.status, MaintenanceWorkOrder.Status.COMPLETED)
        self.assertTrue(work_order.assignments.exists())
        self.assertTrue(hasattr(work_order, "completion_record"))
        self.assertTrue(hasattr(work_order, "sla_record"))
        self.assertGreaterEqual(work_order.history_entries.count(), 4)

    def test_hold_resume_completion_lifecycle(self):
        self.client.force_authenticate(self.user)
        work_order = self._create_workflow_order("Lifecycle scenario two")
        self.client.post(
            reverse("maintenance-work-order-assign", args=[work_order.id]),
            {"assigned_to": str(self.other_user.id)},
            format="json",
        )
        self.client.post(
            reverse("maintenance-work-order-start", args=[work_order.id]),
            {},
            format="json",
        )

        hold = self.client.post(
            reverse("maintenance-work-order-hold", args=[work_order.id]),
            {"reason": "Awaiting access"},
            format="json",
        )
        resume = self.client.post(
            reverse("maintenance-work-order-resume", args=[work_order.id]),
            {},
            format="json",
        )
        complete = self.client.post(
            reverse("maintenance-work-order-complete", args=[work_order.id]),
            {"completion_notes": "Access restored.", "actual_hours": "2.00"},
            format="json",
        )

        self.assertEqual(hold.status_code, status.HTTP_200_OK)
        self.assertEqual(resume.status_code, status.HTTP_200_OK)
        self.assertEqual(complete.status_code, status.HTTP_200_OK)

    def test_cancel_reopen_reassign_completion_lifecycle(self):
        self.client.force_authenticate(self.user)
        work_order = self._create_workflow_order("Lifecycle scenario three")
        cancel = self.client.post(
            reverse("maintenance-work-order-cancel", args=[work_order.id]),
            {"reason": "Initially duplicated"},
            format="json",
        )
        reopen = self.client.post(
            reverse("maintenance-work-order-reopen", args=[work_order.id]),
            {"reason": "Cancellation reversed"},
            format="json",
        )

        self.assertEqual(cancel.status_code, status.HTTP_200_OK)
        self.assertEqual(reopen.status_code, status.HTTP_200_OK)
        self._assign_start_complete(work_order)
        work_order.refresh_from_db()
        self.assertEqual(work_order.status, MaintenanceWorkOrder.Status.COMPLETED)

    def test_sla_recalculation_uses_priority_targets_and_updates_due_dates(self):
        self.work_order.priority = MaintenanceWorkOrder.Priority.CRITICAL
        self.work_order.due_at = None
        self.work_order.save()

        sla = recalculate_work_order_sla(work_order=self.work_order)

        self.assertEqual(sla.response_target_minutes, 30)
        self.assertEqual(sla.completion_target_minutes, 240)
        self.assertEqual(
            sla.response_due_at,
            self.work_order.requested_at + timedelta(minutes=30),
        )
        self.assertEqual(
            sla.resolution_due_at,
            self.work_order.requested_at + timedelta(minutes=240),
        )

    def test_sla_endpoint_recalculates_and_requires_permission(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            reverse(
                "maintenance-work-order-recalculate-sla", args=[self.work_order.id]
            ),
            {},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("response_target_minutes", response.data)

        self.client.force_authenticate(self.viewer)
        denied = self.client.post(
            reverse(
                "maintenance-work-order-recalculate-sla", args=[self.work_order.id]
            ),
            {},
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_sla_breach_detection_and_duplicate_escalation_prevention(self):
        self.work_order.requested_at = timezone.now() - timedelta(days=3)
        self.work_order.due_at = None
        self.work_order.save()

        first = check_work_order_escalations(work_order=self.work_order)
        second = check_work_order_escalations(work_order=self.work_order)

        self.assertTrue(first)
        self.assertEqual(second, [])
        sla = self.work_order.sla_record
        sla.refresh_from_db()
        self.assertTrue(sla.response_breached)
        self.assertEqual(
            self.work_order.escalations.filter(
                escalation_type=MaintenanceEscalation.EscalationType.RESPONSE_BREACH
            ).count(),
            1,
        )

    def test_terminal_work_orders_do_not_create_escalations(self):
        for terminal_status in (
            MaintenanceWorkOrder.Status.COMPLETED,
            MaintenanceWorkOrder.Status.CANCELLED,
        ):
            self.work_order.status = terminal_status
            self.work_order.completed_at = (
                timezone.now()
                if terminal_status == MaintenanceWorkOrder.Status.COMPLETED
                else None
            )
            self.work_order.cancellation_reason = (
                "Cancelled test"
                if terminal_status == MaintenanceWorkOrder.Status.CANCELLED
                else ""
            )
            self.work_order.save()
            self.assertEqual(
                check_work_order_escalations(work_order=self.work_order), []
            )

    def test_escalation_can_be_acknowledged_and_resolved(self):
        self.work_order.requested_at = timezone.now() - timedelta(days=3)
        self.work_order.due_at = None
        self.work_order.save()
        escalation = check_work_order_escalations(work_order=self.work_order)[0]
        self.client.force_authenticate(self.user)

        acknowledge = self.client.post(
            reverse(
                "maintenance-work-order-acknowledge-escalation",
                args=[self.work_order.id, escalation.id],
            ),
            {"notes": "Owner notified."},
            format="json",
        )
        self.assertEqual(acknowledge.status_code, status.HTTP_200_OK)
        self.assertEqual(
            acknowledge.data["status"], MaintenanceEscalation.Status.ACKNOWLEDGED
        )

        resolve = self.client.post(
            reverse(
                "maintenance-work-order-resolve-escalation",
                args=[self.work_order.id, escalation.id],
            ),
            {"notes": "Recovery plan completed."},
            format="json",
        )
        self.assertEqual(resolve.status_code, status.HTTP_200_OK)
        self.assertEqual(resolve.data["status"], MaintenanceEscalation.Status.RESOLVED)

    def test_escalation_access_requires_permission_and_parent_ownership(self):
        overdue_sla = recalculate_work_order_sla(work_order=self.overdue_work_order)
        escalation = MaintenanceEscalation.objects.create(
            tenant=self.overdue_work_order.tenant,
            work_order=self.overdue_work_order,
            sla=overdue_sla,
            reason="Existing escalation",
            level=MaintenanceEscalation.Level.LEVEL_1,
        )
        self.client.force_authenticate(self.viewer)
        denied = self.client.get(
            reverse("maintenance-work-order-escalations", args=[self.work_order.id])
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.user)
        mismatch = self.client.post(
            reverse(
                "maintenance-work-order-acknowledge-escalation",
                args=[self.work_order.id, escalation.id],
            ),
            {},
            format="json",
        )
        self.assertEqual(mismatch.status_code, status.HTTP_404_NOT_FOUND)

    def test_sla_check_task_runs_safely(self):
        result = check_maintenance_sla_breaches()
        self.assertIn("checked", result)
        self.assertIn("escalations_created", result)


class MaintenanceSeedCommandTests(MaintenanceTestDataMixin, APITestCase):
    def setUp(self):
        User.objects.create_user(
            email="seed-user@example.com",
            password="Password123!",
        )
        User.objects.create_user(
            email="seed-tech@example.com",
            password="Password123!",
        )
        call_command("seed_master_data")

    def test_seed_command_is_idempotent(self):
        call_command("seed_maintenance")
        call_command("seed_maintenance")

        self.assertEqual(MaintenanceWorkOrder.objects.count(), 2)
        self.assertGreaterEqual(MaintenanceAssignment.objects.count(), 2)
        self.assertGreaterEqual(MaintenanceTask.objects.count(), 2)
        self.assertGreaterEqual(MaintenanceMaterial.objects.count(), 2)
        self.assertGreaterEqual(MaintenanceLabor.objects.count(), 2)
        self.assertGreaterEqual(MaintenanceHistory.objects.count(), 4)
        self.assertEqual(MaintenanceSLA.objects.count(), 2)


class MaintenanceSeedRbacCommandTests(APITestCase):
    def test_seed_rbac_remains_idempotent(self):
        call_command("seed_rbac")
        call_command("seed_rbac")

        self.assertEqual(
            Permission.objects.filter(code="maintenance.manage").count(), 1
        )
        self.assertEqual(Role.objects.filter(code="system_admin").count(), 1)
