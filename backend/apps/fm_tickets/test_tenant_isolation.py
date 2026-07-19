from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.access_control.models import Role, RolePermission, UserRole
from apps.maintenance.models import MaintenanceWorkOrder
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

from .models import FmTicket, FmTicketComment, FmTicketEscalation, FmTicketHistory
from .tests import FmTicketTestDataMixin


User = get_user_model()


class FmTicketTenantIsolationTests(FmTicketTestDataMixin, APITestCase):
    def setUp(self):
        self.permissions = self.create_ticket_permissions()
        self.data_a = self._create_master_data("a")
        self.data_b = self._create_master_data("b")

        self.manager_a = self._user("manager-a@example.com", self.data_a["tenant"])
        self.manager_b = self._user("manager-b@example.com", self.data_b["tenant"])
        self.viewer_a = self._user("viewer-a@example.com", self.data_a["tenant"])
        self.viewer_b = self._user("viewer-b@example.com", self.data_b["tenant"])
        self.technician_a = self._user(
            "technician-a@example.com",
            self.data_a["tenant"],
        )
        self.technician_b = self._user(
            "technician-b@example.com",
            self.data_b["tenant"],
        )
        self.tenantless = self._user("tenantless@example.com")
        self.staff_only = self._user(
            "staff@example.com",
            self.data_a["tenant"],
            is_staff=True,
        )
        self.system_admin = self._user("system@example.com")
        self.superuser = User.objects.create_superuser(
            email="super@example.com",
            password="Password123!",
        )

        all_permissions = tuple(self.permissions)
        self.assign_permissions(self.manager_a, *all_permissions)
        self.assign_permissions(self.manager_b, *all_permissions)
        self.assign_permissions(self.viewer_a, "fm_tickets.view")
        self.assign_permissions(self.viewer_b, "fm_tickets.view")
        self.assign_permissions(self.tenantless, *all_permissions)
        self.assign_permissions(self.staff_only, "fm_tickets.view")
        self._assign_system_admin(self.system_admin)

        technician_role = Role.objects.create(
            name="Tenant Isolation Technician",
            code="technician",
        )
        UserRole.objects.create(user=self.technician_a, role=technician_role)
        UserRole.objects.create(user=self.technician_b, role=technician_role)

        self.ticket_a = self._create_ticket(
            self.data_a,
            self.manager_a,
            self.technician_a,
            "Tenant A Ticket",
        )
        self.ticket_b = self._create_ticket(
            self.data_b,
            self.manager_b,
            self.technician_b,
            "Tenant B Ticket",
        )
        self.deleted_ticket = self._create_ticket(
            self.data_a,
            self.manager_a,
            self.technician_a,
            "Deleted Tenant A Ticket",
        )
        self.deleted_ticket.is_deleted = True
        self.deleted_ticket.save(update_fields=("is_deleted", "updated_at"))

    def _create_master_data(self, suffix):
        tenant = Tenant.objects.create(
            name=f"Tenant {suffix.upper()}",
            code=f"tenant-{suffix}",
        )
        organization = Organization.objects.create(
            tenant=tenant,
            name=f"Organization {suffix.upper()}",
            code=f"organization-{suffix}",
        )
        department = Department.objects.create(
            tenant=tenant,
            organization=organization,
            name=f"Facilities {suffix.upper()}",
            code=f"facilities-{suffix}",
        )
        building = Building.objects.create(
            tenant=tenant,
            organization=organization,
            name=f"Building {suffix.upper()}",
            code=f"building-{suffix}",
        )
        floor = Floor.objects.create(
            tenant=tenant,
            building=building,
            name=f"Floor {suffix.upper()}",
            code=f"floor-{suffix}",
            level_number=1,
        )
        area = Area.objects.create(
            tenant=tenant,
            building=building,
            floor=floor,
            name=f"Area {suffix.upper()}",
            code=f"area-{suffix}",
        )
        asset_type = AssetType.objects.create(
            tenant=tenant,
            name=f"Asset Type {suffix.upper()}",
            code=f"asset-type-{suffix}",
        )
        asset = Asset.objects.create(
            tenant=tenant,
            organization=organization,
            building=building,
            floor=floor,
            area=area,
            asset_type=asset_type,
            name=f"Asset {suffix.upper()}",
            code=f"asset-{suffix}",
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

    def _user(self, email, tenant=None, **extra):
        return User.objects.create_user(
            email=email,
            password="Password123!",
            tenant=tenant,
            **extra,
        )

    def _assign_system_admin(self, user):
        role = Role.objects.create(
            name="Tenant Isolation System Administrator",
            code="system_admin",
            is_system_role=True,
        )
        for permission in self.permissions.values():
            RolePermission.objects.create(role=role, permission=permission)
        UserRole.objects.create(user=user, role=role)

    def _create_ticket(self, data, requester, assignee, title):
        return FmTicket.objects.create(
            tenant=data["tenant"],
            organization=data["organization"],
            department=data["department"],
            building=data["building"],
            floor=data["floor"],
            area=data["area"],
            asset=data["asset"],
            requester=requester,
            assignee=assignee,
            title=title,
            description=f"{title} description",
            category=FmTicket.Category.OTHER,
            priority=FmTicket.Priority.HIGH,
            status=FmTicket.Status.ASSIGNED,
            source=FmTicket.Source.WEB,
        )

    def _authenticate(self, user):
        self.client.force_authenticate(user=user)

    def _list_ids(self, response):
        return {str(item["id"]) for item in response.data["results"]}

    def test_tenant_viewers_list_only_their_own_tickets(self):
        self._authenticate(self.viewer_a)
        response_a = self.client.get(reverse("fm-ticket-list"))
        self.assertEqual(response_a.status_code, status.HTTP_200_OK)
        self.assertEqual(self._list_ids(response_a), {str(self.ticket_a.id)})

        self._authenticate(self.viewer_b)
        response_b = self.client.get(reverse("fm-ticket-list"))
        self.assertEqual(response_b.status_code, status.HTTP_200_OK)
        self.assertEqual(self._list_ids(response_b), {str(self.ticket_b.id)})

    def test_tenantless_non_global_viewer_fails_closed(self):
        self._authenticate(self.tenantless)
        response = self.client.get(reverse("fm-ticket-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)
        self.assertEqual(
            self.client.get(
                reverse("fm-ticket-detail", args=[self.ticket_a.id])
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_staff_alone_does_not_receive_global_scope(self):
        self._authenticate(self.staff_only)
        response = self.client.get(reverse("fm-ticket-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self._list_ids(response), {str(self.ticket_a.id)})

    def test_system_admin_and_superuser_receive_global_scope(self):
        expected_ids = {str(self.ticket_a.id), str(self.ticket_b.id)}
        for user in (self.system_admin, self.superuser):
            self._authenticate(user)
            response = self.client.get(reverse("fm-ticket-list"))
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(self._list_ids(response), expected_ids)

    def test_global_scope_does_not_bypass_assignment_or_generation_tenant_match(self):
        for user in (self.system_admin, self.superuser):
            self._authenticate(user)
            assignment_response = self.client.post(
                reverse("fm-ticket-assign", args=[self.ticket_a.id]),
                {"assignee": str(self.technician_a.id)},
                format="json",
            )
            generation_response = self.client.post(
                reverse(
                    "fm-ticket-generate-work-order",
                    args=[self.ticket_a.id],
                ),
                {},
                format="json",
            )

            self.assertEqual(
                assignment_response.status_code,
                status.HTTP_404_NOT_FOUND,
            )
            self.assertEqual(
                generation_response.status_code,
                status.HTTP_404_NOT_FOUND,
            )

        self.ticket_a.refresh_from_db()
        self.assertEqual(self.ticket_a.assignee_id, self.technician_a.id)
        self.assertEqual(MaintenanceWorkOrder.objects.count(), 0)

    def test_deleted_tickets_are_excluded_from_list_and_detail(self):
        self._authenticate(self.manager_a)
        response = self.client.get(reverse("fm-ticket-list"))
        self.assertNotIn(str(self.deleted_ticket.id), self._list_ids(response))
        detail = self.client.get(
            reverse("fm-ticket-detail", args=[self.deleted_ticket.id])
        )
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_client_tenant_filter_cannot_broaden_scope(self):
        self._authenticate(self.viewer_a)
        response = self.client.get(
            reverse("fm-ticket-list"),
            {"tenant": str(self.data_b["tenant"].id)},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_cross_tenant_detail_actions_return_404_without_mutation(self):
        self._authenticate(self.manager_b)
        baseline = {
            "comments": FmTicketComment.objects.count(),
            "history": FmTicketHistory.objects.count(),
            "escalations": FmTicketEscalation.objects.count(),
            "notifications": Notification.objects.count(),
            "work_orders": MaintenanceWorkOrder.objects.count(),
            "status": self.ticket_a.status,
            "title": self.ticket_a.title,
        }
        action_requests = (
            ("get", reverse("fm-ticket-detail", args=[self.ticket_a.id]), None),
            (
                "patch",
                reverse("fm-ticket-detail", args=[self.ticket_a.id]),
                {"title": "Cross-tenant mutation"},
            ),
            ("get", reverse("fm-ticket-comments", args=[self.ticket_a.id]), None),
            (
                "post",
                reverse("fm-ticket-comments", args=[self.ticket_a.id]),
                {"body": "Cross-tenant comment"},
            ),
            ("get", reverse("fm-ticket-history", args=[self.ticket_a.id]), None),
            (
                "get",
                reverse("fm-ticket-escalations", args=[self.ticket_a.id]),
                None,
            ),
            (
                "post",
                reverse("fm-ticket-escalate", args=[self.ticket_a.id]),
                {
                    "reason": "Cross-tenant escalation",
                    "level": FmTicketEscalation.Level.LEVEL_1,
                },
            ),
            (
                "post",
                reverse("fm-ticket-assign", args=[self.ticket_a.id]),
                {"assignee": str(self.technician_b.id)},
            ),
            (
                "post",
                reverse(
                    "fm-ticket-generate-work-order",
                    args=[self.ticket_a.id],
                ),
                {},
            ),
            (
                "post",
                reverse("fm-ticket-change-status", args=[self.ticket_a.id]),
                {"status": FmTicket.Status.IN_PROGRESS},
            ),
        )

        for method, url, payload in action_requests:
            response = getattr(self.client, method)(url, payload, format="json")
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        self.ticket_a.refresh_from_db()
        self.assertEqual(FmTicketComment.objects.count(), baseline["comments"])
        self.assertEqual(FmTicketHistory.objects.count(), baseline["history"])
        self.assertEqual(FmTicketEscalation.objects.count(), baseline["escalations"])
        self.assertEqual(Notification.objects.count(), baseline["notifications"])
        self.assertEqual(
            MaintenanceWorkOrder.objects.count(),
            baseline["work_orders"],
        )
        self.assertEqual(self.ticket_a.status, baseline["status"])
        self.assertEqual(self.ticket_a.title, baseline["title"])

    def test_tenant_bound_creation_binds_authenticated_tenant(self):
        self._authenticate(self.manager_a)
        payload = self.create_ticket_payload(self.data_a)
        payload.pop("tenant")
        response = self.client.post(
            reverse("fm-ticket-list"),
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ticket = FmTicket.objects.get(id=response.data["id"])
        self.assertEqual(ticket.tenant_id, self.data_a["tenant"].id)
        self.assertEqual(ticket.requester_id, self.manager_a.id)

    def test_cross_tenant_tenant_input_cannot_create_ticket(self):
        self._authenticate(self.manager_a)
        payload = self.create_ticket_payload(self.data_a)
        payload["tenant"] = str(self.data_b["tenant"].id)
        response = self.client.post(
            reverse("fm-ticket-list"),
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            FmTicket.objects.filter(title=payload["title"]).count(),
            0,
        )

    def test_cross_tenant_related_objects_are_rejected(self):
        self._authenticate(self.manager_a)
        relation_fields = (
            "organization",
            "department",
            "building",
            "floor",
            "area",
            "asset",
        )
        for field_name in relation_fields:
            payload = self.create_ticket_payload(self.data_a)
            payload[field_name] = str(self.data_b[field_name].id)
            response = self.client.post(
                reverse("fm-ticket-list"),
                payload,
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_inactive_or_deleted_related_objects_are_rejected(self):
        self._authenticate(self.manager_a)
        self.data_a["asset"].is_active = False
        self.data_a["asset"].save(update_fields=("is_active", "updated_at"))
        payload = self.create_ticket_payload(self.data_a)
        response = self.client.post(
            reverse("fm-ticket-list"),
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.data_a["asset"].is_active = True
        self.data_a["asset"].is_deleted = True
        self.data_a["asset"].save(
            update_fields=("is_active", "is_deleted", "updated_at")
        )
        response = self.client.post(
            reverse("fm-ticket-list"),
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tenantless_non_global_creation_fails_closed(self):
        self._authenticate(self.tenantless)
        response = self.client.post(
            reverse("fm-ticket-list"),
            self.create_ticket_payload(self.data_a),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_global_administrator_creation_requires_eligible_tenant(self):
        self._authenticate(self.system_admin)
        missing_tenant = self.create_ticket_payload(self.data_b)
        missing_tenant.pop("tenant")
        response = self.client.post(
            reverse("fm-ticket-list"),
            missing_tenant,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        payload = self.create_ticket_payload(self.data_b)
        response = self.client.post(
            reverse("fm-ticket-list"),
            payload,
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        ticket = FmTicket.objects.get(id=response.data["id"])
        self.assertEqual(ticket.tenant_id, self.data_b["tenant"].id)
        self.assertEqual(ticket.requester_id, self.system_admin.id)

    def test_update_rejects_tenant_reassignment_and_cross_tenant_relations(self):
        self._authenticate(self.manager_a)
        history_count = self.ticket_a.history_entries.count()
        tenant_response = self.client.patch(
            reverse("fm-ticket-detail", args=[self.ticket_a.id]),
            {"tenant": str(self.data_b["tenant"].id)},
            format="json",
        )
        self.assertEqual(tenant_response.status_code, status.HTTP_400_BAD_REQUEST)

        relation_response = self.client.patch(
            reverse("fm-ticket-detail", args=[self.ticket_a.id]),
            {"asset": str(self.data_b["asset"].id)},
            format="json",
        )
        self.assertEqual(relation_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.ticket_a.refresh_from_db()
        self.assertEqual(self.ticket_a.tenant_id, self.data_a["tenant"].id)
        self.assertEqual(self.ticket_a.asset_id, self.data_a["asset"].id)
        self.assertEqual(self.ticket_a.history_entries.count(), history_count)

    def test_cross_tenant_assignee_and_escalation_target_are_rejected(self):
        self._authenticate(self.manager_a)
        assignment_response = self.client.post(
            reverse("fm-ticket-assign", args=[self.ticket_a.id]),
            {"assignee": str(self.technician_b.id)},
            format="json",
        )
        escalation_response = self.client.post(
            reverse("fm-ticket-escalate", args=[self.ticket_a.id]),
            {
                "escalated_to": str(self.manager_b.id),
                "reason": "Invalid cross-tenant target",
                "level": FmTicketEscalation.Level.LEVEL_1,
            },
            format="json",
        )

        self.assertEqual(
            assignment_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            escalation_response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        self.assertEqual(
            FmTicketEscalation.objects.filter(ticket=self.ticket_a).count(),
            0,
        )

    def test_same_tenant_core_actions_remain_functional(self):
        self._authenticate(self.manager_a)
        list_response = self.client.get(reverse("fm-ticket-list"))
        detail_response = self.client.get(
            reverse("fm-ticket-detail", args=[self.ticket_a.id])
        )
        update_response = self.client.patch(
            reverse("fm-ticket-detail", args=[self.ticket_a.id]),
            {"title": "Same-tenant update"},
            format="json",
        )
        comment_response = self.client.post(
            reverse("fm-ticket-comments", args=[self.ticket_a.id]),
            {"body": "Same-tenant comment"},
            format="json",
        )
        history_response = self.client.get(
            reverse("fm-ticket-history", args=[self.ticket_a.id])
        )
        status_response = self.client.post(
            reverse("fm-ticket-change-status", args=[self.ticket_a.id]),
            {"status": FmTicket.Status.IN_PROGRESS},
            format="json",
        )
        assign_response = self.client.post(
            reverse("fm-ticket-assign", args=[self.ticket_a.id]),
            {"assignee": str(self.technician_a.id)},
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(comment_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(history_response.status_code, status.HTTP_200_OK)
        self.assertEqual(status_response.status_code, status.HTTP_200_OK)
        self.assertEqual(assign_response.status_code, status.HTTP_200_OK)

    def test_work_order_generation_and_notifications_remain_tenant_safe(self):
        self._authenticate(self.manager_a)
        response = self.client.post(
            reverse(
                "fm-ticket-generate-work-order",
                args=[self.ticket_a.id],
            ),
            {},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        work_order = MaintenanceWorkOrder.objects.get(id=response.data["id"])
        self.assertEqual(work_order.tenant_id, self.data_a["tenant"].id)
        self.assertEqual(work_order.assignee_id, self.technician_a.id)
        self.assertFalse(
            Notification.objects.exclude(tenant_id=self.data_a["tenant"].id).exists()
        )

    def test_in_scope_permission_denial_remains_403(self):
        unprivileged = self._user(
            "unprivileged@example.com",
            self.data_a["tenant"],
        )
        self._authenticate(unprivileged)
        response = self.client.get(
            reverse("fm-ticket-detail", args=[self.ticket_a.id])
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
