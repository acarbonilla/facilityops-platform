from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Permission, Role, RolePermission, UserRole
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
from apps.maintenance.models import (
    MaintenanceAttachment,
    MaintenanceAssignment,
    MaintenanceCompletion,
    MaintenanceHistory,
    MaintenanceLabor,
    MaintenanceMaterial,
    MaintenanceSLA,
    MaintenanceStatusHistory,
    MaintenanceTask,
    MaintenanceWorkOrder,
)


User = get_user_model()


class MaintenanceTestDataMixin:
    def create_maintenance_permissions(self):
        permission_definitions = [
            ("maintenance.view", "maintenance", "view", "View maintenance work orders"),
            ("maintenance.create", "maintenance", "create", "Create maintenance work orders"),
            ("maintenance.update", "maintenance", "update", "Update maintenance work orders"),
            ("maintenance.assign", "maintenance", "assign", "Assign maintenance work orders"),
            ("maintenance.complete", "maintenance", "complete", "Complete maintenance work orders"),
            ("maintenance.manage", "maintenance", "manage", "Manage maintenance work orders"),
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
            "maintenance.assign",
            "maintenance.complete",
            "maintenance.manage",
        )
        self.assign_permissions(self.viewer, "maintenance.view")
        self.data = self.create_master_data()
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
        self.assertEqual(response.data["count"], 2)

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
        self.assertEqual(response.data["results"][0]["id"], str(self.overdue_work_order.id))
        self.assertEqual(response.data["results"][0]["attachments_count"], 1)

    def test_dashboard_endpoint_returns_summary_metrics(self):
        self.client.force_authenticate(self.user)
        response = self.client.get(reverse("maintenance-work-order-dashboard"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_work_orders"], 2)
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
        self.assertTrue(MaintenanceSLA.objects.filter(work_order=created_work_order).exists())

    def test_work_order_detail_includes_sla(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            reverse("maintenance-work-order-detail", args=[self.work_order.id])
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["sla"]["sla_status"], MaintenanceSLA.Status.NOT_STARTED)

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
                "note": "Assign to technician.",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.work_order.refresh_from_db()
        self.assertEqual(self.work_order.assignee, self.other_user)
        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.ASSIGNED)
        self.assertEqual(self.work_order.assignments.count(), 1)

    def test_status_endpoint_updates_workflow(self):
        self.client.force_authenticate(self.user)
        self.work_order.assignee = self.other_user
        self.work_order.save()
        response = self.client.post(
            reverse("maintenance-work-order-change-status", args=[self.work_order.id]),
            {
                "status": MaintenanceWorkOrder.Status.IN_PROGRESS,
                "note": "Technician started work.",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.work_order.refresh_from_db()
        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.IN_PROGRESS)
        self.assertEqual(self.work_order.status_history_entries.count(), 1)

    def test_complete_endpoint_requires_complete_permission(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.post(
            reverse("maintenance-work-order-complete", args=[self.work_order.id]),
            {"completion_notes": "Complete the job."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_complete_endpoint_creates_completion_record(self):
        self.client.force_authenticate(self.user)
        self.work_order.assignee = self.other_user
        self.work_order.status = MaintenanceWorkOrder.Status.IN_PROGRESS
        self.work_order.save()
        response = self.client.post(
            reverse("maintenance-work-order-complete", args=[self.work_order.id]),
            {
                "completion_notes": "Work completed successfully.",
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
        self.assertEqual(
            self.work_order.history_entries.filter(action="completed").count(),
            1,
        )

    def test_cancel_status_requires_reason(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(
            reverse("maintenance-work-order-change-status", args=[self.work_order.id]),
            {"status": MaintenanceWorkOrder.Status.CANCELLED},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cancellation_reason", response.data)


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

        self.assertEqual(Permission.objects.filter(code="maintenance.manage").count(), 1)
        self.assertEqual(Role.objects.filter(code="system_admin").count(), 1)
