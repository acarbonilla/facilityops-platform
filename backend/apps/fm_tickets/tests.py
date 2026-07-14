from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
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
from apps.notifications.models import Notification

from .models import (
    FmTicket,
    FmTicketComment,
    FmTicketEscalation,
    FmTicketHistory,
    FmTicketStatusHistory,
)
from .notification_service import (
    ASSIGNMENT_EVENT_CODE,
    STATUS_CHANGED_EVENT_CODE,
)
from .services import assign_ticket, change_ticket_status


User = get_user_model()


class FmTicketTestDataMixin:
    def create_ticket_permissions(self):
        permission_definitions = [
            ("fm_tickets.view", "fm_tickets", "view", "View FM tickets"),
            ("fm_tickets.create", "fm_tickets", "create", "Create FM tickets"),
            ("fm_tickets.update", "fm_tickets", "update", "Update FM tickets"),
            ("fm_tickets.assign", "fm_tickets", "assign", "Assign FM tickets"),
            ("fm_tickets.close", "fm_tickets", "close", "Close FM tickets"),
            ("fm_tickets.manage", "fm_tickets", "manage", "Manage FM tickets"),
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

    def create_ticket_payload(self, data):
        return {
            "tenant": str(data["tenant"].id),
            "organization": str(data["organization"].id),
            "department": str(data["department"].id),
            "building": str(data["building"].id),
            "floor": str(data["floor"].id),
            "area": str(data["area"].id),
            "asset": str(data["asset"].id),
            "title": "Aircon not cooling",
            "description": "The lobby aircon is running but not cooling properly.",
            "category": FmTicket.Category.HVAC,
            "priority": FmTicket.Priority.HIGH,
            "source": FmTicket.Source.WEB,
        }


class FmTicketModelTests(FmTicketTestDataMixin, APITestCase):
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

    def test_ticket_creation_generates_ticket_number(self):
        ticket = FmTicket.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            asset=self.data["asset"],
            requester=self.user,
            assignee=self.assignee,
            title="Generator issue",
            description="Generator requires inspection.",
            category=FmTicket.Category.ELECTRICAL,
            priority=FmTicket.Priority.MEDIUM,
            source=FmTicket.Source.ADMIN,
        )

        self.assertTrue(ticket.ticket_number.startswith("FM-"))
        self.assertEqual(str(ticket), ticket.ticket_number)

    def test_comment_and_history_models_create_expected_relations(self):
        ticket = FmTicket.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            asset=self.data["asset"],
            requester=self.user,
            title="Door issue",
            description="Door hinge is loose.",
            category=FmTicket.Category.CIVIL,
            priority=FmTicket.Priority.LOW,
            source=FmTicket.Source.WEB,
        )
        comment = FmTicketComment.objects.create(
            ticket=ticket,
            author=self.user,
            body="Initial comment",
        )
        history = FmTicketHistory.objects.create(
            ticket=ticket,
            actor=self.user,
            action="created",
            description="Ticket created.",
        )
        status_history = FmTicketStatusHistory.objects.create(
            ticket=ticket,
            from_status=None,
            to_status=FmTicket.Status.OPEN,
            changed_by=self.user,
        )

        self.assertEqual(comment.ticket, ticket)
        self.assertEqual(history.ticket, ticket)
        self.assertEqual(status_history.ticket, ticket)

    def test_sla_and_escalation_models_store_foundation_data(self):
        now = timezone.now()
        ticket = FmTicket.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            asset=self.data["asset"],
            requester=self.user,
            assignee=self.assignee,
            title="Pump issue",
            description="The water pump is noisy.",
            category=FmTicket.Category.OTHER,
            priority=FmTicket.Priority.HIGH,
            source=FmTicket.Source.ADMIN,
            response_due_at=now + timedelta(hours=8),
            resolution_due_at=now + timedelta(days=1),
            first_responded_at=now + timedelta(minutes=30),
        )
        escalation = FmTicketEscalation.objects.create(
            ticket=ticket,
            escalated_by=self.user,
            escalated_to=self.assignee,
            reason="Supervisor review required.",
            level=FmTicketEscalation.Level.LEVEL_1,
        )

        self.assertTrue(ticket.response_met)
        self.assertIsNone(ticket.resolution_met)
        self.assertEqual(escalation.ticket, ticket)
        self.assertTrue(escalation.is_active)


