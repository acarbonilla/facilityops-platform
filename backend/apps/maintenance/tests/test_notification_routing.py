"""FO-078D: Employee-safe maintenance notification routing tests."""

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.access_control.models import Role, UserRole
from apps.fm_tickets.models import FmTicket
from apps.maintenance.models import MaintenanceWorkOrder
from apps.maintenance.notification_service import (
    ASSIGNMENT_EVENT_CODE,
    REQUESTER_STATUS_EVENT_CODE,
    STATUS_CHANGED_EVENT_CODE,
    notify_maintenance_assigned,
    notify_maintenance_reassigned,
    notify_maintenance_status_changed,
)
from apps.master_data.models import (
    Area,
    Asset,
    AssetType,
    Building,
    Floor,
    Organization,
    Tenant,
)
from apps.notifications.models import Notification

User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
)
class MaintenanceNotificationRoutingTests(TestCase):
    """Prove that Employee-only requesters do not receive internal Maintenance
    notifications and instead get requester-safe notifications via /my-requests."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant_a = Tenant.objects.create(
            name="NR Tenant A", code="nr-tenant-a"
        )
        cls.tenant_b = Tenant.objects.create(
            name="NR Tenant B", code="nr-tenant-b"
        )
        cls.org_a = Organization.objects.create(
            tenant=cls.tenant_a, name="NR Org A", code="nr-org-a"
        )
        cls.org_b = Organization.objects.create(
            tenant=cls.tenant_b, name="NR Org B", code="nr-org-b"
        )
        cls.building_a = Building.objects.create(
            tenant=cls.tenant_a, organization=cls.org_a,
            name="NR Bldg A", code="nr-bldg-a",
        )
        cls.floor_a = Floor.objects.create(
            tenant=cls.tenant_a, building=cls.building_a,
            name="NR Floor A", code="nr-floor-a",
        )
        cls.area_a = Area.objects.create(
            tenant=cls.tenant_a, building=cls.building_a, floor=cls.floor_a,
            name="NR Area A", code="nr-area-a",
        )
        cls.asset_type_a = AssetType.objects.create(
            tenant=cls.tenant_a, name="NR Type A", code="nr-type-a"
        )
        cls.asset_a = Asset.objects.create(
            tenant=cls.tenant_a, organization=cls.org_a,
            building=cls.building_a, floor=cls.floor_a, area=cls.area_a,
            asset_type=cls.asset_type_a, name="NR Asset A", code="nr-asset-a",
        )

        def make_user(email, tenant, org, role_code):
            u = User.objects.create_user(
                email=email, password="Password123!",
                tenant=tenant, organization=org,
            )
            UserRole.objects.create(user=u, role=Role.objects.get(code=role_code))
            return u

        cls.employee = make_user(
            "nr-employee@example.com", cls.tenant_a, cls.org_a, "employee"
        )
        cls.technician = make_user(
            "nr-tech@example.com", cls.tenant_a, cls.org_a, "technician"
        )
        cls.fm_manager = make_user(
            "nr-fm@example.com", cls.tenant_a, cls.org_a, "facility_manager"
        )

        # Dual-role user: employee + facility_manager
        cls.dual_role = User.objects.create_user(
            email="nr-dual@example.com", password="Password123!",
            tenant=cls.tenant_a, organization=cls.org_a,
        )
        UserRole.objects.create(
            user=cls.dual_role, role=Role.objects.get(code="employee")
        )
        UserRole.objects.create(
            user=cls.dual_role, role=Role.objects.get(code="facility_manager")
        )

        cls.other_tenant_employee = make_user(
            "nr-other@example.com", cls.tenant_b, cls.org_b, "employee"
        )

        cls.ticket = FmTicket.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            floor=cls.floor_a,
            area=cls.area_a,
            asset=cls.asset_a,
            requester=cls.employee,
            title="NR Test Ticket",
            description="Notification routing test",
            category=FmTicket.Category.OTHER,
            priority=FmTicket.Priority.MEDIUM,
            status=FmTicket.Status.IN_PROGRESS,
            source=FmTicket.Source.WEB,
        )

        cls.work_order = MaintenanceWorkOrder.objects.create(
            tenant=cls.tenant_a,
            organization=cls.org_a,
            building=cls.building_a,
            asset=cls.asset_a,
            requester=cls.employee,
            assignee=cls.technician,
            source_ticket=cls.ticket,
            title="NR Test WO",
            description="WO for notification routing test",
            priority=MaintenanceWorkOrder.Priority.MEDIUM,
            status=MaintenanceWorkOrder.Status.IN_PROGRESS,
        )

    def _clear_notifications(self):
        Notification.objects.filter(
            source_object_id=self.work_order.id
        ).delete()

    # ------------------------------------------------------------------
    # Status change: Employee-only requester excluded from internal notif
    # ------------------------------------------------------------------

    def test_employee_does_not_receive_internal_status_notification(self):
        self._clear_notifications()
        notifications = notify_maintenance_status_changed(
            work_order=self.work_order,
            from_status=MaintenanceWorkOrder.Status.IN_PROGRESS,
            to_status=MaintenanceWorkOrder.Status.COMPLETED,
            actor=self.fm_manager,
        )
        internal = [
            n for n in notifications if n.event_code == STATUS_CHANGED_EVENT_CODE
        ]
        for n in internal:
            self.assertNotEqual(n.recipient_id, self.employee.id)
            self.assertIn("/maintenance/work-orders/", n.target_url)

    def test_employee_receives_requester_safe_notification(self):
        self._clear_notifications()
        notifications = notify_maintenance_status_changed(
            work_order=self.work_order,
            from_status=MaintenanceWorkOrder.Status.IN_PROGRESS,
            to_status=MaintenanceWorkOrder.Status.COMPLETED,
            actor=self.fm_manager,
        )
        requester_notes = [
            n for n in notifications
            if n.event_code == REQUESTER_STATUS_EVENT_CODE
        ]
        self.assertEqual(len(requester_notes), 1)
        note = requester_notes[0]
        self.assertEqual(note.recipient_id, self.employee.id)
        self.assertEqual(note.target_url, f"/my-requests/{self.ticket.id}")
        self.assertNotIn("/maintenance/", note.target_url)
        self.assertEqual(note.title, "Your request has been updated")
        self.assertIn(self.ticket.ticket_number, note.message)

    def test_employee_notification_never_links_to_maintenance(self):
        self._clear_notifications()
        notifications = notify_maintenance_status_changed(
            work_order=self.work_order,
            from_status=MaintenanceWorkOrder.Status.IN_PROGRESS,
            to_status=MaintenanceWorkOrder.Status.COMPLETED,
            actor=self.fm_manager,
        )
        for n in notifications:
            if n.recipient_id == self.employee.id:
                self.assertNotIn("/maintenance/work-orders/", n.target_url)
                self.assertIn("/my-requests/", n.target_url)

    # ------------------------------------------------------------------
    # Assignment: Employee-only requester excluded
    # ------------------------------------------------------------------

    def test_employee_does_not_receive_assignment_notification(self):
        self._clear_notifications()
        notifications = notify_maintenance_assigned(
            work_order=self.work_order,
            technician=self.technician,
            supervisor=self.fm_manager,
            actor=self.fm_manager,
        )
        recipient_ids = {n.recipient_id for n in notifications}
        self.assertNotIn(self.employee.id, recipient_ids)

    def test_employee_does_not_receive_reassignment_notification(self):
        self._clear_notifications()

        from apps.maintenance.models import MaintenanceAssignment

        prev = MaintenanceAssignment.objects.create(
            work_order=self.work_order,
            assigned_to=self.technician,
            supervisor=self.fm_manager,
            is_active=False,
        )
        notifications = notify_maintenance_reassigned(
            work_order=self.work_order,
            technician=self.technician,
            supervisor=self.fm_manager,
            previous_assignment=prev,
            actor=self.fm_manager,
        )
        recipient_ids = {n.recipient_id for n in notifications}
        self.assertNotIn(self.employee.id, recipient_ids)

    # ------------------------------------------------------------------
    # Operational users still receive internal notifications
    # ------------------------------------------------------------------

    def test_operational_users_receive_internal_status_notification(self):
        self._clear_notifications()
        notifications = notify_maintenance_status_changed(
            work_order=self.work_order,
            from_status=MaintenanceWorkOrder.Status.IN_PROGRESS,
            to_status=MaintenanceWorkOrder.Status.COMPLETED,
            actor=self.fm_manager,
        )
        internal = [
            n for n in notifications if n.event_code == STATUS_CHANGED_EVENT_CODE
        ]
        internal_recipient_ids = {n.recipient_id for n in internal}
        self.assertIn(self.technician.id, internal_recipient_ids)

    def test_technician_receives_assignment_notification(self):
        self._clear_notifications()
        notifications = notify_maintenance_assigned(
            work_order=self.work_order,
            technician=self.technician,
            actor=self.fm_manager,
        )
        self.assertTrue(len(notifications) >= 1)
        self.assertEqual(notifications[0].recipient_id, self.technician.id)
        self.assertIn("/maintenance/work-orders/", notifications[0].target_url)

    # ------------------------------------------------------------------
    # Dual-role user: receives operational notification, not employee one
    # ------------------------------------------------------------------

    def test_dual_role_user_receives_operational_notification(self):
        self._clear_notifications()
        self.work_order.requester = self.dual_role
        self.work_order.save(update_fields=["requester"])

        try:
            notifications = notify_maintenance_status_changed(
                work_order=self.work_order,
                from_status=MaintenanceWorkOrder.Status.IN_PROGRESS,
                to_status=MaintenanceWorkOrder.Status.COMPLETED,
                actor=self.fm_manager,
            )
            dual_notes = [
                n for n in notifications if n.recipient_id == self.dual_role.id
            ]
            self.assertTrue(len(dual_notes) >= 1)
            self.assertEqual(
                dual_notes[0].event_code, STATUS_CHANGED_EVENT_CODE
            )
            self.assertIn("/maintenance/work-orders/", dual_notes[0].target_url)
        finally:
            self.work_order.requester = self.employee
            self.work_order.save(update_fields=["requester"])

    def test_dual_role_does_not_get_duplicate_notification(self):
        self._clear_notifications()
        self.work_order.requester = self.dual_role
        self.work_order.save(update_fields=["requester"])

        try:
            notifications = notify_maintenance_status_changed(
                work_order=self.work_order,
                from_status=MaintenanceWorkOrder.Status.IN_PROGRESS,
                to_status=MaintenanceWorkOrder.Status.COMPLETED,
                actor=self.fm_manager,
            )
            dual_notes = [
                n for n in notifications if n.recipient_id == self.dual_role.id
            ]
            self.assertEqual(len(dual_notes), 1)
        finally:
            self.work_order.requester = self.employee
            self.work_order.save(update_fields=["requester"])

    # ------------------------------------------------------------------
    # Cross-tenant isolation
    # ------------------------------------------------------------------

    def test_cross_tenant_requester_never_notified(self):
        self._clear_notifications()
        self.work_order.requester = self.other_tenant_employee
        self.work_order.save(update_fields=["requester"])

        try:
            notifications = notify_maintenance_status_changed(
                work_order=self.work_order,
                from_status=MaintenanceWorkOrder.Status.IN_PROGRESS,
                to_status=MaintenanceWorkOrder.Status.COMPLETED,
                actor=self.fm_manager,
            )
            recipient_ids = {n.recipient_id for n in notifications}
            self.assertNotIn(self.other_tenant_employee.id, recipient_ids)
        finally:
            self.work_order.requester = self.employee
            self.work_order.save(update_fields=["requester"])

    # ------------------------------------------------------------------
    # No requester notification without linked FM Ticket
    # ------------------------------------------------------------------

    def test_no_requester_notification_without_source_ticket(self):
        self._clear_notifications()
        self.work_order.source_ticket = None
        self.work_order.save(update_fields=["source_ticket"])

        try:
            notifications = notify_maintenance_status_changed(
                work_order=self.work_order,
                from_status=MaintenanceWorkOrder.Status.IN_PROGRESS,
                to_status=MaintenanceWorkOrder.Status.COMPLETED,
                actor=self.fm_manager,
            )
            requester_notes = [
                n for n in notifications
                if n.event_code == REQUESTER_STATUS_EVENT_CODE
            ]
            self.assertEqual(len(requester_notes), 0)
        finally:
            self.work_order.source_ticket = self.ticket
            self.work_order.save(update_fields=["source_ticket"])

    # ------------------------------------------------------------------
    # Same status = no notification
    # ------------------------------------------------------------------

    def test_same_status_no_notifications(self):
        notifications = notify_maintenance_status_changed(
            work_order=self.work_order,
            from_status=MaintenanceWorkOrder.Status.IN_PROGRESS,
            to_status=MaintenanceWorkOrder.Status.IN_PROGRESS,
            actor=self.fm_manager,
        )
        self.assertEqual(notifications, [])
