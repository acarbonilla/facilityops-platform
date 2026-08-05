"""FO-096 focused employee intake foundation tests."""

from django.contrib.auth import get_user_model
from django.core.management import call_command
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

from .models import FmTicket


User = get_user_model()


class Fo096EmployeeIntakeFoundationTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.tenant = Tenant.objects.create(name="FO096 Tenant", code="fo096-tenant")
        cls.organization = Organization.objects.create(
            tenant=cls.tenant,
            name="FO096 Org",
            code="fo096-org",
        )
        cls.other_tenant = Tenant.objects.create(name="FO096 Other", code="fo096-other")
        cls.other_organization = Organization.objects.create(
            tenant=cls.other_tenant,
            name="FO096 Other Org",
            code="fo096-other-org",
        )
        cls.building = Building.objects.create(
            tenant=cls.tenant,
            organization=cls.organization,
            name="HQ",
            code="fo096-hq",
        )
        cls.floor = Floor.objects.create(
            tenant=cls.tenant,
            building=cls.building,
            name="1",
            code="fo096-f1",
        )
        cls.area = Area.objects.create(
            tenant=cls.tenant,
            building=cls.building,
            floor=cls.floor,
            name="Lobby",
            code="fo096-a1",
        )
        asset_type = AssetType.objects.create(
            tenant=cls.tenant,
            name="Generic",
            code="fo096-at",
        )
        cls.asset = Asset.objects.create(
            tenant=cls.tenant,
            organization=cls.organization,
            building=cls.building,
            floor=cls.floor,
            area=cls.area,
            asset_type=asset_type,
            name="Pump",
            code="fo096-asset",
        )

        employee_role = Role.objects.get(code="employee")
        fm_role = Role.objects.get(code="facility_manager")

        cls.employee = User.objects.create_user(
            email="fo096-employee@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.organization,
            first_name="Emp",
            last_name="Loyee",
        )
        UserRole.objects.create(user=cls.employee, role=employee_role)

        cls.other_employee = User.objects.create_user(
            email="fo096-other-employee@example.com",
            password="Password123!",
            tenant=cls.other_tenant,
            organization=cls.other_organization,
        )
        UserRole.objects.create(user=cls.other_employee, role=employee_role)

        cls.facility_manager = User.objects.create_user(
            email="fo096-fm@example.com",
            password="Password123!",
            tenant=cls.tenant,
            organization=cls.organization,
        )
        UserRole.objects.create(user=cls.facility_manager, role=fm_role)

    def _authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_employee_can_create_with_title_only(self):
        self._authenticate(self.employee)
        response = self.client.post(
            reverse("fm-ticket-list"),
            {"title": "Noise in hallway"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ticket = FmTicket.objects.get(id=response.data["id"])
        self.assertEqual(ticket.title, "Noise in hallway")
        self.assertEqual(ticket.description, "")
        self.assertEqual(ticket.category, FmTicket.Category.UNCLASSIFIED)
        self.assertEqual(ticket.priority, FmTicket.Priority.PENDING_REVIEW)
        self.assertIsNone(ticket.building)
        self.assertEqual(ticket.status, FmTicket.Status.OPEN)

    def test_employee_can_create_with_title_and_description(self):
        self._authenticate(self.employee)
        response = self.client.post(
            reverse("fm-ticket-list"),
            {
                "title": "Strange smell",
                "description": "Near loading dock after 5pm",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ticket = FmTicket.objects.get(id=response.data["id"])
        self.assertEqual(ticket.description, "Near loading dock after 5pm")

    def test_employee_create_without_image_succeeds(self):
        self._authenticate(self.employee)
        response = self.client.post(
            reverse("fm-ticket-list"),
            {"title": "Access badge reader issue"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ticket = FmTicket.objects.get(id=response.data["id"])
        self.assertEqual(ticket.category, FmTicket.Category.UNCLASSIFIED)
        self.assertIsNone(ticket.building)

    def test_identity_derived_from_authentication(self):
        self._authenticate(self.employee)
        response = self.client.post(
            reverse("fm-ticket-list"),
            {"title": "Context check"},
            format="json",
        )
        ticket = FmTicket.objects.get(id=response.data["id"])
        self.assertEqual(ticket.requester_id, self.employee.id)
        self.assertEqual(ticket.tenant_id, self.tenant.id)
        self.assertEqual(ticket.organization_id, self.organization.id)

    def test_client_ownership_and_classification_fields_rejected(self):
        self._authenticate(self.employee)
        fields = {
            "requester": str(self.other_employee.id),
            "tenant": str(self.other_tenant.id),
            "organization": str(self.other_organization.id),
            "category": FmTicket.Category.ELECTRICAL,
            "priority": FmTicket.Priority.HIGH,
            "building": str(self.building.id),
            "floor": str(self.floor.id),
            "area": str(self.area.id),
            "asset": str(self.asset.id),
            "assignee": str(self.facility_manager.id),
            "status": FmTicket.Status.ASSIGNED,
        }
        for field, value in fields.items():
            with self.subTest(field=field):
                response = self.client.post(
                    reverse("fm-ticket-list"),
                    {"title": "Spoof attempt", field: value},
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)

    def test_no_default_medium_priority(self):
        self._authenticate(self.employee)
        response = self.client.post(
            reverse("fm-ticket-list"),
            {"title": "Priority check"},
            format="json",
        )
        ticket = FmTicket.objects.get(id=response.data["id"])
        self.assertNotEqual(ticket.priority, FmTicket.Priority.MEDIUM)
        self.assertEqual(ticket.priority, FmTicket.Priority.PENDING_REVIEW)

    def test_empty_title_rejected(self):
        self._authenticate(self.employee)
        response = self.client.post(
            reverse("fm-ticket-list"),
            {"title": "   ", "description": "has text"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.data)

    def test_blank_description_allowed(self):
        self._authenticate(self.employee)
        response = self.client.post(
            reverse("fm-ticket-list"),
            {"title": "Blank description", "description": ""},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            FmTicket.objects.get(id=response.data["id"]).description,
            "",
        )

    def test_my_requests_visibility_for_created_ticket(self):
        self._authenticate(self.employee)
        created = self.client.post(
            reverse("fm-ticket-list"),
            {"title": "Visible to me"},
            format="json",
        )
        ticket_id = created.data["id"]
        listing = self.client.get(reverse("fm-ticket-list"))
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in listing.data["results"]}
        self.assertIn(ticket_id, ids)

        self._authenticate(self.other_employee)
        other_listing = self.client.get(reverse("fm-ticket-list"))
        other_ids = {item["id"] for item in other_listing.data["results"]}
        self.assertNotIn(ticket_id, other_ids)

    def test_audit_history_uses_true_requester(self):
        self._authenticate(self.employee)
        response = self.client.post(
            reverse("fm-ticket-list"),
            {"title": "Audit check"},
            format="json",
        )
        ticket = FmTicket.objects.get(id=response.data["id"])
        history = ticket.history_entries.first()
        self.assertIsNotNone(history)
        self.assertEqual(history.actor_id, self.employee.id)

    def test_internal_fm_create_still_requires_classification(self):
        self._authenticate(self.facility_manager)
        response = self.client.post(
            reverse("fm-ticket-list"),
            {
                "organization": str(self.organization.id),
                "building": str(self.building.id),
                "title": "FM classified ticket",
                "description": "Operational create path",
                "category": FmTicket.Category.HVAC,
                "priority": FmTicket.Priority.HIGH,
                "source": FmTicket.Source.WEB,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ticket = FmTicket.objects.get(id=response.data["id"])
        self.assertEqual(ticket.category, FmTicket.Category.HVAC)
        self.assertEqual(ticket.priority, FmTicket.Priority.HIGH)
        self.assertEqual(ticket.building_id, self.building.id)
        self.assertEqual(ticket.requester_id, self.facility_manager.id)

    def test_no_work_order_on_employee_create_and_notifications_allowed(self):
        """FO-099 intentionally notifies on create; WO must still not auto-create."""
        self._authenticate(self.employee)
        before_wo = MaintenanceWorkOrder.objects.count()
        before_n = Notification.objects.count()
        response = self.client.post(
            reverse("fm-ticket-list"),
            {"title": "No side effects"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MaintenanceWorkOrder.objects.count(), before_wo)
        self.assertGreater(Notification.objects.count(), before_n)