class FmTicketApiTests(FmTicketTestDataMixin, APITestCase):
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
        self.permissions = self.create_ticket_permissions()
        self.assign_permissions(
            self.user,
            "fm_tickets.view",
            "fm_tickets.create",
            "fm_tickets.update",
            "fm_tickets.assign",
            "fm_tickets.close",
            "fm_tickets.manage",
        )
        self.assign_permissions(self.viewer, "fm_tickets.view")
        self.data = self.create_master_data()
        self.ticket = FmTicket.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            asset=self.data["asset"],
            requester=self.user,
            title="Existing Ticket",
            description="Existing issue.",
            category=FmTicket.Category.OTHER,
            priority=FmTicket.Priority.MEDIUM,
            source=FmTicket.Source.ADMIN,
            response_due_at=timezone.now() + timedelta(hours=8),
            resolution_due_at=timezone.now() + timedelta(days=1),
        )

    def test_ticket_list_requires_authentication(self):
        response = self.client.get(reverse("fm-ticket-list"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ticket_list_requires_permission(self):
        self.client.force_authenticate(self.other_user)

        response = self.client.get(reverse("fm-ticket-list"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_ticket_list_returns_data_for_authorized_user(self):
        self.client.force_authenticate(self.user)

        response = self.client.get(reverse("fm-ticket-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_ticket_create_requires_permission(self):
        self.client.force_authenticate(self.viewer)

        response = self.client.post(
            reverse("fm-ticket-list"),
            self.create_ticket_payload(self.data),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_ticket_create_sets_requester_from_authenticated_user(self):
        self.client.force_authenticate(self.user)
        payload = self.create_ticket_payload(self.data)
        payload["requester"] = str(self.other_user.id)

        response = self.client.post(reverse("fm-ticket-list"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created_ticket = FmTicket.objects.get(id=response.data["id"])
        self.assertEqual(created_ticket.requester, self.user)
        self.assertEqual(created_ticket.history_entries.count(), 1)
        self.assertEqual(created_ticket.status_history_entries.count(), 1)

    def test_ticket_detail_requires_permission(self):
        self.client.force_authenticate(self.other_user)

        response = self.client.get(reverse("fm-ticket-detail", args=[self.ticket.id]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_ticket_update_requires_permission(self):
        self.client.force_authenticate(self.viewer)

        response = self.client.patch(
            reverse("fm-ticket-detail", args=[self.ticket.id]),
            {"title": "Updated Title"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_ticket_update_creates_history_entry(self):
        self.client.force_authenticate(self.user)

        response = self.client.patch(
            reverse("fm-ticket-detail", args=[self.ticket.id]),
            {"title": "Updated Title"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.title, "Updated Title")
        self.assertEqual(
            self.ticket.history_entries.filter(action="updated").count(),
            1,
        )

    def test_ticket_detail_includes_sla_and_escalation_data(self):
        FmTicketEscalation.objects.create(
            ticket=self.ticket,
            escalated_by=self.user,
            escalated_to=self.other_user,
            reason="Needs higher priority review.",
            level=FmTicketEscalation.Level.LEVEL_2,
        )
        self.client.force_authenticate(self.viewer)

        response = self.client.get(reverse("fm-ticket-detail", args=[self.ticket.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["sla"]["sla_status"], FmTicket.SlaStatus.NOT_STARTED)
        self.assertEqual(len(response.data["escalation_history"]), 1)
        self.assertEqual(
            response.data["escalation_history"][0]["level"],
            FmTicketEscalation.Level.LEVEL_2,
        )

    def test_comment_creation_works(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse("fm-ticket-comments", args=[self.ticket.id]),
            {"body": "Please prioritize this issue.", "is_internal": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.ticket.comments.count(), 1)
        self.assertEqual(
            self.ticket.history_entries.filter(action="comment_added").count(),
            1,
        )

    def test_history_endpoint_requires_view_permission(self):
        self.client.force_authenticate(self.viewer)

        response = self.client.get(reverse("fm-ticket-history", args=[self.ticket.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_escalations_endpoint_returns_history(self):
        FmTicketEscalation.objects.create(
            ticket=self.ticket,
            escalated_by=self.user,
            escalated_to=self.other_user,
            reason="Escalate for urgent handling.",
            level=FmTicketEscalation.Level.LEVEL_1,
        )
        self.client.force_authenticate(self.viewer)

        response = self.client.get(reverse("fm-ticket-escalations", args=[self.ticket.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["reason"], "Escalate for urgent handling.")

    def test_status_change_requires_close_permission_for_terminal_state(self):
        self.client.force_authenticate(self.viewer)

        response = self.client.post(
            reverse("fm-ticket-change-status", args=[self.ticket.id]),
            {"status": FmTicket.Status.CLOSED, "note": "Closing ticket."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_status_change_records_status_history(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse("fm-ticket-change-status", args=[self.ticket.id]),
            {"status": FmTicket.Status.RESOLVED, "note": "Issue fixed."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, FmTicket.Status.RESOLVED)
        self.assertEqual(self.ticket.status_history_entries.count(), 1)

    def test_assign_endpoint_requires_assign_permission(self):
        self.client.force_authenticate(self.viewer)

        response = self.client.post(
            reverse("fm-ticket-assign", args=[self.ticket.id]),
            {"assignee": str(self.other_user.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_assign_endpoint_updates_assignee(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse("fm-ticket-assign", args=[self.ticket.id]),
            {"assignee": str(self.other_user.id), "note": "Assign to technician."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.assignee, self.other_user)

    def test_escalate_endpoint_requires_manage_permission(self):
        self.client.force_authenticate(self.viewer)

        response = self.client.post(
            reverse("fm-ticket-escalate", args=[self.ticket.id]),
            {
                "reason": "Need supervisor approval.",
                "level": FmTicketEscalation.Level.MANAGEMENT,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_escalate_endpoint_creates_active_escalation(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse("fm-ticket-escalate", args=[self.ticket.id]),
            {
                "escalated_to": str(self.other_user.id),
                "reason": "Escalate to management for SLA visibility.",
                "level": FmTicketEscalation.Level.MANAGEMENT,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(FmTicketEscalation.objects.filter(ticket=self.ticket).count(), 1)
        escalation = FmTicketEscalation.objects.get(ticket=self.ticket)
        self.assertTrue(escalation.is_active)
        self.assertEqual(escalation.escalated_to, self.other_user)
        self.assertEqual(
            self.ticket.history_entries.filter(action="escalated").count(),
            1,
        )


class FmTicketNotificationIntegrationTests(FmTicketTestDataMixin, APITestCase):
    def setUp(self):
        self.data = self.create_master_data()
        self.tenant = self.data["tenant"]
        self.requester = User.objects.create_user(
            email="fm-requester@example.com",
            password="Password123!",
            tenant=self.tenant,
        )
        self.assignee = User.objects.create_user(
            email="fm-assignee@example.com",
            password="Password123!",
            tenant=self.tenant,
        )
        self.actor = User.objects.create_user(
            email="fm-actor@example.com",
            password="Password123!",
            tenant=self.tenant,
        )
        self.ticket = self._create_ticket()

    def _create_ticket(self, **overrides):
        values = {
            "tenant": self.tenant,
            "organization": self.data["organization"],
            "department": self.data["department"],
            "building": self.data["building"],
            "floor": self.data["floor"],
            "area": self.data["area"],
            "asset": self.data["asset"],
            "requester": self.requester,
            "title": "Lobby aircon issue",
            "description": "The lobby aircon is not cooling.",
            "category": FmTicket.Category.HVAC,
            "priority": FmTicket.Priority.HIGH,
            "source": FmTicket.Source.WEB,
            "status": FmTicket.Status.OPEN,
        }
        values.update(overrides)
        return FmTicket.objects.create(**values)

    def test_assignment_creates_notification_for_changed_eligible_assignee(self):
        assign_ticket(
            ticket=self.ticket,
            assigned_to=self.assignee,
            assigned_by=self.actor,
        )

        notifications = Notification.objects.filter(event_code=ASSIGNMENT_EVENT_CODE)
        self.assertEqual(notifications.count(), 1)
        notification = notifications.get()
        self.assertEqual(notification.recipient, self.assignee)
        self.assertIn(self.ticket.ticket_number, notification.message)
        self.assertIn(self.ticket.title, notification.message)

    def test_assignment_notification_uses_correct_event_code_and_source_fields(self):
        assign_ticket(
            ticket=self.ticket,
            assigned_to=self.assignee,
            assigned_by=self.actor,
        )

        notification = Notification.objects.get(event_code=ASSIGNMENT_EVENT_CODE)
        self.assertEqual(notification.event_code, ASSIGNMENT_EVENT_CODE)
        self.assertEqual(notification.source_module, "fm_tickets")
        self.assertEqual(notification.source_object_id, self.ticket.id)
        self.assertEqual(notification.severity, Notification.Severity.INFO)

    def test_assignment_notification_target_url_points_to_ticket_detail_route(self):
        assign_ticket(
            ticket=self.ticket,
            assigned_to=self.assignee,
            assigned_by=self.actor,
        )

        notification = Notification.objects.get(event_code=ASSIGNMENT_EVENT_CODE)
        self.assertEqual(notification.target_url, f"/fm-tickets/{self.ticket.id}")

    def test_assignment_notification_includes_only_approved_metadata(self):
        assign_ticket(
            ticket=self.ticket,
            assigned_to=self.assignee,
            assigned_by=self.actor,
        )

        notification = Notification.objects.get(event_code=ASSIGNMENT_EVENT_CODE)
        self.assertEqual(
            notification.metadata,
            {
                "ticket_number": self.ticket.ticket_number,
                "event": "assigned",
            },
        )

    def test_same_assignee_reassignment_creates_no_additional_notification(self):
        assign_ticket(
            ticket=self.ticket,
            assigned_to=self.assignee,
            assigned_by=self.actor,
        )
        self.assertEqual(
            Notification.objects.filter(event_code=ASSIGNMENT_EVENT_CODE).count(),
            1,
        )

        assign_ticket(
            ticket=self.ticket,
            assigned_to=self.assignee,
            assigned_by=self.actor,
        )

        self.assertEqual(
            Notification.objects.filter(event_code=ASSIGNMENT_EVENT_CODE).count(),
            1,
        )

    def test_actor_assigned_to_themselves_receives_no_self_notification(self):
        assign_ticket(
            ticket=self.ticket,
            assigned_to=self.actor,
            assigned_by=self.actor,
        )

        self.assertEqual(Notification.objects.count(), 0)

    def test_inactive_assignee_receives_no_notification(self):
        inactive_assignee = User.objects.create_user(
            email="inactive-assignee@example.com",
            password="Password123!",
            tenant=self.tenant,
            is_active=False,
        )

        assign_ticket(
            ticket=self.ticket,
            assigned_to=inactive_assignee,
            assigned_by=self.actor,
        )

        self.assertEqual(Notification.objects.count(), 0)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.assignee, inactive_assignee)

    def test_cross_tenant_recipient_receives_no_tenant_bound_notification(self):
        other_tenant = Tenant.objects.create(name="Other Tenant", code="other-tenant")
        cross_tenant_assignee = User.objects.create_user(
            email="cross-tenant@example.com",
            password="Password123!",
            tenant=other_tenant,
        )

        assign_ticket(
            ticket=self.ticket,
            assigned_to=cross_tenant_assignee,
            assigned_by=self.actor,
        )

        self.assertEqual(Notification.objects.count(), 0)

    def test_global_recipient_receives_no_tenant_bound_notification(self):
        global_assignee = User.objects.create_user(
            email="global-assignee@example.com",
            password="Password123!",
        )

        assign_ticket(
            ticket=self.ticket,
            assigned_to=global_assignee,
            assigned_by=self.actor,
        )

        self.assertEqual(Notification.objects.count(), 0)

    def test_status_change_notifies_eligible_requester(self):
        change_ticket_status(
            ticket=self.ticket,
            to_status=FmTicket.Status.IN_PROGRESS,
            changed_by=self.actor,
        )

        notification = Notification.objects.get(
            event_code=STATUS_CHANGED_EVENT_CODE,
            recipient=self.requester,
        )
        self.assertIn(self.ticket.ticket_number, notification.message)
        self.assertIn("Open", notification.message)
        self.assertIn("In Progress", notification.message)

    def test_status_change_notifies_eligible_assignee(self):
        self.ticket.assignee = self.assignee
        self.ticket.save(update_fields=["assignee"])

        change_ticket_status(
            ticket=self.ticket,
            to_status=FmTicket.Status.IN_PROGRESS,
            changed_by=self.actor,
        )

        self.assertTrue(
            Notification.objects.filter(
                event_code=STATUS_CHANGED_EVENT_CODE,
                recipient=self.assignee,
            ).exists()
        )

    def test_status_change_excludes_actor_from_notifications(self):
        change_ticket_status(
            ticket=self.ticket,
            to_status=FmTicket.Status.IN_PROGRESS,
            changed_by=self.requester,
        )

        self.assertEqual(Notification.objects.count(), 0)

    def test_status_change_deduplicates_requester_and_assignee(self):
        self.ticket.assignee = self.requester
        self.ticket.save(update_fields=["assignee"])

        change_ticket_status(
            ticket=self.ticket,
            to_status=FmTicket.Status.IN_PROGRESS,
            changed_by=self.actor,
        )

        self.assertEqual(
            Notification.objects.filter(event_code=STATUS_CHANGED_EVENT_CODE).count(),
            1,
        )

    def test_no_op_status_change_creates_no_notification(self):
        change_ticket_status(
            ticket=self.ticket,
            to_status=FmTicket.Status.OPEN,
            changed_by=self.actor,
        )

        self.assertEqual(Notification.objects.count(), 0)
        self.assertEqual(self.ticket.status_history_entries.count(), 0)

    def test_resolved_status_uses_success_severity(self):
        change_ticket_status(
            ticket=self.ticket,
            to_status=FmTicket.Status.RESOLVED,
            changed_by=self.actor,
        )

        notification = Notification.objects.get(event_code=STATUS_CHANGED_EVENT_CODE)
        self.assertEqual(notification.severity, Notification.Severity.SUCCESS)

    def test_closed_status_uses_success_severity(self):
        change_ticket_status(
            ticket=self.ticket,
            to_status=FmTicket.Status.CLOSED,
            changed_by=self.actor,
        )

        notification = Notification.objects.get(event_code=STATUS_CHANGED_EVENT_CODE)
        self.assertEqual(notification.severity, Notification.Severity.SUCCESS)

    def test_cancelled_status_uses_warning_severity(self):
        change_ticket_status(
            ticket=self.ticket,
            to_status=FmTicket.Status.CANCELLED,
            changed_by=self.actor,
        )

        notification = Notification.objects.get(event_code=STATUS_CHANGED_EVENT_CODE)
        self.assertEqual(notification.severity, Notification.Severity.WARNING)

    def test_other_status_changes_use_info_severity(self):
        change_ticket_status(
            ticket=self.ticket,
            to_status=FmTicket.Status.IN_PROGRESS,
            changed_by=self.actor,
        )

        notification = Notification.objects.get(event_code=STATUS_CHANGED_EVENT_CODE)
        self.assertEqual(notification.severity, Notification.Severity.INFO)
        self.assertEqual(
            notification.metadata,
            {
                "ticket_number": self.ticket.ticket_number,
                "event": "status_changed",
                "from_status": FmTicket.Status.OPEN,
                "to_status": FmTicket.Status.IN_PROGRESS,
            },
        )

    @patch("apps.fm_tickets.notification_service.create_notification")
    def test_assignment_notification_failure_rolls_back_workflow_state_and_history(
        self,
        mock_create_notification,
    ):
        mock_create_notification.side_effect = ValidationError("Notification write failed.")

        with self.assertRaises(ValidationError):
            assign_ticket(
                ticket=self.ticket,
                assigned_to=self.assignee,
                assigned_by=self.actor,
            )

        self.ticket.refresh_from_db()
        self.assertIsNone(self.ticket.assignee_id)
        self.assertEqual(self.ticket.status, FmTicket.Status.OPEN)
        self.assertEqual(
            self.ticket.history_entries.filter(action="assigned").count(),
            0,
        )
        self.assertEqual(self.ticket.status_history_entries.count(), 0)

    @patch("apps.fm_tickets.notification_service.create_notification")
    def test_status_notification_failure_rolls_back_workflow_state_and_history(
        self,
        mock_create_notification,
    ):
        mock_create_notification.side_effect = ValidationError("Notification write failed.")

        with self.assertRaises(ValidationError):
            change_ticket_status(
                ticket=self.ticket,
                to_status=FmTicket.Status.IN_PROGRESS,
                changed_by=self.actor,
            )

        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, FmTicket.Status.OPEN)
        self.assertEqual(
            self.ticket.history_entries.filter(action="status_changed").count(),
            0,
        )
        self.assertEqual(self.ticket.status_history_entries.count(), 0)


class FmTicketSeedCommandTests(FmTicketTestDataMixin, APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="seed-user@example.com",
            password="Password123!",
        )
        self.other_user = User.objects.create_user(
            email="seed-user-2@example.com",
            password="Password123!",
        )
        call_command("seed_master_data")

    def test_seed_command_is_idempotent(self):
        call_command("seed_fm_tickets")
        call_command("seed_fm_tickets")

        self.assertEqual(FmTicket.objects.count(), 2)
        self.assertGreaterEqual(FmTicketComment.objects.count(), 2)
        self.assertGreaterEqual(FmTicketHistory.objects.count(), 4)
        self.assertGreaterEqual(FmTicketEscalation.objects.count(), 1)


class SeedRbacCommandTests(APITestCase):
    def test_seed_rbac_remains_idempotent(self):
        call_command("seed_rbac")
        call_command("seed_rbac")

        self.assertEqual(Permission.objects.filter(code="fm_tickets.manage").count(), 1)
        self.assertEqual(Role.objects.filter(code="system_admin").count(), 1)


class FmTicketGenerateWorkOrderTests(FmTicketTestDataMixin, APITestCase):
    def setUp(self):
        self.data = self.create_master_data()
        self.tenant = self.data["tenant"]
        self.coordinator = User.objects.create_user(
            email="coordinator@example.com",
            password="Password123!",
            tenant=self.tenant,
        )
        self.technician = User.objects.create_user(
            email="technician@example.com",
            password="Password123!",
            tenant=self.tenant,
        )
        self.requester = User.objects.create_user(
            email="ticket-requester@example.com",
            password="Password123!",
            tenant=self.tenant,
        )
        self.create_ticket_permissions()
        self.assign_permissions(
            self.coordinator,
            "fm_tickets.view",
            "fm_tickets.create",
            "fm_tickets.update",
            "fm_tickets.assign",
            "fm_tickets.close",
            "fm_tickets.manage",
        )
        self.assign_permissions(self.requester, "fm_tickets.view", "fm_tickets.create")
        self.assign_permissions(self.technician, "fm_tickets.view")

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
            title="Cooling unit failed",
            description="HVAC unit requires maintenance execution.",
            category=FmTicket.Category.HVAC,
            priority=FmTicket.Priority.URGENT,
            status=FmTicket.Status.ASSIGNED,
            source=FmTicket.Source.ADMIN,
        )
        self.generate_url = reverse(
            "fm-ticket-generate-work-order",
            args=[self.ticket.id],
        )

    def test_eligible_ticket_generates_one_work_order(self):
        from apps.maintenance.models import MaintenanceWorkOrder

        self.client.force_authenticate(user=self.coordinator)
        response = self.client.post(self.generate_url, {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], self.ticket.title)
        self.assertEqual(response.data["status"], MaintenanceWorkOrder.Status.ASSIGNED)
        self.assertEqual(response.data["source_ticket_id"], str(self.ticket.id))
        self.assertTrue(response.data["work_order_number"].startswith("MWO-"))

        work_order = MaintenanceWorkOrder.objects.get(id=response.data["id"])
        self.assertEqual(work_order.source_ticket_id, self.ticket.id)
        self.assertEqual(work_order.tenant_id, self.ticket.tenant_id)
        self.assertEqual(work_order.asset_id, self.ticket.asset_id)
        self.assertEqual(work_order.assignee_id, self.technician.id)
        self.assertEqual(work_order.requester_id, self.requester.id)
        self.assertEqual(work_order.priority, MaintenanceWorkOrder.Priority.CRITICAL)
        self.assertEqual(str(work_order.created_by), str(self.coordinator.id))
        self.assertEqual(str(work_order.updated_by), str(self.coordinator.id))
        self.assertEqual(self.ticket.maintenance_work_order.id, work_order.id)
        self.assertEqual(
            self.ticket.history_entries.filter(action="work_order_generated").count(),
            1,
        )
        self.assertTrue(work_order.history_entries.filter(action="created").exists())
        self.assertTrue(
            work_order.history_entries.filter(action="generated_from_ticket").exists()
        )
        self.assertEqual(work_order.status_history_entries.count(), 1)

    def test_ticket_create_and_assignment_do_not_auto_generate_work_order(self):
        from apps.maintenance.models import MaintenanceWorkOrder

        self.client.force_authenticate(user=self.coordinator)
        create_response = self.client.post(
            reverse("fm-ticket-list"),
            self.create_ticket_payload(self.data),
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        created_ticket = FmTicket.objects.get(id=create_response.data["id"])
        self.assertEqual(MaintenanceWorkOrder.objects.count(), 0)

        assign_ticket(
            ticket=created_ticket,
            assigned_to=self.technician,
            assigned_by=self.coordinator,
        )
        self.assertEqual(MaintenanceWorkOrder.objects.count(), 0)

    def test_generate_requires_authentication(self):
        response = self.client.post(self.generate_url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unauthorized_requester_cannot_generate(self):
        self.client.force_authenticate(user=self.requester)
        response = self.client.post(self.generate_url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_technician_without_assign_cannot_generate(self):
        self.client.force_authenticate(user=self.technician)
        response = self.client.post(self.generate_url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cross_tenant_ticket_returns_generic_404(self):
        other_tenant = Tenant.objects.create(name="Other", code="other-tenant")
        other_user = User.objects.create_user(
            email="other-coordinator@example.com",
            password="Password123!",
            tenant=other_tenant,
        )
        self.assign_permissions(
            other_user,
            "fm_tickets.view",
            "fm_tickets.assign",
            "fm_tickets.manage",
        )
        self.client.force_authenticate(user=other_user)
        response = self.client.post(self.generate_url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_inactive_and_cross_tenant_assignee_rejected(self):
        from apps.maintenance.models import MaintenanceWorkOrder

        self.technician.is_active = False
        self.technician.save(update_fields=["is_active"])
        self.client.force_authenticate(user=self.coordinator)
        inactive_response = self.client.post(self.generate_url, {}, format="json")
        self.assertEqual(inactive_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MaintenanceWorkOrder.objects.count(), 0)

        self.technician.is_active = True
        self.technician.tenant = None
        self.technician.save(update_fields=["is_active", "tenant"])
        global_response = self.client.post(self.generate_url, {}, format="json")
        self.assertEqual(global_response.status_code, status.HTTP_400_BAD_REQUEST)

        other_tenant = Tenant.objects.create(name="Assignee Tenant", code="assignee-t")
        self.technician.tenant = other_tenant
        self.technician.save(update_fields=["tenant"])
        cross_response = self.client.post(self.generate_url, {}, format="json")
        self.assertEqual(cross_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unassigned_and_invalid_status_rejected(self):
        self.ticket.assignee = None
        self.ticket.save(update_fields=["assignee"])
        self.client.force_authenticate(user=self.coordinator)
        unassigned_response = self.client.post(self.generate_url, {}, format="json")
        self.assertEqual(unassigned_response.status_code, status.HTTP_400_BAD_REQUEST)

        self.ticket.assignee = self.technician
        self.ticket.status = FmTicket.Status.OPEN
        self.ticket.save(update_fields=["assignee", "status"])
        open_response = self.client.post(self.generate_url, {}, format="json")
        self.assertEqual(open_response.status_code, status.HTTP_400_BAD_REQUEST)

        for invalid_status in (
            FmTicket.Status.DRAFT,
            FmTicket.Status.RESOLVED,
            FmTicket.Status.CLOSED,
            FmTicket.Status.CANCELLED,
        ):
            self.ticket.status = invalid_status
            self.ticket.save(update_fields=["status"])
            response = self.client.post(self.generate_url, {}, format="json")
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_asset_rejected(self):
        self.ticket.asset = None
        self.ticket.save(update_fields=["asset"])
        self.client.force_authenticate(user=self.coordinator)
        response = self.client.post(self.generate_url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("asset", response.data)

    def test_deleted_ticket_returns_404(self):
        self.ticket.is_deleted = True
        self.ticket.save(update_fields=["is_deleted"])
        self.client.force_authenticate(user=self.coordinator)
        response = self.client.post(self.generate_url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_second_generation_returns_409(self):
        from apps.maintenance.models import MaintenanceWorkOrder

        self.client.force_authenticate(user=self.coordinator)
        first = self.client.post(self.generate_url, {}, format="json")
        second = self.client.post(self.generate_url, {}, format="json")

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(MaintenanceWorkOrder.objects.count(), 1)

    def test_detail_exposes_linked_work_order_summary(self):
        self.client.force_authenticate(user=self.coordinator)
        generate_response = self.client.post(self.generate_url, {}, format="json")
        detail_response = self.client.get(
            reverse("fm-ticket-detail", args=[self.ticket.id])
        )

        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            detail_response.data["linked_work_order"]["id"],
            generate_response.data["id"],
        )
        self.assertEqual(
            detail_response.data["linked_work_order"]["work_order_number"],
            generate_response.data["work_order_number"],
        )

    @patch("apps.fm_tickets.work_order_service.record_ticket_history")
    def test_ticket_history_failure_rolls_back_work_order(self, mock_history):
        from apps.maintenance.models import MaintenanceWorkOrder

        mock_history.side_effect = DjangoValidationError("history failed")
        self.client.force_authenticate(user=self.coordinator)
        with self.assertRaises(DjangoValidationError):
            from apps.fm_tickets.work_order_service import generate_work_order_from_ticket

            generate_work_order_from_ticket(
                ticket=self.ticket,
                generated_by=self.coordinator,
            )

        self.assertEqual(MaintenanceWorkOrder.objects.count(), 0)
        self.assertEqual(
            self.ticket.history_entries.filter(action="work_order_generated").count(),
            0,
        )

    @patch("apps.fm_tickets.work_order_service.create_work_order")
    def test_work_order_failure_rolls_back_ticket_history(self, mock_create):
        mock_create.side_effect = DjangoValidationError("create failed")
        self.client.force_authenticate(user=self.coordinator)

        with self.assertRaises(DjangoValidationError):
            from apps.fm_tickets.work_order_service import generate_work_order_from_ticket

            generate_work_order_from_ticket(
                ticket=self.ticket,
                generated_by=self.coordinator,
            )

        self.assertEqual(
            self.ticket.history_entries.filter(action="work_order_generated").count(),
            0,
        )

