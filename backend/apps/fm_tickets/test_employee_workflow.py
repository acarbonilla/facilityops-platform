from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import transaction
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

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

from .models import FmTicket, FmTicketHistory, FmTicketStatusHistory


User = get_user_model()


class EmployeeRequesterWorkflowTests(APITestCase):
    maxDiff = None

    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.data_a = cls._create_master_data("a")
        cls.data_b = cls._create_master_data("b")

        cls.employee_a = cls._create_user(
            "workflow-employee-a@example.com",
            cls.data_a,
            "employee",
        )
        cls.employee_other = cls._create_user(
            "workflow-employee-other@example.com",
            cls.data_a,
            "employee",
        )
        cls.employee_b = cls._create_user(
            "workflow-employee-b@example.com",
            cls.data_b,
            "employee",
        )
        cls.facility_manager = cls._create_user(
            "workflow-fm@example.com",
            cls.data_a,
            "facility_manager",
        )
        cls.staff_employee = cls._create_user(
            "workflow-staff-employee@example.com",
            cls.data_a,
            "employee",
            is_staff=True,
        )
        cls.multi_role = cls._create_user(
            "workflow-multi@example.com",
            cls.data_a,
            "employee",
        )
        UserRole.objects.create(
            user=cls.multi_role,
            role=Role.objects.get(code="facility_manager"),
        )

    @classmethod
    def _create_master_data(cls, suffix):
        tenant = Tenant.objects.create(
            name=f"Workflow Tenant {suffix.upper()}",
            code=f"workflow-tenant-{suffix}",
        )
        organization = Organization.objects.create(
            tenant=tenant,
            name=f"Workflow Org {suffix.upper()}",
            code=f"workflow-organization-{suffix}",
        )
        building = Building.objects.create(
            tenant=tenant,
            organization=organization,
            name=f"Workflow Building {suffix.upper()}",
            code=f"workflow-building-{suffix}",
        )
        floor = Floor.objects.create(
            tenant=tenant,
            building=building,
            name=f"Floor {suffix.upper()}",
            code=f"workflow-floor-{suffix}",
        )
        area = Area.objects.create(
            tenant=tenant,
            building=building,
            floor=floor,
            name=f"Area {suffix.upper()}",
            code=f"workflow-area-{suffix}",
        )
        asset_type = AssetType.objects.create(
            tenant=tenant,
            name=f"Type {suffix.upper()}",
            code=f"workflow-asset-type-{suffix}",
        )
        asset = Asset.objects.create(
            tenant=tenant,
            organization=organization,
            building=building,
            floor=floor,
            area=area,
            asset_type=asset_type,
            name=f"Asset {suffix.upper()}",
            code=f"workflow-asset-{suffix}",
        )
        return {
            "tenant": tenant,
            "organization": organization,
            "building": building,
            "floor": floor,
            "area": area,
            "asset": asset,
            "asset_type": asset_type,
        }

    @classmethod
    def _create_user(cls, email, data, role_code, **extra):
        user = User.objects.create_user(
            email=email,
            password="Password123!",
            tenant=data["tenant"] if data else None,
            organization=data["organization"] if data else None,
            **extra,
        )
        UserRole.objects.create(user=user, role=Role.objects.get(code=role_code))
        return user

    def _create_ticket(self, requester, title, status=FmTicket.Status.OPEN, data=None):
        data = data or self.data_a
        return FmTicket.objects.create(
            tenant=data["tenant"],
            organization=data["organization"],
            building=data["building"],
            floor=data["floor"],
            area=data["area"],
            asset=data["asset"],
            requester=requester,
            title=title,
            description=f"{title} description",
            category=FmTicket.Category.OTHER,
            priority=FmTicket.Priority.MEDIUM,
            status=status,
            source=FmTicket.Source.WEB,
        )

    def _authenticate(self, user):
        self.client.force_authenticate(user)

    def _cancel_url(self, ticket_id):
        return reverse("fm-ticket-requester-cancel", args=[ticket_id])

    def _acknowledge_url(self, ticket_id):
        return reverse("fm-ticket-requester-acknowledge", args=[ticket_id])

    def _reopen_url(self, ticket_id):
        return reverse("fm-ticket-requester-reopen", args=[ticket_id])

    def test_unauthenticated_requester_actions_are_rejected(self):
        ticket = self._create_ticket(self.employee_a, "Unauth cancel")
        for url in (
            self._cancel_url(ticket.id),
            self._acknowledge_url(ticket.id),
            self._reopen_url(ticket.id),
        ):
            response = self.client.post(url, {"reason": "No longer needed"}, format="json")
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_employee_can_cancel_own_open_request_with_reason(self):
        ticket = self._create_ticket(self.employee_a, "Cancel me")
        assignee = self.facility_manager
        ticket.assignee = assignee
        ticket.save(update_fields=["assignee"])

        self._authenticate(self.employee_a)
        response = self.client.post(
            self._cancel_url(ticket.id),
            {"reason": "No longer needed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], FmTicket.Status.CANCELLED)
        self.assertFalse(response.data["can_cancel"])
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, FmTicket.Status.CANCELLED)
        self.assertIsNotNone(ticket.closed_at)

        status_history = FmTicketStatusHistory.objects.filter(ticket=ticket).latest(
            "changed_at"
        )
        self.assertEqual(status_history.from_status, FmTicket.Status.OPEN)
        self.assertEqual(status_history.to_status, FmTicket.Status.CANCELLED)
        self.assertEqual(status_history.changed_by_id, self.employee_a.id)
        self.assertEqual(status_history.note, "No longer needed")

        history = FmTicketHistory.objects.filter(
            ticket=ticket,
            action="status_changed",
        ).latest("created_at")
        self.assertEqual(history.actor_id, self.employee_a.id)

        notifications = list(
            Notification.objects.filter(source_object_id=ticket.id).order_by("created_at")
        )
        self.assertEqual(len(notifications), 1)
        self.assertEqual(notifications[0].recipient_id, assignee.id)
        self.assertEqual(notifications[0].target_url, f"/fm-tickets/{ticket.id}")
        self.assertFalse(
            Notification.objects.filter(
                source_object_id=ticket.id,
                recipient=self.employee_a,
            ).exists()
        )

    def test_cancellation_requires_reason(self):
        ticket = self._create_ticket(self.employee_a, "Needs reason")
        self._authenticate(self.employee_a)
        response = self.client.post(self._cancel_url(ticket.id), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reason", response.data)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, FmTicket.Status.OPEN)

    def test_non_owned_same_tenant_and_cross_tenant_cancel_return_generic_404(self):
        own_other = self._create_ticket(self.employee_other, "Other owned")
        cross = self._create_ticket(
            self.employee_b,
            "Cross tenant",
            data=self.data_b,
        )
        self._authenticate(self.employee_a)
        details = []
        for ticket in (own_other, cross):
            response = self.client.post(
                self._cancel_url(ticket.id),
                {"reason": "Attempt"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
            details.append(str(response.data["detail"]))
        self.assertEqual(details[0], details[1])

    def test_deleted_ticket_cancel_returns_404(self):
        ticket = self._create_ticket(self.employee_a, "Soft deleted")
        ticket.is_deleted = True
        ticket.save(update_fields=["is_deleted"])
        self._authenticate(self.employee_a)
        response = self.client.post(
            self._cancel_url(ticket.id),
            {"reason": "Attempt"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_status_and_active_work_order_block_cancellation(self):
        resolved = self._create_ticket(
            self.employee_a,
            "Resolved block",
            status=FmTicket.Status.RESOLVED,
        )
        in_progress = self._create_ticket(
            self.employee_a,
            "In progress block",
            status=FmTicket.Status.IN_PROGRESS,
        )
        open_with_wo = self._create_ticket(self.employee_a, "Linked WO")
        MaintenanceWorkOrder.objects.create(
            tenant=self.data_a["tenant"],
            organization=self.data_a["organization"],
            building=self.data_a["building"],
            asset=self.data_a["asset"],
            source_ticket=open_with_wo,
            title="Linked work",
            description="Active maintenance execution",
            status=MaintenanceWorkOrder.Status.IN_PROGRESS,
            priority=MaintenanceWorkOrder.Priority.MEDIUM,
            requester=self.facility_manager,
        )

        self._authenticate(self.employee_a)
        for ticket in (resolved, in_progress, open_with_wo):
            response = self.client.post(
                self._cancel_url(ticket.id),
                {"reason": "Attempt"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("status", response.data)

    def test_duplicate_cancellation_does_not_duplicate_history(self):
        ticket = self._create_ticket(self.employee_a, "Duplicate cancel")
        self._authenticate(self.employee_a)
        first = self.client.post(
            self._cancel_url(ticket.id),
            {"reason": "First cancel"},
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        history_count = FmTicketStatusHistory.objects.filter(ticket=ticket).count()
        notification_count = Notification.objects.filter(
            source_object_id=ticket.id
        ).count()

        second = self.client.post(
            self._cancel_url(ticket.id),
            {"reason": "Second cancel"},
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            FmTicketStatusHistory.objects.filter(ticket=ticket).count(),
            history_count,
        )
        self.assertEqual(
            Notification.objects.filter(source_object_id=ticket.id).count(),
            notification_count,
        )

    def test_acknowledge_resolved_request_closes_it(self):
        ticket = self._create_ticket(
            self.employee_a,
            "Acknowledge me",
            status=FmTicket.Status.RESOLVED,
        )
        ticket.assignee = self.facility_manager
        ticket.save(update_fields=["assignee"])

        self._authenticate(self.employee_a)
        response = self.client.post(self._acknowledge_url(ticket.id), {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], FmTicket.Status.CLOSED)
        self.assertFalse(response.data["can_acknowledge"])
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, FmTicket.Status.CLOSED)
        self.assertIsNotNone(ticket.closed_at)

        notification = Notification.objects.get(
            source_object_id=ticket.id,
            recipient=self.facility_manager,
        )
        self.assertEqual(notification.target_url, f"/fm-tickets/{ticket.id}")

    def test_acknowledge_rejects_non_resolved_and_closed_states(self):
        open_ticket = self._create_ticket(self.employee_a, "Open ack")
        closed = self._create_ticket(
            self.employee_a,
            "Already closed",
            status=FmTicket.Status.CLOSED,
        )
        self._authenticate(self.employee_a)
        for ticket in (open_ticket, closed):
            response = self.client.post(
                self._acknowledge_url(ticket.id),
                {},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reopen_resolved_request_requires_reason_and_moves_to_in_progress(self):
        ticket = self._create_ticket(
            self.employee_a,
            "Reopen me",
            status=FmTicket.Status.RESOLVED,
        )
        ticket.assignee = self.facility_manager
        ticket.save(update_fields=["assignee"])

        self._authenticate(self.employee_a)
        missing = self.client.post(self._reopen_url(ticket.id), {}, format="json")
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("reason", missing.data)

        response = self.client.post(
            self._reopen_url(ticket.id),
            {"reason": "Issue returned"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], FmTicket.Status.IN_PROGRESS)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, FmTicket.Status.IN_PROGRESS)
        self.assertIsNone(ticket.resolved_at)
        self.assertIsNone(ticket.closed_at)

        notification = Notification.objects.get(
            source_object_id=ticket.id,
            recipient=self.facility_manager,
        )
        self.assertEqual(notification.target_url, f"/fm-tickets/{ticket.id}")

    def test_reopen_rejects_non_resolved_status(self):
        ticket = self._create_ticket(self.employee_a, "Open reopen")
        self._authenticate(self.employee_a)
        response = self.client.post(
            self._reopen_url(ticket.id),
            {"reason": "Attempt"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_staff_alone_provides_no_bypass_for_non_owned_ticket(self):
        ticket = self._create_ticket(self.employee_other, "Staff cannot cancel")
        self._authenticate(self.staff_employee)
        response = self.client.post(
            self._cancel_url(ticket.id),
            {"reason": "Staff attempt"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_multi_role_operational_user_cannot_use_requester_endpoints(self):
        ticket = self._create_ticket(self.multi_role, "Operational owned")
        self._authenticate(self.multi_role)
        response = self.client.post(
            self._cancel_url(ticket.id),
            {"reason": "Should use operational path"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_operational_status_change_notifies_employee_with_my_requests_target(self):
        ticket = self._create_ticket(self.employee_a, "Notify requester")
        self._authenticate(self.facility_manager)
        response = self.client.post(
            reverse("fm-ticket-change-status", args=[ticket.id]),
            {"status": FmTicket.Status.IN_PROGRESS, "note": "Started"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        notification = Notification.objects.get(
            source_object_id=ticket.id,
            recipient=self.employee_a,
        )
        self.assertEqual(notification.target_url, f"/my-requests/{ticket.id}")
        self.assertEqual(notification.title, "Your request status was updated")
        self.assertFalse(
            Notification.objects.filter(
                source_object_id=ticket.id,
                recipient=self.facility_manager,
            ).exists()
        )

    def test_notification_rollback_when_create_fails(self):
        ticket = self._create_ticket(self.employee_a, "Rollback cancel")
        ticket.assignee = self.facility_manager
        ticket.save(update_fields=["assignee"])
        self._authenticate(self.employee_a)

        with patch(
            "apps.fm_tickets.notification_service.create_notification",
            side_effect=RuntimeError("notification failed"),
        ):
            with self.assertRaises(RuntimeError):
                with transaction.atomic():
                    self.client.post(
                        self._cancel_url(ticket.id),
                        {"reason": "Should roll back"},
                        format="json",
                    )

        ticket.refresh_from_db()
        self.assertEqual(ticket.status, FmTicket.Status.OPEN)
        self.assertFalse(
            FmTicketStatusHistory.objects.filter(
                ticket=ticket,
                to_status=FmTicket.Status.CANCELLED,
            ).exists()
        )
