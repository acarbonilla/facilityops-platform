from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.management.commands.seed_rbac import ROLE_PERMISSION_CODES
from apps.access_control.models import Permission, Role, RolePermission, UserRole
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

from .models import FmTicket, FmTicketComment, FmTicketHistory


User = get_user_model()


class EmployeeRoleSeedTests(APITestCase):
    def test_seed_reconciles_employee_role_and_preserves_viewer(self):
        call_command("seed_rbac")
        employee = Role.objects.get(code="employee")
        viewer = Role.objects.get(code="viewer")
        viewer_permissions = set(
            RolePermission.objects.filter(
                role=viewer,
                is_active=True,
                permission__is_active=True,
            ).values_list("permission__code", flat=True)
        )

        unexpected_permission = Permission.objects.get(code="reporting.view")
        RolePermission.objects.update_or_create(
            role=employee,
            permission=unexpected_permission,
            defaults={"is_active": True},
        )
        call_command("seed_rbac")

        employee.refresh_from_db()
        self.assertEqual(employee.name, "Employee")
        self.assertTrue(employee.is_active)
        self.assertTrue(employee.is_system_role)
        employee_permissions = set(
            RolePermission.objects.filter(
                role=employee,
                is_active=True,
                permission__is_active=True,
            ).values_list("permission__code", flat=True)
        )
        self.assertEqual(
            employee_permissions,
            {"fm_tickets.view", "fm_tickets.create"},
        )
        self.assertEqual(
            employee_permissions,
            ROLE_PERMISSION_CODES["employee"],
        )
        self.assertEqual(
            set(
                RolePermission.objects.filter(
                    role=viewer,
                    is_active=True,
                    permission__is_active=True,
                ).values_list("permission__code", flat=True)
            ),
            viewer_permissions,
        )
        self.assertFalse(
            RolePermission.objects.get(
                role=employee,
                permission=unexpected_permission,
            ).is_active
        )


