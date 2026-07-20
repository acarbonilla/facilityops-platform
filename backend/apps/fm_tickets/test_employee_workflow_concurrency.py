"""FO-077A concurrent requester workflow locking tests.

Uses TransactionTestCase only for genuine multi-connection races that require
select_for_update blocking across threads.
"""

from queue import Queue
from threading import Barrier, Event, Thread
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.db import close_old_connections, transaction
from django.test import TransactionTestCase, override_settings

from apps.access_control.models import Role, UserRole
from apps.maintenance.models import MaintenanceWorkOrder
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

from .models import FmTicket, FmTicketStatusHistory
from .requester_workflow import (
    requester_acknowledge_ticket,
    requester_cancel_ticket,
    requester_reopen_ticket,
)


User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",)
)
class EmployeeRequesterWorkflowConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        call_command("seed_rbac")
        self.data = self._create_master_data("race")
        self.employee = self._create_user(
            "workflow-race-employee@example.com",
            self.data,
            "employee",
        )
        self.facility_manager = self._create_user(
            "workflow-race-fm@example.com",
            self.data,
            "facility_manager",
        )

    def _create_master_data(self, suffix):
        tenant = Tenant.objects.create(
            name=f"Race Tenant {suffix.upper()}",
            code=f"race-tenant-{suffix}",
        )
        organization = Organization.objects.create(
            tenant=tenant,
            name=f"Race Org {suffix.upper()}",
            code=f"race-organization-{suffix}",
        )
        building = Building.objects.create(
            tenant=tenant,
            organization=organization,
            name=f"Race Building {suffix.upper()}",
            code=f"race-building-{suffix}",
        )
        floor = Floor.objects.create(
            tenant=tenant,
            building=building,
            name=f"Floor {suffix.upper()}",
            code=f"race-floor-{suffix}",
        )
        area = Area.objects.create(
            tenant=tenant,
            building=building,
            floor=floor,
            name=f"Area {suffix.upper()}",
            code=f"race-area-{suffix}",
        )
        asset_type = AssetType.objects.create(
            tenant=tenant,
            name=f"Type {suffix.upper()}",
            code=f"race-asset-type-{suffix}",
        )
        asset = Asset.objects.create(
            tenant=tenant,
            organization=organization,
            building=building,
            floor=floor,
            area=area,
            asset_type=asset_type,
            name=f"Asset {suffix.upper()}",
            code=f"race-asset-{suffix}",
        )
        return {
            "tenant": tenant,
            "organization": organization,
            "building": building,
            "floor": floor,
            "area": area,
            "asset": asset,
        }

    def _create_user(self, email, data, role_code):
        user = User.objects.create_user(
            email=email,
            password="Password123!",
            tenant=data["tenant"],
            organization=data["organization"],
        )
        UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
        return user

    def _create_ticket(self, title, status=FmTicket.Status.OPEN):
        ticket = FmTicket.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            asset=self.data["asset"],
            requester=self.employee,
            title=title,
            description=f"{title} description",
            category=FmTicket.Category.OTHER,
            priority=FmTicket.Priority.MEDIUM,
            status=status,
            source=FmTicket.Source.WEB,
        )
        ticket.assignee = self.facility_manager
        ticket.save(update_fields=["assignee"])
        return ticket

    def _run_concurrent(self, workers):
        barrier = Barrier(len(workers))
        outcomes = Queue()

        def run(worker):
            close_old_connections()
            try:
                barrier.wait(timeout=5)
                worker()
                outcomes.put(None)
            except Exception as exc:
                outcomes.put(exc)
            finally:
                close_old_connections()

        threads = [Thread(target=run, args=(worker,)) for worker in workers]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=15)
            self.assertFalse(thread.is_alive())

        return [outcomes.get_nowait() for _ in workers]

    def test_two_concurrent_acknowledgements_only_one_commits(self):
        ticket = self._create_ticket(
            "Concurrent ack",
            status=FmTicket.Status.RESOLVED,
        )
        ticket_id = ticket.pk
        actor_id = self.employee.pk

        def acknowledge():
            requester_acknowledge_ticket(
                ticket=FmTicket.objects.get(pk=ticket_id),
                actor=User.objects.get(pk=actor_id),
            )

        results = self._run_concurrent([acknowledge, acknowledge])
        successes = [result for result in results if result is None]
        failures = [result for result in results if result is not None]
        self.assertEqual(len(successes), 1)
        self.assertEqual(len(failures), 1)
        self.assertIsInstance(failures[0], ValidationError)

        ticket.refresh_from_db()
        self.assertEqual(ticket.status, FmTicket.Status.CLOSED)
        self.assertEqual(
            FmTicketStatusHistory.objects.filter(
                ticket_id=ticket_id,
                to_status=FmTicket.Status.CLOSED,
            ).count(),
            1,
        )
        self.assertEqual(
            Notification.objects.filter(source_object_id=ticket_id).count(),
            1,
        )

    def test_acknowledge_versus_reopen_only_one_commits(self):
        ticket = self._create_ticket(
            "Ack vs reopen",
            status=FmTicket.Status.RESOLVED,
        )
        ticket_id = ticket.pk
        actor_id = self.employee.pk

        def acknowledge():
            requester_acknowledge_ticket(
                ticket=FmTicket.objects.get(pk=ticket_id),
                actor=User.objects.get(pk=actor_id),
            )

        def reopen():
            requester_reopen_ticket(
                ticket=FmTicket.objects.get(pk=ticket_id),
                actor=User.objects.get(pk=actor_id),
                reason="Issue returned",
            )

        results = self._run_concurrent([acknowledge, reopen])
        successes = [result for result in results if result is None]
        failures = [result for result in results if result is not None]
        self.assertEqual(len(successes), 1)
        self.assertEqual(len(failures), 1)
        self.assertIsInstance(failures[0], ValidationError)

        ticket.refresh_from_db()
        self.assertIn(
            ticket.status,
            {FmTicket.Status.CLOSED, FmTicket.Status.IN_PROGRESS},
        )
        self.assertEqual(
            FmTicketStatusHistory.objects.filter(ticket_id=ticket_id).count(),
            1,
        )
        self.assertEqual(
            Notification.objects.filter(source_object_id=ticket_id).count(),
            1,
        )

    def test_two_concurrent_cancellations_only_one_transition(self):
        ticket = self._create_ticket("Concurrent cancel")
        ticket_id = ticket.pk
        actor_id = self.employee.pk

        def cancel():
            requester_cancel_ticket(
                ticket=FmTicket.objects.get(pk=ticket_id),
                actor=User.objects.get(pk=actor_id),
                reason="No longer needed",
            )

        results = self._run_concurrent([cancel, cancel])
        successes = [result for result in results if result is None]
        failures = [result for result in results if result is not None]
        self.assertEqual(len(successes), 1)
        self.assertEqual(len(failures), 1)
        self.assertIsInstance(failures[0], ValidationError)

        ticket.refresh_from_db()
        self.assertEqual(ticket.status, FmTicket.Status.CANCELLED)
        self.assertEqual(
            FmTicketStatusHistory.objects.filter(
                ticket_id=ticket_id,
                to_status=FmTicket.Status.CANCELLED,
            ).count(),
            1,
        )
        self.assertEqual(
            Notification.objects.filter(source_object_id=ticket_id).count(),
            1,
        )

    def test_eligibility_is_rechecked_after_locked_row_refresh(self):
        ticket = self._create_ticket(
            "Stale eligibility",
            status=FmTicket.Status.RESOLVED,
        )
        ready = Event()
        outcomes = Queue()
        ticket_id = ticket.pk
        actor_id = self.employee.pk

        def acknowledge_stale():
            close_old_connections()
            stale = FmTicket.objects.get(pk=ticket_id)
            self.assertEqual(stale.status, FmTicket.Status.RESOLVED)
            ready.set()
            try:
                requester_acknowledge_ticket(
                    ticket=stale,
                    actor=User.objects.get(pk=actor_id),
                )
            except Exception as exc:
                outcomes.put(exc)
            else:
                outcomes.put(None)
            finally:
                close_old_connections()

        with transaction.atomic():
            locked = FmTicket.objects.select_for_update().get(pk=ticket_id)
            worker = Thread(target=acknowledge_stale)
            worker.start()
            self.assertTrue(ready.wait(timeout=5))
            locked.status = FmTicket.Status.OPEN
            locked.save(update_fields=["status", "updated_at"])

        worker.join(timeout=15)
        self.assertFalse(worker.is_alive())
        self.assertIsInstance(outcomes.get_nowait(), ValidationError)

        ticket.refresh_from_db()
        self.assertEqual(ticket.status, FmTicket.Status.OPEN)
        self.assertFalse(
            FmTicketStatusHistory.objects.filter(
                ticket_id=ticket_id,
                to_status=FmTicket.Status.CLOSED,
            ).exists()
        )

    def test_active_linked_work_order_blocks_cancellation_under_lock(self):
        ticket = self._create_ticket("WO blocked cancel")
        MaintenanceWorkOrder.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            building=self.data["building"],
            asset=self.data["asset"],
            source_ticket=ticket,
            title="Linked work",
            description="Active maintenance execution",
            status=MaintenanceWorkOrder.Status.IN_PROGRESS,
            priority=MaintenanceWorkOrder.Priority.MEDIUM,
            requester=self.facility_manager,
        )
        stale = FmTicket.objects.get(pk=ticket.pk)

        with self.assertRaises(ValidationError) as ctx:
            requester_cancel_ticket(
                ticket=stale,
                actor=self.employee,
                reason="Attempt",
            )
        self.assertIn("status", ctx.exception.message_dict)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, FmTicket.Status.OPEN)

    def test_notification_failure_still_rolls_back(self):
        ticket = self._create_ticket("Rollback cancel")
        with patch(
            "apps.fm_tickets.notification_service.create_notification",
            side_effect=RuntimeError("notification failed"),
        ):
            with self.assertRaises(RuntimeError):
                requester_cancel_ticket(
                    ticket=FmTicket.objects.get(pk=ticket.pk),
                    actor=self.employee,
                    reason="Should roll back",
                )

        ticket.refresh_from_db()
        self.assertEqual(ticket.status, FmTicket.Status.OPEN)
        self.assertFalse(
            FmTicketStatusHistory.objects.filter(
                ticket=ticket,
                to_status=FmTicket.Status.CANCELLED,
            ).exists()
        )
        self.assertFalse(
            Notification.objects.filter(source_object_id=ticket.id).exists()
        )
