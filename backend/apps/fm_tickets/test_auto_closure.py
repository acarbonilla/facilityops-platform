from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.access_control.models import Role, UserRole
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

from .auto_closure import (
    AUTO_CLOSE_NOTE,
    AUTO_CLOSE_SOURCE,
    auto_close_resolved_ticket,
    get_auto_close_cutoff,
    get_auto_close_days,
    is_ticket_eligible_for_auto_close,
    process_automatic_ticket_closures,
)
from .models import FmTicket, FmTicketHistory, FmTicketStatusHistory
from .services import change_ticket_status
from .tasks import process_automatic_ticket_closures_task


User = get_user_model()


@override_settings(
    PASSWORD_HASHERS=("django.contrib.auth.hashers.MD5PasswordHasher",),
    FM_TICKET_AUTO_CLOSE_DAYS=7,
    FM_TICKET_AUTO_CLOSE_BATCH_SIZE=100,
    FM_TICKET_AUTO_CLOSE_ENABLED=True,
)
class AutomaticTicketClosureTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.data_a = cls._create_master_data("ac")
        cls.data_b = cls._create_master_data("bc")
        cls.employee_a = cls._create_user(
            "auto-close-employee-a@example.com",
            cls.data_a,
            "employee",
        )
        cls.employee_b = cls._create_user(
            "auto-close-employee-b@example.com",
            cls.data_b,
            "employee",
        )
        cls.facility_manager = cls._create_user(
            "auto-close-fm@example.com",
            cls.data_a,
            "facility_manager",
        )

    @classmethod
    def _create_master_data(cls, suffix):
        tenant = Tenant.objects.create(
            name=f"Auto Close Tenant {suffix.upper()}",
            code=f"auto-close-tenant-{suffix}",
        )
        organization = Organization.objects.create(
            tenant=tenant,
            name=f"Auto Close Org {suffix.upper()}",
            code=f"auto-close-organization-{suffix}",
        )
        building = Building.objects.create(
            tenant=tenant,
            organization=organization,
            name=f"Auto Close Building {suffix.upper()}",
            code=f"auto-close-building-{suffix}",
        )
        floor = Floor.objects.create(
            tenant=tenant,
            building=building,
            name=f"Floor {suffix.upper()}",
            code=f"auto-close-floor-{suffix}",
        )
        area = Area.objects.create(
            tenant=tenant,
            building=building,
            floor=floor,
            name=f"Area {suffix.upper()}",
            code=f"auto-close-area-{suffix}",
        )
        asset_type = AssetType.objects.create(
            tenant=tenant,
            name=f"Type {suffix.upper()}",
            code=f"auto-close-asset-type-{suffix}",
        )
        asset = Asset.objects.create(
            tenant=tenant,
            organization=organization,
            building=building,
            floor=floor,
            area=area,
            asset_type=asset_type,
            name=f"Asset {suffix.upper()}",
            code=f"auto-close-asset-{suffix}",
        )
        return {
            "tenant": tenant,
            "organization": organization,
            "building": building,
            "floor": floor,
            "area": area,
            "asset": asset,
        }

    @classmethod
    def _create_user(cls, email, data, role_code):
        user = User.objects.create_user(
            email=email,
            password="Password123!",
            tenant=data["tenant"],
            organization=data["organization"],
        )
        UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
        return user

    def _create_resolved_ticket(
        self,
        requester,
        title,
        *,
        resolved_at,
        data=None,
        assignee=None,
    ):
        data = data or self.data_a
        ticket = FmTicket.objects.create(
            tenant=data["tenant"],
            organization=data["organization"],
            building=data["building"],
            floor=data["floor"],
            area=data["area"],
            asset=data["asset"],
            requester=requester,
            assignee=assignee,
            title=title,
            description=f"{title} description",
            category=FmTicket.Category.OTHER,
            priority=FmTicket.Priority.MEDIUM,
            status=FmTicket.Status.RESOLVED,
            source=FmTicket.Source.WEB,
            resolved_at=resolved_at,
        )
        return ticket

    def test_default_auto_close_period_is_seven_days(self):
        self.assertEqual(get_auto_close_days(), 7)

    def test_resolved_before_cutoff_closes(self):
        now = timezone.now()
        ticket = self._create_resolved_ticket(
            self.employee_a,
            "Past deadline",
            resolved_at=now - timedelta(days=7, seconds=1),
            assignee=self.facility_manager,
        )

        result = auto_close_resolved_ticket(ticket_id=ticket.id, now=now)

        self.assertEqual(result.outcome, "closed")
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, FmTicket.Status.CLOSED)
        self.assertIsNotNone(ticket.closed_at)
        self.assertEqual(ticket.resolved_at, now - timedelta(days=7, seconds=1))

        status_history = FmTicketStatusHistory.objects.filter(ticket=ticket).latest(
            "changed_at"
        )
        self.assertEqual(status_history.from_status, FmTicket.Status.RESOLVED)
        self.assertEqual(status_history.to_status, FmTicket.Status.CLOSED)
        self.assertIsNone(status_history.changed_by_id)
        self.assertEqual(status_history.note, AUTO_CLOSE_NOTE)

        history = FmTicketHistory.objects.filter(
            ticket=ticket,
            action="status_changed",
        ).latest("created_at")
        self.assertIsNone(history.actor_id)
        self.assertEqual(history.metadata.get("source"), AUTO_CLOSE_SOURCE)
        self.assertEqual(history.ticket_id, ticket.id)

        notifications = list(
            Notification.objects.filter(source_object_id=ticket.id).order_by(
                "created_at"
            )
        )
        self.assertEqual(len(notifications), 2)
        by_recipient = {item.recipient_id: item for item in notifications}
        requester_note = by_recipient[self.employee_a.id]
        self.assertEqual(
            requester_note.title,
            "Your request was automatically closed",
        )
        self.assertIn("acknowledgement period expired", requester_note.message)
        self.assertEqual(requester_note.target_url, f"/my-requests/{ticket.id}")
        self.assertEqual(requester_note.tenant_id, ticket.tenant_id)
        self.assertEqual(requester_note.metadata.get("event"), AUTO_CLOSE_SOURCE)

        assignee_note = by_recipient[self.facility_manager.id]
        self.assertEqual(assignee_note.target_url, f"/fm-tickets/{ticket.id}")

    def test_resolved_exactly_at_cutoff_closes(self):
        now = timezone.now()
        cutoff = get_auto_close_cutoff(now=now, days=7)
        ticket = self._create_resolved_ticket(
            self.employee_a,
            "Exact cutoff",
            resolved_at=cutoff,
        )

        self.assertTrue(is_ticket_eligible_for_auto_close(ticket, now=now, days=7))
        result = auto_close_resolved_ticket(ticket_id=ticket.id, now=now, days=7)
        self.assertEqual(result.outcome, "closed")

    def test_resolved_after_cutoff_remains_open(self):
        now = timezone.now()
        ticket = self._create_resolved_ticket(
            self.employee_a,
            "Too recent",
            resolved_at=now - timedelta(days=6, hours=23),
        )

        result = auto_close_resolved_ticket(ticket_id=ticket.id, now=now)
        self.assertEqual(result.outcome, "skipped")
        self.assertEqual(result.reason, "deadline_not_reached")
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, FmTicket.Status.RESOLVED)
        self.assertIsNone(ticket.closed_at)

    def test_non_resolved_statuses_never_close(self):
        now = timezone.now()
        for status_value in (
            FmTicket.Status.OPEN,
            FmTicket.Status.IN_PROGRESS,
            FmTicket.Status.CANCELLED,
            FmTicket.Status.CLOSED,
        ):
            ticket = FmTicket.objects.create(
                tenant=self.data_a["tenant"],
                organization=self.data_a["organization"],
                building=self.data_a["building"],
                requester=self.employee_a,
                title=f"Status {status_value}",
                description="x",
                category=FmTicket.Category.OTHER,
                priority=FmTicket.Priority.MEDIUM,
                status=status_value,
                source=FmTicket.Source.WEB,
                resolved_at=now - timedelta(days=10),
                closed_at=(
                    now
                    if status_value
                    in {FmTicket.Status.CLOSED, FmTicket.Status.CANCELLED}
                    else None
                ),
            )
            result = auto_close_resolved_ticket(ticket_id=ticket.id, now=now)
            self.assertEqual(result.outcome, "skipped")
            ticket.refresh_from_db()
            self.assertEqual(ticket.status, status_value)

    def test_missing_resolved_at_skips_safely(self):
        ticket = self._create_resolved_ticket(
            self.employee_a,
            "Missing resolved_at",
            resolved_at=timezone.now() - timedelta(days=10),
        )
        ticket.resolved_at = None
        ticket.save(update_fields=["resolved_at"])

        result = auto_close_resolved_ticket(ticket_id=ticket.id)
        self.assertEqual(result.outcome, "skipped")
        self.assertEqual(result.reason, "missing_resolved_at")

    def test_soft_deleted_ticket_excluded(self):
        now = timezone.now()
        ticket = self._create_resolved_ticket(
            self.employee_a,
            "Soft deleted",
            resolved_at=now - timedelta(days=10),
        )
        ticket.is_deleted = True
        ticket.deleted_at = now
        ticket.save(update_fields=["is_deleted", "deleted_at"])

        result = auto_close_resolved_ticket(ticket_id=ticket.id, now=now)
        self.assertEqual(result.outcome, "skipped")
        self.assertEqual(result.reason, "soft_deleted")

    def test_inactive_tenant_excluded(self):
        now = timezone.now()
        ticket = self._create_resolved_ticket(
            self.employee_a,
            "Inactive tenant",
            resolved_at=now - timedelta(days=10),
        )
        tenant = ticket.tenant
        tenant.is_active = False
        tenant.save(update_fields=["is_active"])

        result = auto_close_resolved_ticket(ticket_id=ticket.id, now=now)
        self.assertEqual(result.outcome, "skipped")
        self.assertEqual(result.reason, "invalid_tenant")

    def test_acknowledge_before_deadline_prevents_auto_close(self):
        now = timezone.now()
        ticket = self._create_resolved_ticket(
            self.employee_a,
            "Acknowledged",
            resolved_at=now - timedelta(days=10),
        )
        change_ticket_status(
            ticket=ticket,
            to_status=FmTicket.Status.CLOSED,
            changed_by=self.employee_a,
            note="Requester acknowledged resolution.",
        )

        result = auto_close_resolved_ticket(ticket_id=ticket.id, now=now)
        self.assertEqual(result.outcome, "skipped")
        self.assertEqual(result.reason, "already_closed")
        self.assertEqual(
            FmTicketStatusHistory.objects.filter(
                ticket=ticket,
                note=AUTO_CLOSE_NOTE,
            ).count(),
            0,
        )

    def test_reopen_before_processing_prevents_auto_close(self):
        now = timezone.now()
        ticket = self._create_resolved_ticket(
            self.employee_a,
            "Reopened",
            resolved_at=now - timedelta(days=10),
        )
        change_ticket_status(
            ticket=ticket,
            to_status=FmTicket.Status.IN_PROGRESS,
            changed_by=self.employee_a,
            note="Requester reopened.",
        )

        result = auto_close_resolved_ticket(ticket_id=ticket.id, now=now)
        self.assertEqual(result.outcome, "skipped")
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, FmTicket.Status.IN_PROGRESS)
        self.assertIsNone(ticket.resolved_at)

    def test_manual_closure_unchanged_and_distinguishable(self):
        now = timezone.now()
        ticket = self._create_resolved_ticket(
            self.employee_a,
            "Manual close",
            resolved_at=now - timedelta(days=1),
        )
        change_ticket_status(
            ticket=ticket,
            to_status=FmTicket.Status.CLOSED,
            changed_by=self.facility_manager,
            note="Closed by Facility Manager.",
        )
        history = FmTicketHistory.objects.filter(ticket=ticket).latest("created_at")
        self.assertEqual(history.actor_id, self.facility_manager.id)
        self.assertNotEqual(history.metadata.get("source"), AUTO_CLOSE_SOURCE)

    def test_repeated_processing_is_idempotent(self):
        now = timezone.now()
        ticket = self._create_resolved_ticket(
            self.employee_a,
            "Idempotent",
            resolved_at=now - timedelta(days=10),
            assignee=self.facility_manager,
        )

        first = auto_close_resolved_ticket(ticket_id=ticket.id, now=now)
        second = auto_close_resolved_ticket(ticket_id=ticket.id, now=now)

        self.assertEqual(first.outcome, "closed")
        self.assertEqual(second.outcome, "skipped")
        self.assertEqual(second.reason, "already_closed")
        self.assertEqual(
            FmTicketStatusHistory.objects.filter(
                ticket=ticket,
                to_status=FmTicket.Status.CLOSED,
            ).count(),
            1,
        )
        self.assertEqual(
            Notification.objects.filter(
                source_object_id=ticket.id,
                metadata__event=AUTO_CLOSE_SOURCE,
            ).count(),
            2,
        )

    def test_batch_is_bounded_and_isolates_failures(self):
        now = timezone.now()
        eligible_ids = []
        for index in range(3):
            ticket = self._create_resolved_ticket(
                self.employee_a,
                f"Batch {index}",
                resolved_at=now - timedelta(days=10),
            )
            eligible_ids.append(ticket.id)

        real_close = auto_close_resolved_ticket
        calls = {"n": 0}

        def flaky(*, ticket_id, now=None, days=None):
            calls["n"] += 1
            if calls["n"] == 2:
                raise RuntimeError("boom")
            return real_close(ticket_id=ticket_id, now=now, days=days)

        with patch(
            "apps.fm_tickets.auto_closure.auto_close_resolved_ticket",
            side_effect=flaky,
        ):
            counts = process_automatic_ticket_closures(now=now, batch_size=3)

        self.assertEqual(counts["examined"], 3)
        self.assertEqual(counts["closed"], 2)
        self.assertEqual(counts["failed"], 1)
        self.assertEqual(
            FmTicket.objects.filter(
                id__in=eligible_ids,
                status=FmTicket.Status.CLOSED,
            ).count(),
            2,
        )

    def test_cross_tenant_tickets_close_independently(self):
        now = timezone.now()
        ticket_a = self._create_resolved_ticket(
            self.employee_a,
            "Tenant A",
            resolved_at=now - timedelta(days=10),
            data=self.data_a,
        )
        ticket_b = self._create_resolved_ticket(
            self.employee_b,
            "Tenant B",
            resolved_at=now - timedelta(days=10),
            data=self.data_b,
        )

        process_automatic_ticket_closures(now=now, batch_size=10)

        ticket_a.refresh_from_db()
        ticket_b.refresh_from_db()
        self.assertEqual(ticket_a.status, FmTicket.Status.CLOSED)
        self.assertEqual(ticket_b.status, FmTicket.Status.CLOSED)

        note_a = Notification.objects.get(
            source_object_id=ticket_a.id,
            recipient=self.employee_a,
        )
        note_b = Notification.objects.get(
            source_object_id=ticket_b.id,
            recipient=self.employee_b,
        )
        self.assertEqual(note_a.tenant_id, self.data_a["tenant"].id)
        self.assertEqual(note_b.tenant_id, self.data_b["tenant"].id)
        self.assertNotEqual(note_a.tenant_id, note_b.tenant_id)

    def test_notification_failure_rolls_back_closure(self):
        now = timezone.now()
        ticket = self._create_resolved_ticket(
            self.employee_a,
            "Notify fail",
            resolved_at=now - timedelta(days=10),
        )

        with patch(
            "apps.fm_tickets.services.notify_fm_ticket_status_changed",
            side_effect=RuntimeError("notification failed"),
        ):
            with self.assertRaises(RuntimeError):
                auto_close_resolved_ticket(ticket_id=ticket.id, now=now)

        ticket.refresh_from_db()
        self.assertEqual(ticket.status, FmTicket.Status.RESOLVED)
        self.assertIsNone(ticket.closed_at)
        self.assertFalse(
            FmTicketStatusHistory.objects.filter(
                ticket=ticket,
                to_status=FmTicket.Status.CLOSED,
            ).exists()
        )

    def test_celery_task_respects_enabled_flag(self):
        with override_settings(FM_TICKET_AUTO_CLOSE_ENABLED=False):
            result = process_automatic_ticket_closures_task()
        self.assertTrue(result["disabled"])
        self.assertEqual(result["closed"], 0)

    def test_celery_task_invokes_processor_when_enabled(self):
        with patch(
            "apps.fm_tickets.tasks.process_automatic_ticket_closures",
            return_value={"examined": 1, "closed": 1, "skipped": 0, "failed": 0},
        ) as mocked:
            result = process_automatic_ticket_closures_task()
        self.assertEqual(result["closed"], 1)
        mocked.assert_called_once_with()

    def test_batch_processor_closes_eligible_ticket(self):
        now = timezone.now()
        ticket = self._create_resolved_ticket(
            self.employee_a,
            "Batch path",
            resolved_at=now - timedelta(days=10),
        )
        result = process_automatic_ticket_closures(now=now, batch_size=10)
        self.assertGreaterEqual(result["closed"], 1)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, FmTicket.Status.CLOSED)