class EmployeeRequesterAuthorizationTests(APITestCase):
    maxDiff = None

    @classmethod
    def setUpTestData(cls):
        call_command("seed_rbac")
        cls.data_a = cls._create_master_data("a")
        cls.data_b = cls._create_master_data("b")

        cls.employee_a = cls._create_user(
            "employee-a@example.com",
            cls.data_a,
            "employee",
        )
        cls.employee_other = cls._create_user(
            "employee-other@example.com",
            cls.data_a,
            "employee",
        )
        cls.employee_b = cls._create_user(
            "employee-b@example.com",
            cls.data_b,
            "employee",
        )
        cls.facility_manager = cls._create_user(
            "manager@example.com",
            cls.data_a,
            "facility_manager",
        )
        cls.technician = cls._create_user(
            "technician@example.com",
            cls.data_a,
            "technician",
        )
        cls.viewer = cls._create_user(
            "viewer@example.com",
            cls.data_a,
            "viewer",
        )
        cls.system_admin = cls._create_user(
            "system@example.com",
            None,
            "system_admin",
        )
        cls.staff_employee = cls._create_user(
            "staff-employee@example.com",
            cls.data_a,
            "employee",
            is_staff=True,
        )

        cls.own_ticket = cls._create_ticket(
            cls.data_a,
            cls.employee_a,
            "Employee A request",
        )
        cls.same_tenant_ticket = cls._create_ticket(
            cls.data_a,
            cls.employee_other,
            "Other employee request",
        )
        cls.cross_tenant_ticket = cls._create_ticket(
            cls.data_b,
            cls.employee_b,
            "Tenant B request",
        )
        cls.staff_own_ticket = cls._create_ticket(
            cls.data_a,
            cls.staff_employee,
            "Staff Employee request",
        )
        cls.deleted_ticket = cls._create_ticket(
            cls.data_a,
            cls.employee_a,
            "Deleted request",
        )
        cls.deleted_ticket.is_deleted = True
        cls.deleted_ticket.save(update_fields=("is_deleted", "updated_at"))

    @classmethod
    def _create_master_data(cls, suffix):
        tenant = Tenant.objects.create(
            name=f"Tenant {suffix.upper()}",
            code=f"employee-tenant-{suffix}",
        )
        organization = Organization.objects.create(
            tenant=tenant,
            name=f"Organization {suffix.upper()}",
            code=f"employee-organization-{suffix}",
        )
        building = Building.objects.create(
            tenant=tenant,
            organization=organization,
            name=f"Building {suffix.upper()}",
            code=f"employee-building-{suffix}",
        )
        floor = Floor.objects.create(
            tenant=tenant,
            building=building,
            name=f"Floor {suffix.upper()}",
            code=f"employee-floor-{suffix}",
            level_number=1,
        )
        area = Area.objects.create(
            tenant=tenant,
            building=building,
            floor=floor,
            name=f"Area {suffix.upper()}",
            code=f"employee-area-{suffix}",
        )
        asset_type = AssetType.objects.create(
            tenant=tenant,
            name=f"Asset Type {suffix.upper()}",
            code=f"employee-asset-type-{suffix}",
        )
        asset = Asset.objects.create(
            tenant=tenant,
            organization=organization,
            building=building,
            floor=floor,
            area=area,
            asset_type=asset_type,
            name=f"Asset {suffix.upper()}",
            code=f"employee-asset-{suffix}",
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

    @classmethod
    def _create_ticket(cls, data, requester, title):
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
            priority=FmTicket.Priority.HIGH,
            status=FmTicket.Status.OPEN,
            source=FmTicket.Source.WEB,
        )

    def _authenticate(self, user):
        self.client.force_authenticate(user)

    def _list_ids(self, response):
        return {str(item["id"]) for item in response.data["results"]}

    def _valid_create_payload(self):
        return {
            "title": "Employee request",
            "description": "Employee-created facility request.",
            "category": FmTicket.Category.HVAC,
            "building": str(self.data_a["building"].id),
            "floor": str(self.data_a["floor"].id),
            "area": str(self.data_a["area"].id),
            "asset": str(self.data_a["asset"].id),
        }

    def test_employee_list_is_requester_owned_and_soft_deleted_rows_stay_hidden(self):
        self._authenticate(self.employee_a)
        response = self.client.get(reverse("fm-ticket-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._list_ids(response), {str(self.own_ticket.id)})

    def test_employee_filters_cannot_broaden_requester_scope(self):
        self._authenticate(self.employee_a)
        for params in (
            {"requester": str(self.employee_other.id)},
            {"tenant": str(self.data_b["tenant"].id)},
            {"organization": str(self.data_b["organization"].id)},
        ):
            with self.subTest(params=params):
                response = self.client.get(reverse("fm-ticket-list"), params)
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data["count"], 0)

    def test_employee_non_owned_and_cross_tenant_details_return_generic_404(self):
        self._authenticate(self.employee_a)
        not_found_details = []
        for ticket in (self.same_tenant_ticket, self.cross_tenant_ticket):
            with self.subTest(ticket=ticket.id):
                response = self.client.get(
                    reverse("fm-ticket-detail", args=[ticket.id])
                )
                self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
                not_found_details.append(str(response.data["detail"]))
        self.assertEqual(not_found_details[0], not_found_details[1])
        self.assertNotIn(str(self.same_tenant_ticket.id), not_found_details[0])
        self.assertNotIn(str(self.cross_tenant_ticket.id), not_found_details[1])

    def test_employee_list_and_detail_use_requester_safe_fields(self):
        self._authenticate(self.employee_a)
        list_response = self.client.get(reverse("fm-ticket-list"))
        detail_response = self.client.get(
            reverse("fm-ticket-detail", args=[self.own_ticket.id])
        )

        safe_list_fields = {
            "id",
            "ticket_number",
            "organization",
            "organization_name",
            "building",
            "building_name",
            "floor",
            "floor_name",
            "area",
            "area_name",
            "asset",
            "asset_name",
            "title",
            "category",
            "priority",
            "status",
            "reported_at",
        }
        self.assertEqual(
            set(list_response.data["results"][0]),
            safe_list_fields,
        )
        self.assertEqual(
            set(detail_response.data),
            safe_list_fields
            | {
                "description",
                "resolved_at",
                "closed_at",
                "created_at",
                "updated_at",
            },
        )
        for unsafe_field in (
            "requester",
            "requester_email",
            "assignee",
            "assignee_email",
            "sla",
            "escalation_history",
            "linked_work_order",
            "due_at",
            "tenant",
        ):
            self.assertNotIn(unsafe_field, detail_response.data)

    def test_employee_raw_comments_history_and_escalations_fail_closed(self):
        FmTicketComment.objects.create(
            ticket=self.own_ticket,
            author=self.facility_manager,
            body="Internal operational note.",
            is_internal=True,
        )
        FmTicketHistory.objects.create(
            ticket=self.own_ticket,
            actor=self.facility_manager,
            action="internal",
            description="Internal history.",
            metadata={"secret": "not requester safe"},
        )
        self._authenticate(self.employee_a)

        for route_name in (
            "fm-ticket-comments",
            "fm-ticket-history",
            "fm-ticket-escalations",
        ):
            with self.subTest(route_name=route_name):
                response = self.client.get(
                    reverse(route_name, args=[self.own_ticket.id])
                )
                self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_existing_operational_role_visibility_is_preserved(self):
        for user in (self.facility_manager, self.technician, self.viewer):
            with self.subTest(user=user.email):
                self._authenticate(user)
                response = self.client.get(reverse("fm-ticket-list"))
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(
                    self._list_ids(response),
                    {
                        str(self.own_ticket.id),
                        str(self.same_tenant_ticket.id),
                        str(self.staff_own_ticket.id),
                    },
                )

    def test_global_administrator_visibility_is_preserved(self):
        self._authenticate(self.system_admin)
        response = self.client.get(reverse("fm-ticket-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            self._list_ids(response),
            {
                str(self.own_ticket.id),
                str(self.same_tenant_ticket.id),
                str(self.cross_tenant_ticket.id),
                str(self.staff_own_ticket.id),
            },
        )

    def test_staff_flag_does_not_broaden_employee_scope(self):
        self._authenticate(self.staff_employee)
        response = self.client.get(reverse("fm-ticket-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._list_ids(response), {str(self.staff_own_ticket.id)})

    def test_employee_with_broader_view_role_receives_existing_tenant_scope(self):
        UserRole.objects.create(
            user=self.employee_a,
            role=Role.objects.get(code="viewer"),
        )
        self._authenticate(self.employee_a)
        response = self.client.get(reverse("fm-ticket-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(str(self.same_tenant_ticket.id), self._list_ids(response))

    def test_tenantless_and_organizationless_employees_fail_closed(self):
        tenantless = self._create_user(
            "tenantless-employee@example.com",
            None,
            "employee",
        )
        organizationless = User.objects.create_user(
            email="organizationless-employee@example.com",
            password="Password123!",
            tenant=self.data_a["tenant"],
        )
        UserRole.objects.create(
            user=organizationless,
            role=Role.objects.get(code="employee"),
        )

        for user in (tenantless, organizationless):
            with self.subTest(user=user.email):
                self._authenticate(user)
                response = self.client.get(reverse("fm-ticket-list"))
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data["count"], 0)
                options = self.client.get(reverse("fm-ticket-request-options"))
                self.assertEqual(options.status_code, status.HTTP_404_NOT_FOUND)

    def test_inactive_user_or_employee_assignment_has_no_access(self):
        inactive_user = self._create_user(
            "inactive-employee@example.com",
            self.data_a,
            "employee",
            is_active=False,
        )
        inactive_assignment = self._create_user(
            "inactive-assignment@example.com",
            self.data_a,
            "employee",
        )
        UserRole.objects.filter(
            user=inactive_assignment,
            role__code="employee",
        ).update(is_active=False)

        for user in (inactive_user, inactive_assignment):
            with self.subTest(user=user.email):
                self._authenticate(user)
                response = self.client.get(reverse("fm-ticket-list"))
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_inactive_employee_role_has_no_access(self):
        Role.objects.filter(code="employee").update(is_active=False)
        self._authenticate(self.employee_a)

        response = self.client.get(reverse("fm-ticket-list"))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_inactive_or_deleted_employee_identity_scope_fails_closed(self):
        for model, field in (
            (self.data_a["tenant"], "is_active"),
            (self.data_a["tenant"], "is_deleted"),
            (self.data_a["organization"], "is_active"),
            (self.data_a["organization"], "is_deleted"),
        ):
            with self.subTest(model=model.__class__.__name__, field=field):
                original = getattr(model, field)
                setattr(model, field, False if field == "is_active" else True)
                model.save(update_fields=(field, "updated_at"))
                self._authenticate(User.objects.get(pk=self.employee_a.pk))
                response = self.client.get(reverse("fm-ticket-list"))
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data["count"], 0)
                setattr(model, field, original)
                model.save(update_fields=(field, "updated_at"))

    def test_employee_creation_binds_identity_and_safe_defaults(self):
        self._authenticate(self.employee_a)
        response = self.client.post(
            reverse("fm-ticket-list"),
            self._valid_create_payload(),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ticket = FmTicket.objects.get(id=response.data["id"])
        self.assertEqual(ticket.requester, self.employee_a)
        self.assertEqual(ticket.tenant, self.data_a["tenant"])
        self.assertEqual(ticket.organization, self.data_a["organization"])
        self.assertIsNone(ticket.department)
        self.assertEqual(ticket.source, FmTicket.Source.WEB)
        self.assertEqual(ticket.priority, FmTicket.Priority.MEDIUM)
        self.assertEqual(ticket.status, FmTicket.Status.OPEN)
        self.assertEqual(ticket.history_entries.count(), 1)
        self.assertEqual(ticket.status_history_entries.count(), 1)
        self.assertEqual(Notification.objects.filter(source_object_id=ticket.id).count(), 0)
        self.assertFalse(
            MaintenanceWorkOrder.objects.filter(source_ticket=ticket).exists()
        )
        self.assertNotIn("requester", response.data)
        self.assertNotIn("sla", response.data)

        minimal_response = self.client.post(
            reverse("fm-ticket-list"),
            {
                "title": "Minimal Employee request",
                "description": "Optional location fields are omitted.",
                "category": FmTicket.Category.OTHER,
                "building": str(self.data_a["building"].id),
            },
            format="json",
        )
        self.assertEqual(minimal_response.status_code, status.HTTP_201_CREATED)
        minimal_ticket = FmTicket.objects.get(id=minimal_response.data["id"])
        self.assertIsNone(minimal_ticket.floor)
        self.assertIsNone(minimal_ticket.area)
        self.assertIsNone(minimal_ticket.asset)

    def test_employee_creation_rejects_all_protected_overrides_without_side_effects(self):
        self._authenticate(self.employee_a)
        protected_values = {
            "requester": str(self.employee_other.id),
            "tenant": str(self.data_b["tenant"].id),
            "organization": str(self.data_b["organization"].id),
            "department": None,
            "source": FmTicket.Source.ADMIN,
            "priority": FmTicket.Priority.URGENT,
            "status": FmTicket.Status.CLOSED,
            "assignee": str(self.technician.id),
            "due_at": "2030-01-01T00:00:00Z",
            "response_due_at": "2030-01-01T00:00:00Z",
            "resolution_due_at": "2030-01-02T00:00:00Z",
            "first_responded_at": "2030-01-01T00:00:00Z",
            "response_met": True,
            "resolution_met": True,
            "resolved_at": "2030-01-01T00:00:00Z",
            "closed_at": "2030-01-02T00:00:00Z",
        }
        baseline = {
            "tickets": FmTicket.objects.count(),
            "history": FmTicketHistory.objects.count(),
            "notifications": Notification.objects.count(),
            "work_orders": MaintenanceWorkOrder.objects.count(),
        }

        for field, value in protected_values.items():
            with self.subTest(field=field):
                response = self.client.post(
                    reverse("fm-ticket-list"),
                    {**self._valid_create_payload(), field: value},
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)

        self.assertEqual(FmTicket.objects.count(), baseline["tickets"])
        self.assertEqual(FmTicketHistory.objects.count(), baseline["history"])
        self.assertEqual(Notification.objects.count(), baseline["notifications"])
        self.assertEqual(
            MaintenanceWorkOrder.objects.count(),
            baseline["work_orders"],
        )

    def test_employee_creation_rejects_cross_scope_and_invalid_hierarchy(self):
        self._authenticate(self.employee_a)
        cross_scope = self.client.post(
            reverse("fm-ticket-list"),
            {
                **self._valid_create_payload(),
                "building": str(self.data_b["building"].id),
                "floor": str(self.data_b["floor"].id),
                "area": str(self.data_b["area"].id),
                "asset": str(self.data_b["asset"].id),
            },
            format="json",
        )
        self.assertEqual(cross_scope.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("building", cross_scope.data)

        alternate_building = Building.objects.create(
            tenant=self.data_a["tenant"],
            organization=self.data_a["organization"],
            name="Alternate Building",
            code="employee-alternate-building",
        )
        invalid_hierarchy = self.client.post(
            reverse("fm-ticket-list"),
            {
                **self._valid_create_payload(),
                "building": str(alternate_building.id),
            },
            format="json",
        )
        self.assertEqual(
            invalid_hierarchy.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertIn("floor", invalid_hierarchy.data)

    def test_employee_creation_rejects_inactive_and_deleted_options(self):
        self._authenticate(self.employee_a)

        for option_name in ("building", "floor", "area", "asset"):
            option = self.data_a[option_name]
            for field, value in (("is_active", False), ("is_deleted", True)):
                with self.subTest(option=option_name, field=field):
                    original = getattr(option, field)
                    setattr(option, field, value)
                    option.save(update_fields=(field, "updated_at"))
                    response = self.client.post(
                        reverse("fm-ticket-list"),
                        self._valid_create_payload(),
                        format="json",
                    )
                    self.assertEqual(
                        response.status_code,
                        status.HTTP_400_BAD_REQUEST,
                    )
                    self.assertIn(option_name, response.data)
                    setattr(option, field, original)
                    option.save(update_fields=(field, "updated_at"))

    def test_request_options_are_minimal_and_account_scoped(self):
        inactive_building = Building.objects.create(
            tenant=self.data_a["tenant"],
            organization=self.data_a["organization"],
            name="Inactive Building",
            code="employee-inactive-building",
            is_active=False,
        )
        self._authenticate(self.employee_a)
        response = self.client.get(reverse("fm-ticket-request-options"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data),
            {
                "organization",
                "buildings",
                "floors",
                "areas",
                "assets",
                "categories",
            },
        )
        self.assertEqual(
            response.data["organization"],
            {
                "id": str(self.data_a["organization"].id),
                "name": self.data_a["organization"].name,
            },
        )
        self.assertEqual(
            {item["id"] for item in response.data["buildings"]},
            {str(self.data_a["building"].id)},
        )
        self.assertNotIn(
            str(inactive_building.id),
            {item["id"] for item in response.data["buildings"]},
        )
        self.assertNotIn(
            str(self.data_b["building"].id),
            {item["id"] for item in response.data["buildings"]},
        )
        self.assertEqual(set(response.data["buildings"][0]), {"id", "name"})
        self.assertEqual(
            set(response.data["floors"][0]),
            {"id", "name", "building_id"},
        )
        self.assertEqual(
            set(response.data["areas"][0]),
            {"id", "name", "building_id", "floor_id"},
        )
        self.assertEqual(
            set(response.data["assets"][0]),
            {"id", "name", "building_id", "floor_id", "area_id"},
        )
        self.assertEqual(
            {item["value"] for item in response.data["categories"]},
            {value for value, _label in FmTicket.Category.choices},
        )

    def test_request_options_reject_scope_overrides_and_operational_consumers(self):
        self._authenticate(self.employee_a)
        for parameter in ("tenant", "organization"):
            with self.subTest(parameter=parameter):
                response = self.client.get(
                    reverse("fm-ticket-request-options"),
                    {parameter: str(self.data_b["tenant"].id)},
                )
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("scope", response.data)

        self._authenticate(self.facility_manager)
        response = self.client.get(reverse("fm-ticket-request-options"))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_employee_has_no_operational_or_work_order_authority(self):
        self._authenticate(self.employee_a)
        for route_name, payload in (
            (
                "fm-ticket-assign",
                {"assignee": str(self.technician.id)},
            ),
            ("fm-ticket-generate-work-order", {}),
            (
                "fm-ticket-change-status",
                {"status": FmTicket.Status.CLOSED},
            ),
        ):
            with self.subTest(route_name=route_name):
                response = self.client.post(
                    reverse(route_name, args=[self.own_ticket.id]),
                    payload,
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.assertFalse(
            MaintenanceWorkOrder.objects.filter(
                source_ticket=self.own_ticket
            ).exists()
        )
