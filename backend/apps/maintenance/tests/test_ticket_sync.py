from unittest.mock import patch

from apps.access_control.models import Role, UserRole
from apps.fm_tickets.models import FmTicket, FmTicketHistory, FmTicketStatusHistory
from apps.fm_tickets.notification_service import (
    STATUS_CHANGED_EVENT_CODE as FM_STATUS_CHANGED_EVENT_CODE,
)
from apps.fm_tickets.work_order_service import generate_work_order_from_ticket
from apps.maintenance.models import (
    MaintenanceAssignment,
    MaintenanceCompletion,
    MaintenanceWorkOrder,
)
from apps.maintenance.notification_service import (
    STATUS_CHANGED_EVENT_CODE as MAINTENANCE_STATUS_CHANGED_EVENT_CODE,
)
from apps.maintenance.tests.test_maintenance import MaintenanceTestDataMixin
from apps.maintenance.work_order_workflow_service import (
    cancel_work_order,
    complete_work_order,
    hold_work_order,
    reopen_work_order,
    resume_work_order,
    start_work_order,
)
from apps.master_data.models import Tenant
from apps.notifications.models import Notification
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from rest_framework.test import APITestCase

User = get_user_model()


class SourceTicketStatusSyncTests(MaintenanceTestDataMixin, APITestCase):
    def setUp(self):
        self.data = self.create_master_data()
        self.tenant = self.data["tenant"]
        self.coordinator = User.objects.create_user(
            email="sync-coordinator@example.com",
            password="Password123!",
            tenant=self.tenant,
        )
        self.technician = User.objects.create_user(
            email="sync-technician@example.com",
            password="Password123!",
            tenant=self.tenant,
        )
        self.requester = User.objects.create_user(
            email="sync-requester@example.com",
            password="Password123!",
            tenant=self.tenant,
        )
        self.create_maintenance_permissions()
        self.assign_permissions(
            self.coordinator,
            "maintenance.view",
            "maintenance.create",
            "maintenance.assign",
            "maintenance.start",
            "maintenance.hold",
            "maintenance.resume",
            "maintenance.complete",
            "maintenance.cancel",
            "maintenance.reopen",
            "maintenance.manage",
        )
        technician_role = Role.objects.create(name="Technician", code="technician")
        UserRole.objects.create(user=self.technician, role=technician_role)

        self.ticket = FmTicket.objects.create(
            tenant=self.tenant,
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            asset=self.data["asset"],
            requester=self.requester,
            assignee=self.technician,
            title="Pump vibration",
            description="Requires linked maintenance execution.",
            category=FmTicket.Category.HVAC,
            priority=FmTicket.Priority.HIGH,
            status=FmTicket.Status.ASSIGNED,
            source=FmTicket.Source.ADMIN,
        )
        self.work_order = generate_work_order_from_ticket(
            ticket=self.ticket,
            generated_by=self.coordinator,
        )
        self.ticket.refresh_from_db()

    def _standalone_work_order(self):
        return MaintenanceWorkOrder.objects.create(
            tenant=self.tenant,
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            asset=self.data["asset"],
            requester=self.requester,
            assignee=self.technician,
            title="Standalone WO",
            description="No source ticket.",
            priority=MaintenanceWorkOrder.Priority.MEDIUM,
            status=MaintenanceWorkOrder.Status.ASSIGNED,
            created_by=str(self.coordinator.id),
            updated_by=str(self.coordinator.id),
        )

    def test_start_sets_ticket_in_progress(self):
        start_work_order(work_order=self.work_order, actor=self.technician)
        self.ticket.refresh_from_db()
        self.work_order.refresh_from_db()

        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.IN_PROGRESS)
        self.assertEqual(self.ticket.status, FmTicket.Status.IN_PROGRESS)
        self.assertEqual(
            FmTicketStatusHistory.objects.filter(
                ticket=self.ticket,
                to_status=FmTicket.Status.IN_PROGRESS,
            ).count(),
            1,
        )
        self.assertEqual(
            FmTicketHistory.objects.filter(
                ticket=self.ticket,
                action="work_order_status_synchronized",
            ).count(),
            1,
        )
        self.assertTrue(
            Notification.objects.filter(
                event_code=MAINTENANCE_STATUS_CHANGED_EVENT_CODE
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(event_code=FM_STATUS_CHANGED_EVENT_CODE).exists()
        )

    def test_standalone_start_does_not_affect_tickets(self):
        standalone = self._standalone_work_order()
        before_count = FmTicketStatusHistory.objects.count()
        before_notifications = Notification.objects.filter(
            event_code=FM_STATUS_CHANGED_EVENT_CODE
        ).count()

        start_work_order(work_order=standalone, actor=self.technician)
        self.ticket.refresh_from_db()

        self.assertEqual(self.ticket.status, FmTicket.Status.ASSIGNED)
        self.assertEqual(FmTicketStatusHistory.objects.count(), before_count)
        self.assertEqual(
            Notification.objects.filter(event_code=FM_STATUS_CHANGED_EVENT_CODE).count(),
            before_notifications,
        )

    def test_start_noop_when_ticket_already_in_progress(self):
        self.ticket.status = FmTicket.Status.IN_PROGRESS
        self.ticket.save(update_fields=["status", "updated_at"])
        before_status_history = FmTicketStatusHistory.objects.filter(
            ticket=self.ticket
        ).count()
        before_sync_history = FmTicketHistory.objects.filter(
            ticket=self.ticket,
            action="work_order_status_synchronized",
        ).count()
        before_fm_notifications = Notification.objects.filter(
            event_code=FM_STATUS_CHANGED_EVENT_CODE
        ).count()

        start_work_order(work_order=self.work_order, actor=self.technician)
        self.ticket.refresh_from_db()

        self.assertEqual(self.ticket.status, FmTicket.Status.IN_PROGRESS)
        self.assertEqual(
            FmTicketStatusHistory.objects.filter(ticket=self.ticket).count(),
            before_status_history,
        )
        self.assertEqual(
            FmTicketHistory.objects.filter(
                ticket=self.ticket,
                action="work_order_status_synchronized",
            ).count(),
            before_sync_history,
        )
        self.assertEqual(
            Notification.objects.filter(event_code=FM_STATUS_CHANGED_EVENT_CODE).count(),
            before_fm_notifications,
        )

    def test_hold_and_resume_synchronize_ticket(self):
        start_work_order(work_order=self.work_order, actor=self.technician)
        hold_work_order(
            work_order=self.work_order,
            actor=self.technician,
            reason="Awaiting parts",
        )
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, FmTicket.Status.ON_HOLD)

        resume_work_order(work_order=self.work_order, actor=self.technician)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, FmTicket.Status.IN_PROGRESS)

    def test_complete_sets_ticket_resolved_not_closed(self):
        start_work_order(work_order=self.work_order, actor=self.technician)
        complete_work_order(
            work_order=self.work_order,
            completed_by=self.technician,
            completion_notes="Repaired successfully.",
            actual_hours="1.50",
        )
        self.ticket.refresh_from_db()
        self.work_order.refresh_from_db()

        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.COMPLETED)
        self.assertEqual(self.ticket.status, FmTicket.Status.RESOLVED)
        self.assertIsNotNone(self.ticket.resolved_at)
        self.assertIsNone(self.ticket.closed_at)
        self.assertTrue(
            MaintenanceCompletion.objects.filter(work_order=self.work_order).exists()
        )

    def test_reopen_sets_resolved_ticket_in_progress_and_clears_resolution(self):
        start_work_order(work_order=self.work_order, actor=self.technician)
        complete_work_order(
            work_order=self.work_order,
            completed_by=self.technician,
            completion_notes="Completed once.",
            actual_hours="2.00",
        )
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, FmTicket.Status.RESOLVED)
        self.assertIsNotNone(self.ticket.resolved_at)

        reopen_work_order(
            work_order=self.work_order,
            actor=self.coordinator,
            reason="Issue returned",
        )
        self.ticket.refresh_from_db()
        self.work_order.refresh_from_db()

        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.REOPENED)
        self.assertEqual(self.ticket.status, FmTicket.Status.IN_PROGRESS)
        self.assertIsNone(self.ticket.resolved_at)
        self.assertIsNone(self.ticket.closed_at)

    def test_reopen_against_closed_ticket_rolls_back(self):
        start_work_order(work_order=self.work_order, actor=self.technician)
        complete_work_order(
            work_order=self.work_order,
            completed_by=self.technician,
            completion_notes="Completed once.",
            actual_hours="2.00",
        )
        self.ticket.status = FmTicket.Status.CLOSED
        self.ticket.resolved_at = timezone.now()
        self.ticket.closed_at = timezone.now()
        self.ticket.save(
            update_fields=["status", "resolved_at", "closed_at", "updated_at"]
        )

        with self.assertRaises(ValidationError):
            reopen_work_order(
                work_order=self.work_order,
                actor=self.coordinator,
                reason="Should fail against closed ticket",
            )

        self.work_order.refresh_from_db()
        self.ticket.refresh_from_db()
        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.COMPLETED)
        self.assertEqual(self.ticket.status, FmTicket.Status.CLOSED)
        self.assertTrue(
            MaintenanceAssignment.objects.filter(
                work_order=self.work_order,
                is_active=True,
            ).exists()
        )

    def test_cancel_records_history_without_cancelling_ticket(self):
        previous_status = self.ticket.status
        cancel_work_order(
            work_order=self.work_order,
            actor=self.coordinator,
            reason="Duplicated request",
        )
        self.ticket.refresh_from_db()
        self.work_order.refresh_from_db()

        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.CANCELLED)
        self.assertEqual(self.ticket.status, previous_status)
        self.assertEqual(
            FmTicketHistory.objects.filter(
                ticket=self.ticket,
                action="linked_work_order_cancelled",
            ).count(),
            1,
        )

    def test_cross_tenant_mismatch_rolls_back(self):
        other_tenant = Tenant.objects.create(name="Other Sync", code="other-sync")
        # Force a mismatched relationship for isolation coverage.
        FmTicket.objects.filter(id=self.ticket.id).update(tenant=other_tenant)
        self.work_order.refresh_from_db()

        with self.assertRaises(ValidationError):
            start_work_order(work_order=self.work_order, actor=self.technician)

        self.work_order.refresh_from_db()
        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.ASSIGNED)

    def test_soft_deleted_source_ticket_rolls_back(self):
        self.ticket.is_deleted = True
        self.ticket.save(update_fields=["is_deleted", "updated_at"])

        with self.assertRaises(ValidationError):
            start_work_order(work_order=self.work_order, actor=self.technician)

        self.work_order.refresh_from_db()
        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.ASSIGNED)

    def test_ticket_sync_failure_rolls_back_work_order(self):
        with patch(
            "apps.maintenance.ticket_sync_service.change_ticket_status",
            side_effect=RuntimeError("sync boom"),
        ):
            with self.assertRaises(RuntimeError):
                start_work_order(work_order=self.work_order, actor=self.technician)

        self.work_order.refresh_from_db()
        self.ticket.refresh_from_db()
        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.ASSIGNED)
        self.assertEqual(self.ticket.status, FmTicket.Status.ASSIGNED)

    def test_ticket_notification_failure_rolls_back_work_order(self):
        with patch(
            "apps.fm_tickets.services.notify_fm_ticket_status_changed",
            side_effect=RuntimeError("ticket notify boom"),
        ):
            with self.assertRaises(RuntimeError):
                start_work_order(work_order=self.work_order, actor=self.technician)

        self.work_order.refresh_from_db()
        self.ticket.refresh_from_db()
        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.ASSIGNED)
        self.assertEqual(self.ticket.status, FmTicket.Status.ASSIGNED)
        self.assertEqual(
            FmTicketStatusHistory.objects.filter(ticket=self.ticket).count(),
            0,
        )

    def test_complete_sync_failure_rolls_back_completion(self):
        start_work_order(work_order=self.work_order, actor=self.technician)
        with patch(
            "apps.maintenance.ticket_sync_service.change_ticket_status",
            side_effect=RuntimeError("complete sync boom"),
        ):
            with self.assertRaises(RuntimeError):
                complete_work_order(
                    work_order=self.work_order,
                    completed_by=self.technician,
                    completion_notes="Should roll back.",
                    actual_hours="1.00",
                )

        self.work_order.refresh_from_db()
        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.IN_PROGRESS)
        self.assertFalse(
            MaintenanceCompletion.objects.filter(work_order=self.work_order).exists()
        )
        self.assertIsNone(self.work_order.completed_at)

    def test_generation_does_not_set_ticket_in_progress(self):
        self.assertEqual(self.ticket.status, FmTicket.Status.ASSIGNED)
        self.assertEqual(self.work_order.status, MaintenanceWorkOrder.Status.ASSIGNED)
        self.assertEqual(
            MaintenanceAssignment.objects.filter(
                work_order=self.work_order,
                is_active=True,
            ).count(),
            1,
        )

    def test_sync_history_metadata_is_safe(self):
        start_work_order(work_order=self.work_order, actor=self.technician)
        entry = FmTicketHistory.objects.get(
            ticket=self.ticket,
            action="work_order_status_synchronized",
        )
        self.assertEqual(entry.metadata["event"], "work_order_status_synchronized")
        self.assertEqual(entry.metadata["work_order_id"], str(self.work_order.id))
        self.assertEqual(
            entry.metadata["work_order_number"],
            self.work_order.work_order_number,
        )
        self.assertEqual(entry.metadata["to_work_order_status"], "in_progress")
        self.assertEqual(entry.metadata["target_ticket_status"], "in_progress")
        self.assertEqual(entry.metadata["maintenance_action"], "start")
        self.assertNotIn("description", entry.metadata)
