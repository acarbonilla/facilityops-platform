from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from django.core.management import call_command

from apps.access_control.management.commands.seed_rbac import ROLE_PERMISSION_CODES
from apps.access_control.models import Permission, Role, RolePermission, UserRole
from apps.fm_tickets.models import FmTicket
from apps.inspection.models import Inspection
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
from apps.reporting.services import (
    DEFAULT_DATE_RANGE_DAYS,
    MAX_DATE_RANGE_DAYS,
    build_operational_overview,
    resolve_reporting_filters,
)
from apps.reporting.tenant_scope import scope_queryset_to_user

User = get_user_model()


class ReportingTestDataMixin:
    def create_reporting_permission(self):
        permission, _ = Permission.objects.get_or_create(
            code="reporting.view",
            defaults={
                "name": "View reporting",
                "module": "reporting",
                "action": "view",
                "description": "View operational reporting aggregates.",
                "is_active": True,
            },
        )
        return permission

    def assign_permissions(self, user, *permission_codes):
        role = Role.objects.create(
            name=f"Role {user.email}",
            code=f"role-{user.email.split('@')[0]}-{uuid4().hex[:8]}",
        )
        for permission_code in permission_codes:
            RolePermission.objects.create(
                role=role,
                permission=Permission.objects.get(code=permission_code),
            )
        UserRole.objects.create(user=user, role=role)

    def assign_system_admin_role(self, user):
        role, _ = Role.objects.get_or_create(
            code="system_admin",
            defaults={
                "name": "System Administrator",
                "description": "Full access",
                "is_system_role": True,
                "is_active": True,
            },
        )
        UserRole.objects.create(user=user, role=role)

    def create_master_data(self, *, suffix="a"):
        tenant = Tenant.objects.create(
            name=f"Tenant {suffix}",
            code=f"tenant-{suffix}",
        )
        organization = Organization.objects.create(
            tenant=tenant,
            name=f"Organization {suffix}",
            code=f"organization-{suffix}",
        )
        department = Department.objects.create(
            tenant=tenant,
            organization=organization,
            name=f"Facilities {suffix}",
            code=f"facilities-{suffix}",
        )
        building = Building.objects.create(
            tenant=tenant,
            organization=organization,
            name=f"Building {suffix}",
            code=f"building-{suffix}",
        )
        floor = Floor.objects.create(
            tenant=tenant,
            building=building,
            name=f"Floor {suffix}",
            code=f"floor-{suffix}",
            level_number=1,
        )
        area = Area.objects.create(
            tenant=tenant,
            building=building,
            floor=floor,
            name=f"Area {suffix}",
            code=f"area-{suffix}",
        )
        asset_type = AssetType.objects.create(
            tenant=tenant,
            name=f"Asset Type {suffix}",
            code=f"asset-type-{suffix}",
        )
        asset = Asset.objects.create(
            tenant=tenant,
            organization=organization,
            building=building,
            floor=floor,
            area=area,
            asset_type=asset_type,
            name=f"Asset {suffix}",
            code=f"asset-{suffix}",
        )
        return {
            "tenant": tenant,
            "organization": organization,
            "department": department,
            "building": building,
            "floor": floor,
            "area": area,
            "asset_type": asset_type,
            "asset": asset,
        }

    def overview_url(self):
        return reverse("reporting-operational-overview")

    def date_window(self, days=30):
        return {
            "date_from": (self.now - timedelta(days=days)).isoformat(),
            "date_to": self.now.isoformat(),
        }


