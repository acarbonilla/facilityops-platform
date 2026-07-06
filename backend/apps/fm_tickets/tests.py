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

from .models import (
    FmTicket,
    FmTicketComment,
    FmTicketEscalation,
    FmTicketHistory,
    FmTicketStatusHistory,
)


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
