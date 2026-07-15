from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

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
from apps.reporting.services import (
    MAX_DATE_RANGE_DAYS,
    build_operational_overview,
    resolve_reporting_filters,
)
from apps.reporting.tenant_scope import scope_queryset_to_user

User = get_user_model()


class ReportingTestDataMixin:
    def create_reporting_permission(self):
        return Permission.objects.create(
            code="reporting.view",
            name="View reporting",
            module="reporting",
            action="view",
            description="View operational reporting aggregates.",
            is_active=True,
        )

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
        response = self.client.get(reverse("reporting-operational-overview"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_overview_requires_reporting_view_permission(self):
        self.client.force_authenticate(self.denied)
        response = self.client.get(reverse("reporting-operational-overview"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_overview_returns_tenant_scoped_aggregates(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            reverse("reporting-operational-overview"),
            {
                "date_from": (self.now - timedelta(days=30)).isoformat(),
                "date_to": self.now.isoformat(),
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tickets"]["total"], 1)
        self.assertEqual(response.data["tickets"]["by_status"]["open"], 1)
        self.assertEqual(response.data["tickets"]["by_priority"]["high"], 1)
        self.assertEqual(response.data["tickets"]["by_category"]["hvac"], 1)
        self.assertEqual(response.data["tickets"]["overdue"], 1)
        self.assertEqual(response.data["tickets"]["sla"]["response_met"], 1)
        self.assertEqual(response.data["tickets"]["sla"]["resolution_missed"], 1)

        self.assertEqual(response.data["work_orders"]["total"], 1)
        self.assertEqual(response.data["work_orders"]["by_status"]["in_progress"], 1)
        self.assertEqual(response.data["work_orders"]["by_priority"]["critical"], 1)
        self.assertEqual(response.data["work_orders"]["overdue"], 1)
        self.assertEqual(response.data["work_orders"]["standalone"], 1)

        self.assertEqual(response.data["inspections"]["total"], 1)
        self.assertEqual(response.data["inspections"]["by_status"]["completed"], 1)
        self.assertEqual(response.data["inspections"]["scored_count"], 1)
        self.assertAlmostEqual(response.data["inspections"]["average_score"], 85.5)

    def test_tenant_scope_blocks_cross_tenant_leakage(self):
        self.viewer.tenant = self.other_data["tenant"]
        self.viewer.organization = self.other_data["organization"]
        self.viewer.save(update_fields=("tenant", "organization", "updated_at"))
        self.client.force_authenticate(self.viewer)

        response = self.client.get(
            reverse("reporting-operational-overview"),
            {
                "date_from": (self.now - timedelta(days=30)).isoformat(),
                "date_to": self.now.isoformat(),
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tickets"]["total"], 1)
        self.assertEqual(
            response.data["tickets"]["by_priority"]["urgent"],
            1,
        )
        self.assertEqual(response.data["work_orders"]["total"], 1)
        self.assertEqual(response.data["inspections"]["total"], 1)
        self.assertEqual(response.data["inspections"]["by_status"]["scheduled"], 1)

    def test_user_without_tenant_sees_empty_aggregates(self):
        self.viewer.tenant = None
        self.viewer.organization = None
        self.viewer.save(update_fields=("tenant", "organization", "updated_at"))
        self.client.force_authenticate(self.viewer)

        response = self.client.get(reverse("reporting-operational-overview"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tickets"]["total"], 0)
        self.assertEqual(response.data["work_orders"]["total"], 0)
        self.assertEqual(response.data["inspections"]["total"], 0)

    def test_building_filter_narrows_aggregates(self):
        second_building = Building.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            name="Second Building",
            code="building-secondary",
        )
        second_floor = Floor.objects.create(
            tenant=self.data["tenant"],
            building=second_building,
            name="Second Floor",
            code="floor-secondary",
            level_number=1,
        )
        second_area = Area.objects.create(
            tenant=self.data["tenant"],
            building=second_building,
            floor=second_floor,
            name="Second Area",
            code="area-secondary",
        )
        second_asset = Asset.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            building=second_building,
            floor=second_floor,
            area=second_area,
            asset_type=self.data["asset_type"],
            name="Second Asset",
            code="asset-secondary",
        )
        FmTicket.objects.create(
            tenant=self.data["tenant"],
            organization=self.data["organization"],
            department=self.data["department"],
            building=second_building,
            floor=second_floor,
            area=second_area,
            asset=second_asset,
            requester=self.viewer,
            title="Secondary building ticket",
            description="Filtered out by building.",
            status=FmTicket.Status.ASSIGNED,
            priority=FmTicket.Priority.LOW,
            reported_at=self.now - timedelta(days=1),
        )

        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            reverse("reporting-operational-overview"),
            {
                "date_from": (self.now - timedelta(days=30)).isoformat(),
                "date_to": self.now.isoformat(),
                "building": str(self.data["building"].id),
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["tickets"]["total"], 1)
        self.assertEqual(
            response.data["filters"]["building"], str(self.data["building"].id)
        )

    def test_date_range_max_is_enforced(self):
        self.client.force_authenticate(self.viewer)
        response = self.client.get(
            reverse("reporting-operational-overview"),
            {
                "date_from": (
                    self.now - timedelta(days=MAX_DATE_RANGE_DAYS + 1)
                ).isoformat(),
                "date_to": self.now.isoformat(),
            },
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date_from", response.data)

    def test_resolve_reporting_filters_defaults_to_ninety_days(self):
        filters = resolve_reporting_filters({})
        span = filters["date_to"] - filters["date_from"]
        self.assertAlmostEqual(span.total_seconds() / 86400, 90, places=0)

    def test_scope_queryset_helper_filters_tenant(self):
        scoped = scope_queryset_to_user(
            FmTicket.objects.filter(is_deleted=False),
            self.viewer,
        )
        self.assertEqual(scoped.count(), 1)
        self.assertEqual(scoped.get().id, self.ticket.id)

    def test_service_ignores_soft_deleted_rows(self):
        payload = build_operational_overview(
            self.viewer,
            {
                "date_from": (self.now - timedelta(days=30)).isoformat(),
                "date_to": self.now.isoformat(),
            },
        )
        self.assertEqual(payload["tickets"]["total"], 1)