class ReportingFoundationTests(ReportingTestDataMixin, APITestCase):
    def setUp(self):
        self.permission = self.create_reporting_permission()
        self.data = self.create_master_data(suffix="primary")
        self.other_data = self.create_master_data(suffix="other")
        self.now = timezone.now()

        self.viewer = User.objects.create_user(
            email="reporting-viewer@example.com",
            password="Password123!",
            tenant=self.data["tenant"],
            organization=self.data["organization"],
        )
        self.denied = User.objects.create_user(
            email="reporting-denied@example.com",
            password="Password123!",
            tenant=self.data["tenant"],
            organization=self.data["organization"],
        )
        self.assign_permissions(self.viewer, "reporting.view")

        self.ticket = FmTicket.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            asset=self.data["asset"],
            requester=self.viewer,
            title="Primary ticket",
            description="Reporting ticket fixture.",
            status=FmTicket.Status.OPEN,
            priority=FmTicket.Priority.HIGH,
            category=FmTicket.Category.HVAC,
            reported_at=self.now - timedelta(days=2),
            due_at=self.now - timedelta(hours=1),
            response_due_at=self.now - timedelta(days=1),
            first_responded_at=self.now - timedelta(days=1, hours=2),
            resolution_due_at=self.now - timedelta(hours=12),
            resolved_at=self.now - timedelta(hours=1),
        )
        FmTicket.objects.create(
            tenant=self.other_data["tenant"],
            organization=self.other_data["organization"],
            department=self.other_data["department"],
            building=self.other_data["building"],
            floor=self.other_data["floor"],
            area=self.other_data["area"],
            asset=self.other_data["asset"],
            requester=self.viewer,
            title="Other tenant ticket",
            description="Must not leak into reporting aggregates.",
            status=FmTicket.Status.OPEN,
            priority=FmTicket.Priority.URGENT,
            category=FmTicket.Category.ELECTRICAL,
            reported_at=self.now - timedelta(days=1),
        )

        self.work_order = MaintenanceWorkOrder.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            asset=self.data["asset"],
            requester=self.viewer,
            title="Primary work order",
            description="Reporting work order fixture.",
            status=MaintenanceWorkOrder.Status.IN_PROGRESS,
            priority=MaintenanceWorkOrder.Priority.CRITICAL,
            requested_at=self.now - timedelta(days=3),
            due_at=self.now - timedelta(hours=2),
        )
        MaintenanceWorkOrder.objects.create(
            tenant=self.other_data["tenant"],
            organization=self.other_data["organization"],
            department=self.other_data["department"],
            building=self.other_data["building"],
            floor=self.other_data["floor"],
            area=self.other_data["area"],
            asset=self.other_data["asset"],
            requester=self.viewer,
            title="Other tenant work order",
            description="Must not leak.",
            status=MaintenanceWorkOrder.Status.OPEN,
            priority=MaintenanceWorkOrder.Priority.HIGH,
            requested_at=self.now - timedelta(days=1),
        )

        self.other_inspector = User.objects.create_user(
            email="reporting-other-inspector@example.com",
            password="Password123!",
            tenant=self.other_data["tenant"],
            organization=self.other_data["organization"],
        )

        self.inspection = Inspection.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            title="Primary inspection",
            inspection_type=Inspection.InspectionType.ROUTINE,
            five_s_category=Inspection.FiveSCategory.SHINE,
            status=Inspection.Status.COMPLETED,
            score=Decimal("85.50"),
            scheduled_date=self.now - timedelta(days=4),
            completed_date=self.now - timedelta(days=3),
            inspector=self.viewer,
        )
        Inspection.objects.create(
            tenant=self.other_data["tenant"],
            organization=self.other_data["organization"],
            department=self.other_data["department"],
            building=self.other_data["building"],
            floor=self.other_data["floor"],
            area=self.other_data["area"],
            title="Other tenant inspection",
            inspection_type=Inspection.InspectionType.AUDIT,
            five_s_category=Inspection.FiveSCategory.SORT,
            status=Inspection.Status.SCHEDULED,
            scheduled_date=self.now - timedelta(days=1),
            inspector=self.other_inspector,
        )

        soft_deleted = FmTicket.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            asset=self.data["asset"],
            requester=self.viewer,
            title="Soft-deleted ticket",
            description="Excluded from aggregates.",
            status=FmTicket.Status.OPEN,
            priority=FmTicket.Priority.MEDIUM,
            reported_at=self.now - timedelta(days=1),
        )
        soft_deleted.is_deleted = True
        soft_deleted.deleted_at = self.now
        soft_deleted.save(update_fields=("is_deleted", "deleted_at", "updated_at"))

    def test_overview_requires_authentication(self):
        response = self.client.get(self.overview_url())
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_overview_requires_reporting_view_permission(self):
        self.client.force_authenticate(self.denied)
        response = self.client.get(self.overview_url())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_overview_returns_tenant_scoped_aggregates(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(self.overview_url(), self.date_window())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tickets"]["total"], 1)
        self.assertEqual(response.data["tickets"]["open"], 1)
        self.assertEqual(response.data["tickets"]["by_status"]["open"], 1)
        self.assertEqual(response.data["tickets"]["by_priority"]["high"], 1)
        self.assertEqual(response.data["tickets"]["by_category"]["hvac"], 1)
        self.assertEqual(response.data["tickets"]["overdue"], 1)
        self.assertEqual(response.data["tickets"]["sla"]["response_met"], 1)
        self.assertEqual(response.data["tickets"]["sla"]["resolution_missed"], 1)
        self.assertNotIn("status", response.data["filters"])
        self.assertNotIn("priority", response.data["filters"])

        self.assertEqual(response.data["work_orders"]["total"], 1)
        self.assertEqual(response.data["work_orders"]["by_status"]["in_progress"], 1)
        self.assertEqual(response.data["work_orders"]["by_priority"]["critical"], 1)
        self.assertEqual(response.data["work_orders"]["overdue"], 1)
        self.assertEqual(response.data["work_orders"]["standalone"], 1)
        self.assertEqual(response.data["work_orders"]["linked_to_ticket"], 0)

        self.assertEqual(response.data["inspections"]["total"], 1)
        self.assertEqual(response.data["inspections"]["by_status"]["completed"], 1)
        self.assertEqual(response.data["inspections"]["scored_count"], 1)
        self.assertAlmostEqual(response.data["inspections"]["average_score"], 85.5)

    def test_tenant_scope_blocks_cross_tenant_leakage(self):
        self.viewer.tenant = self.other_data["tenant"]
        self.viewer.organization = self.other_data["organization"]
        self.viewer.save(update_fields=("tenant", "organization", "updated_at"))
        self.client.force_authenticate(self.viewer)

        response = self.client.get(self.overview_url(), self.date_window())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tickets"]["total"], 1)
        self.assertEqual(response.data["tickets"]["by_priority"]["urgent"], 1)
        self.assertEqual(response.data["work_orders"]["total"], 1)
        self.assertEqual(response.data["inspections"]["total"], 1)
        self.assertEqual(response.data["inspections"]["by_status"]["scheduled"], 1)

    def test_user_without_tenant_sees_empty_aggregates(self):
        self.viewer.tenant = None
        self.viewer.organization = None
        self.viewer.save(update_fields=("tenant", "organization", "updated_at"))
        self.client.force_authenticate(self.viewer)

        response = self.client.get(self.overview_url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tickets"]["total"], 0)
        self.assertEqual(response.data["work_orders"]["total"], 0)
        self.assertEqual(response.data["inspections"]["total"], 0)

    def test_same_tenant_building_filter_succeeds(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {**self.date_window(), "building": str(self.data["building"].id)},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tickets"]["total"], 1)
        self.assertEqual(
            response.data["filters"]["building"], str(self.data["building"].id)
        )

    def test_same_tenant_organization_filter_succeeds(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {
                **self.date_window(),
                "organization": str(self.data["organization"].id),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tickets"]["total"], 1)
        self.assertEqual(
            response.data["filters"]["organization"],
            str(self.data["organization"].id),
        )

    def test_cross_tenant_building_filter_returns_404(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {**self.date_window(), "building": str(self.other_data["building"].id)},
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_tenant_organization_filter_returns_404(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {
                **self.date_window(),
                "organization": str(self.other_data["organization"].id),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_malformed_building_uuid_returns_400(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {**self.date_window(), "building": "not-a-uuid"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("building", response.data)
        self.assertEqual(response.data["building"][0], "Must be a valid UUID.")

    def test_malformed_organization_uuid_returns_400(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {**self.date_window(), "organization": "bad-id"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("organization", response.data)

    def test_inactive_building_returns_404(self):
        self.data["building"].is_active = False
        self.data["building"].save(update_fields=("is_active", "updated_at"))
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {**self.date_window(), "building": str(self.data["building"].id)},
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_deleted_building_returns_404(self):
        self.data["building"].is_deleted = True
        self.data["building"].deleted_at = self.now
        self.data["building"].save(
            update_fields=("is_deleted", "deleted_at", "updated_at")
        )
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {**self.date_window(), "building": str(self.data["building"].id)},
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_inactive_organization_returns_404(self):
        self.data["organization"].is_active = False
        self.data["organization"].save(update_fields=("is_active", "updated_at"))
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {
                **self.date_window(),
                "organization": str(self.data["organization"].id),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_deleted_organization_returns_404(self):
        self.data["organization"].is_deleted = True
        self.data["organization"].deleted_at = self.now
        self.data["organization"].save(
            update_fields=("is_deleted", "deleted_at", "updated_at")
        )
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {
                **self.date_window(),
                "organization": str(self.data["organization"].id),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_building_organization_mismatch_returns_400(self):
        other_org = Organization.objects.create(
            tenant=self.data["tenant"],
            name="Alt Organization",
            code="organization-alt",
        )
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {
                **self.date_window(),
                "building": str(self.data["building"].id),
                "organization": str(other_org.id),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("building", response.data)

    def test_unknown_building_uuid_returns_404(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {**self.date_window(), "building": str(uuid4())},
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_tenantless_non_global_user_cannot_use_building_filter(self):
        self.viewer.tenant = None
        self.viewer.organization = None
        self.viewer.save(update_fields=("tenant", "organization", "updated_at"))
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {**self.date_window(), "building": str(self.data["building"].id)},
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_system_admin_has_global_scope(self):
        admin = User.objects.create_user(
            email="reporting-admin@example.com",
            password="Password123!",
        )
        self.create_reporting_permission()
        self.assign_permissions(admin, "reporting.view")
        self.assign_system_admin_role(admin)
        self.client.force_authenticate(admin)

        response = self.client.get(self.overview_url(), self.date_window())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tickets"]["total"], 2)
        self.assertEqual(response.data["work_orders"]["total"], 2)
        self.assertEqual(response.data["inspections"]["total"], 2)

    def test_superuser_has_global_scope(self):
        superuser = User.objects.create_superuser(
            email="reporting-super@example.com",
            password="Password123!",
        )
        self.client.force_authenticate(superuser)
        response = self.client.get(self.overview_url(), self.date_window())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tickets"]["total"], 2)

    def test_system_admin_can_filter_cross_tenant_building(self):
        admin = User.objects.create_user(
            email="reporting-admin-building@example.com",
            password="Password123!",
        )
        self.assign_permissions(admin, "reporting.view")
        self.assign_system_admin_role(admin)
        self.client.force_authenticate(admin)
        response = self.client.get(
            self.overview_url(),
            {
                **self.date_window(),
                "building": str(self.other_data["building"].id),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tickets"]["total"], 1)
        self.assertEqual(response.data["tickets"]["by_priority"]["urgent"], 1)

    def test_status_filter_is_rejected(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {**self.date_window(), "status": "open"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)

    def test_priority_filter_is_rejected(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {**self.date_window(), "priority": "high"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("priority", response.data)

    def test_status_and_priority_together_are_rejected(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {**self.date_window(), "status": "open", "priority": "high"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("status", response.data)
        self.assertIn("priority", response.data)

    def test_date_range_max_is_enforced(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {
                "date_from": (
                    self.now - timedelta(days=MAX_DATE_RANGE_DAYS + 1)
                ).isoformat(),
                "date_to": self.now.isoformat(),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date_from", response.data)

    def test_exact_180_day_range_is_accepted(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {
                "date_from": (
                    self.now - timedelta(days=MAX_DATE_RANGE_DAYS)
                ).isoformat(),
                "date_to": self.now.isoformat(),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_reversed_date_bounds_return_400(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {
                "date_from": self.now.isoformat(),
                "date_to": (self.now - timedelta(days=1)).isoformat(),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date_from", response.data)

    def test_malformed_datetime_returns_400(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {"date_from": "not-a-date", "date_to": self.now.isoformat()},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date_from", response.data)

    def test_equal_date_bounds_are_accepted(self):
        self.client.force_authenticate(self.viewer)
        bound = self.ticket.reported_at.isoformat()
        response = self.client.get(
            self.overview_url(),
            {"date_from": bound, "date_to": bound},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tickets"]["total"], 1)

    def test_only_date_from_defaults_date_to_now(self):
        filters = resolve_reporting_filters(
            {"date_from": (self.now - timedelta(days=10)).isoformat()},
            user=self.viewer,
        )
        self.assertLessEqual(
            abs((filters["date_to"] - timezone.now()).total_seconds()), 5
        )

    def test_only_date_to_defaults_date_from_ninety_days_earlier(self):
        filters = resolve_reporting_filters(
            {"date_to": self.now.isoformat()},
            user=self.viewer,
        )
        span = filters["date_to"] - filters["date_from"]
        self.assertAlmostEqual(
            span.total_seconds() / 86400, DEFAULT_DATE_RANGE_DAYS, places=0
        )

    def test_resolve_reporting_filters_defaults_to_ninety_days(self):
        filters = resolve_reporting_filters({}, user=self.viewer)
        span = filters["date_to"] - filters["date_from"]
        self.assertAlmostEqual(
            span.total_seconds() / 86400, DEFAULT_DATE_RANGE_DAYS, places=0
        )

    def test_inclusive_start_and_end_boundaries(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            self.overview_url(),
            {
                "date_from": self.ticket.reported_at.isoformat(),
                "date_to": self.ticket.reported_at.isoformat(),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tickets"]["total"], 1)

    def test_naive_datetime_is_normalized(self):
        naive = (self.now - timedelta(days=5)).replace(tzinfo=None).isoformat()
        filters = resolve_reporting_filters(
            {"date_from": naive, "date_to": self.now.isoformat()},
            user=self.viewer,
        )
        self.assertTrue(timezone.is_aware(filters["date_from"]))

    def test_scope_queryset_helper_filters_tenant(self):
        scoped = scope_queryset_to_user(
            FmTicket.objects.filter(is_deleted=False),
            self.viewer,
        )
        self.assertEqual(scoped.count(), 1)
        self.assertEqual(scoped.get().id, self.ticket.id)

    def test_service_ignores_soft_deleted_rows(self):
        payload = build_operational_overview(self.viewer, self.date_window())
        self.assertEqual(payload["tickets"]["total"], 1)

    def test_null_score_inspections_are_excluded_from_average(self):
        Inspection.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=self.data["building"],
            floor=self.data["floor"],
            area=self.data["area"],
            title="Unscored inspection",
            inspection_type=Inspection.InspectionType.ROUTINE,
            five_s_category=Inspection.FiveSCategory.SET_IN_ORDER,
            status=Inspection.Status.IN_PROGRESS,
            score=None,
            scheduled_date=self.now - timedelta(days=1),
            inspector=self.viewer,
        )
        payload = build_operational_overview(self.viewer, self.date_window())
        self.assertEqual(payload["inspections"]["total"], 2)
        self.assertEqual(payload["inspections"]["scored_count"], 1)
        self.assertAlmostEqual(payload["inspections"]["average_score"], 85.5)

    def test_overview_is_read_only_and_creates_no_side_effects(self):
        ticket_updated = self.ticket.updated_at
        work_order_updated = self.work_order.updated_at
        inspection_updated = self.inspection.updated_at
        ticket_count = FmTicket.objects.count()
        work_order_count = MaintenanceWorkOrder.objects.count()
        inspection_count = Inspection.objects.count()
        notification_count = Notification.objects.count()

        self.client.force_authenticate(self.viewer)
        response = self.client.get(self.overview_url(), self.date_window())
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.ticket.refresh_from_db()
        self.work_order.refresh_from_db()
        self.inspection.refresh_from_db()
        self.assertEqual(self.ticket.updated_at, ticket_updated)
        self.assertEqual(self.work_order.updated_at, work_order_updated)
        self.assertEqual(self.inspection.updated_at, inspection_updated)
        self.assertEqual(FmTicket.objects.count(), ticket_count)
        self.assertEqual(MaintenanceWorkOrder.objects.count(), work_order_count)
        self.assertEqual(Inspection.objects.count(), inspection_count)
        self.assertEqual(Notification.objects.count(), notification_count)

    def test_query_count_does_not_grow_with_additional_rows(self):
        self.client.force_authenticate(self.viewer)
        with CaptureQueriesContext(connection) as baseline:
            first = self.client.get(self.overview_url(), self.date_window())
        self.assertEqual(first.status_code, status.HTTP_200_OK)

        for index in range(5):
            FmTicket.objects.create(
                tenant=self.data["tenant"],
                organization=self.data["organization"],
                department=self.data["department"],
                building=self.data["building"],
                floor=self.data["floor"],
                area=self.data["area"],
                asset=self.data["asset"],
                requester=self.viewer,
                title=f"Extra ticket {index}",
                description="Extra aggregate row.",
                status=FmTicket.Status.OPEN,
                priority=FmTicket.Priority.LOW,
                reported_at=self.now - timedelta(days=1),
            )

        with CaptureQueriesContext(connection) as after:
            second = self.client.get(self.overview_url(), self.date_window())
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(second.data["tickets"]["total"], 6)
        self.assertEqual(len(after), len(baseline))

    def test_empty_tenant_dataset_returns_zero_payload(self):
        empty_tenant = Tenant.objects.create(name="Empty", code="empty-tenant")
        empty_org = Organization.objects.create(
            tenant=empty_tenant,
            name="Empty Org",
            code="empty-org",
        )
        empty_user = User.objects.create_user(
            email="reporting-empty@example.com",
            password="Password123!",
            tenant=empty_tenant,
            organization=empty_org,
        )
        self.assign_permissions(empty_user, "reporting.view")
        self.client.force_authenticate(empty_user)
        response = self.client.get(self.overview_url(), self.date_window())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tickets"]["total"], 0)
        self.assertEqual(response.data["work_orders"]["total"], 0)
        self.assertEqual(response.data["inspections"]["total"], 0)
        self.assertIsNone(response.data["inspections"]["average_score"])


class ReportingSeedRbacTests(APITestCase):
    def test_seed_rbac_assigns_reporting_view_to_expected_roles(self):
        call_command("seed_rbac")
        for role_code in ("system_admin", "facility_manager", "viewer"):
            self.assertIn("reporting.view", ROLE_PERMISSION_CODES[role_code])
            self.assertTrue(
                RolePermission.objects.filter(
                    role__code=role_code,
                    permission__code="reporting.view",
                    is_active=True,
                ).exists()
            )
        self.assertNotIn(
            "reporting.view", ROLE_PERMISSION_CODES.get("technician", set())
        )
        self.assertNotIn(
            "reporting.view", ROLE_PERMISSION_CODES.get("inspector", set())
        )


class ReportingFilterOptionsTests(ReportingTestDataMixin, APITestCase):
    def setUp(self):
        self.permission = self.create_reporting_permission()
        self.settings_permission, _ = Permission.objects.get_or_create(
            code="settings.view",
            defaults={
                "name": "View settings",
                "module": "settings",
                "action": "view",
                "description": "View settings and master data.",
                "is_active": True,
            },
        )
        self.data = self.create_master_data(suffix="primary")
        self.other_data = self.create_master_data(suffix="other")
        self.now = timezone.now()

        self.viewer = User.objects.create_user(
            email="reporting-filter-viewer@example.com",
            password="Password123!",
            tenant=self.data["tenant"],
            organization=self.data["organization"],
        )
        self.denied = User.objects.create_user(
            email="reporting-filter-denied@example.com",
            password="Password123!",
            tenant=self.data["tenant"],
            organization=self.data["organization"],
        )
        self.settings_only = User.objects.create_user(
            email="reporting-settings-only@example.com",
            password="Password123!",
            tenant=self.data["tenant"],
            organization=self.data["organization"],
        )
        self.assign_permissions(self.viewer, "reporting.view")
        self.assign_permissions(self.settings_only, "settings.view")

        inactive_org = Organization.objects.create(
            tenant=self.data["tenant"],
            name="Inactive Organization",
            code="inactive-organization",
            is_active=False,
        )
        deleted_org = Organization.objects.create(
            tenant=self.data["tenant"],
            name="Deleted Organization",
            code="deleted-organization",
            is_deleted=True,
        )
        Building.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            name="Inactive Building",
            code="inactive-building",
            is_active=False,
        )
        Building.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            name="Deleted Building",
            code="deleted-building",
            is_deleted=True,
        )
        Building.objects.create(
            tenant=self.data["tenant"],
            organization=inactive_org,
            name="Building under inactive org",
            code="building-inactive-org",
        )
        self.inactive_org = inactive_org
        self.deleted_org = deleted_org

    def filter_options_url(self):
        return reverse("reporting-filter-options")

    def test_unauthenticated_request_is_rejected(self):
        response = self.client.get(self.filter_options_url())
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_user_without_reporting_view_is_rejected(self):
        self.client.force_authenticate(self.denied)
        response = self.client.get(self.filter_options_url())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_reporting_view_succeeds_without_settings_view(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(self.filter_options_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("organizations", response.data)
        self.assertIn("buildings", response.data)

    def test_settings_view_alone_does_not_grant_access(self):
        self.client.force_authenticate(self.settings_only)
        response = self.client.get(self.filter_options_url())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_same_tenant_options_are_included(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(self.filter_options_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        organization_ids = {item["id"] for item in response.data["organizations"]}
        building_ids = {item["id"] for item in response.data["buildings"]}
        self.assertIn(str(self.data["organization"].id), organization_ids)
        self.assertIn(str(self.data["building"].id), building_ids)

    def test_cross_tenant_options_are_excluded(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(self.filter_options_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        organization_ids = {item["id"] for item in response.data["organizations"]}
        building_ids = {item["id"] for item in response.data["buildings"]}
        self.assertNotIn(str(self.other_data["organization"].id), organization_ids)
        self.assertNotIn(str(self.other_data["building"].id), building_ids)

    def test_inactive_and_deleted_options_are_excluded(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(self.filter_options_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        organization_names = {item["name"] for item in response.data["organizations"]}
        building_names = {item["name"] for item in response.data["buildings"]}
        self.assertNotIn("Inactive Organization", organization_names)
        self.assertNotIn("Deleted Organization", organization_names)
        self.assertNotIn("Inactive Building", building_names)
        self.assertNotIn("Deleted Building", building_names)
        self.assertNotIn("Building under inactive org", building_names)

    def test_tenantless_non_global_user_receives_empty_arrays(self):
        self.viewer.tenant = None
        self.viewer.organization = None
        self.viewer.save(update_fields=("tenant", "organization", "updated_at"))
        self.client.force_authenticate(self.viewer)
        response = self.client.get(self.filter_options_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["organizations"], [])
        self.assertEqual(response.data["buildings"], [])

    def test_system_admin_sees_eligible_global_options(self):
        admin = User.objects.create_user(
            email="reporting-filter-admin@example.com",
            password="Password123!",
        )
        self.assign_permissions(admin, "reporting.view")
        self.assign_system_admin_role(admin)
        self.client.force_authenticate(admin)

        response = self.client.get(self.filter_options_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        organization_ids = {item["id"] for item in response.data["organizations"]}
        building_ids = {item["id"] for item in response.data["buildings"]}
        self.assertIn(str(self.data["organization"].id), organization_ids)
        self.assertIn(str(self.other_data["organization"].id), organization_ids)
        self.assertIn(str(self.data["building"].id), building_ids)
        self.assertIn(str(self.other_data["building"].id), building_ids)

    def test_superuser_sees_eligible_global_options(self):
        superuser = User.objects.create_superuser(
            email="reporting-filter-super@example.com",
            password="Password123!",
        )
        self.client.force_authenticate(superuser)
        response = self.client.get(self.filter_options_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        organization_ids = {item["id"] for item in response.data["organizations"]}
        self.assertIn(str(self.data["organization"].id), organization_ids)
        self.assertIn(str(self.other_data["organization"].id), organization_ids)

    def test_response_shape_and_building_organization_relationship(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(self.filter_options_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        organization = response.data["organizations"][0]
        building = next(
            item
            for item in response.data["buildings"]
            if item["id"] == str(self.data["building"].id)
        )
        self.assertEqual(set(organization.keys()), {"id", "name"})
        self.assertEqual(set(building.keys()), {"id", "name", "organization_id"})
        self.assertEqual(
            building["organization_id"], str(self.data["organization"].id)
        )
        self.assertNotIn("tenant", organization)
        self.assertNotIn("tenant_id", building)
        self.assertNotIn("code", organization)
        self.assertNotIn("address", building)

    def test_options_are_ordered_by_name_then_id(self):
        Organization.objects.create(
            tenant=self.data["tenant"],
            name="Alpha Organization",
            code="alpha-organization",
        )
        Organization.objects.create(
            tenant=self.data["tenant"],
            name="Zulu Organization",
            code="zulu-organization",
        )
        self.client.force_authenticate(self.viewer)
        response = self.client.get(self.filter_options_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [item["name"] for item in response.data["organizations"]]
        self.assertEqual(names, sorted(names))

    def test_filter_options_are_read_only(self):
        organization_count = Organization.objects.count()
        building_count = Building.objects.count()
        self.client.force_authenticate(self.viewer)
        response = self.client.get(self.filter_options_url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Organization.objects.count(), organization_count)
        self.assertEqual(Building.objects.count(), building_count)

    def test_overview_behavior_remains_available(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(self.overview_url(), self.date_window())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("tickets", response.data)

    def test_seed_rbac_does_not_add_settings_view_for_viewer_reporting(self):
        call_command("seed_rbac")
        self.assertIn("reporting.view", ROLE_PERMISSION_CODES["viewer"])
        self.assertNotIn("settings.view", ROLE_PERMISSION_CODES.get("viewer", set()))
        self.assertNotIn(
            "settings.view",
            ROLE_PERMISSION_CODES.get("facility_manager", set()),
        )
