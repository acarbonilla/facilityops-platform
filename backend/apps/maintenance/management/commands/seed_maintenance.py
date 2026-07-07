from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.master_data.models import Area, Asset, Building, Department, Floor, Organization, Tenant

from apps.maintenance.models import (
    MaintenanceAISummary,
    MaintenanceAttachment,
    MaintenanceEscalation,
    MaintenanceLabor,
    MaintenanceMaterial,
    MaintenanceSupervisorApproval,
    MaintenanceTask,
    MaintenanceWorkOrder,
)
from apps.maintenance.services import (
    assign_work_order,
    change_status,
    complete_work_order,
    create_work_order,
)


User = get_user_model()


class Command(BaseCommand):
    help = "Seed minimal development maintenance work order data."

    def handle(self, *args, **options):
        asset = Asset.objects.select_related(
            "tenant",
            "organization",
            "building",
            "floor",
            "area",
        ).first()
        if asset:
            tenant = asset.tenant
            organization = asset.organization
            building = asset.building
            floor = asset.floor
            area = asset.area
        else:
            tenant = Tenant.objects.first()
            organization = Organization.objects.filter(tenant=tenant).first() if tenant else None
            building = (
                Building.objects.filter(tenant=tenant, organization=organization).first()
                if tenant and organization
                else None
            )
            floor = Floor.objects.filter(tenant=tenant, building=building).first() if tenant and building else None
            area = (
                Area.objects.filter(tenant=tenant, building=building, floor=floor).first()
                if tenant and building and floor
                else None
            )
            asset = (
                Asset.objects.filter(tenant=tenant, organization=organization, building=building).first()
                if tenant and organization and building
                else None
            )

        if not all([tenant, organization, building, asset]):
            self.stdout.write(
                self.style.ERROR(
                    "Master data seed records are required before seeding maintenance work orders."
                )
            )
            return

        department = Department.objects.filter(
            tenant=tenant,
            organization=organization,
        ).first()

        requester = User.objects.order_by("created_at").first()
        if requester is None:
            requester = User.objects.create_user(
                email="maintenance.requester@example.com",
                password="Password123!",
                first_name="Maintenance",
                last_name="Requester",
            )
        assignee = User.objects.exclude(id=requester.id).order_by("created_at").first()
        if assignee is None:
            assignee = User.objects.create_user(
                email="maintenance.tech@example.com",
                password="Password123!",
                first_name="Maintenance",
                last_name="Technician",
            )

        now = timezone.now()
        created_work_orders = 0
        work_order_definitions = [
            {
                "title": "Air handling unit belt replacement",
                "description": "Replace worn drive belt on the main lobby air handling unit.",
                "priority": MaintenanceWorkOrder.Priority.HIGH,
                "status": MaintenanceWorkOrder.Status.IN_PROGRESS,
                "requested_at": now - timedelta(hours=6),
                "due_at": now + timedelta(days=1),
                "scheduled_start_at": now - timedelta(hours=2),
                "tenant": tenant,
                "organization": organization,
                "department": department,
                "building": building,
                "floor": floor,
                "area": area,
                "asset": asset,
            },
            {
                "title": "Generator monthly preventive service",
                "description": "Perform monthly inspection and service checklist for the standby generator.",
                "priority": MaintenanceWorkOrder.Priority.CRITICAL,
                "status": MaintenanceWorkOrder.Status.COMPLETED,
                "requested_at": now - timedelta(days=2),
                "due_at": now - timedelta(hours=8),
                "scheduled_start_at": now - timedelta(days=1, hours=3),
                "scheduled_end_at": now - timedelta(days=1),
                "tenant": tenant,
                "organization": organization,
                "department": department,
                "building": building,
                "floor": floor,
                "area": area,
                "asset": asset,
            },
        ]

        for definition in work_order_definitions:
            existing_work_order = MaintenanceWorkOrder.objects.filter(
                tenant=tenant,
                requester=requester,
                title=definition["title"],
            ).first()
            if existing_work_order:
                continue

            target_status = definition.pop("status")
            work_order = create_work_order(requester=requester, data=definition)
            assign_work_order(
                work_order=work_order,
                assigned_to=assignee,
                assigned_by=requester,
                note="Seed maintenance assignment.",
            )
            if target_status == MaintenanceWorkOrder.Status.IN_PROGRESS:
                change_status(
                    work_order=work_order,
                    to_status=target_status,
                    changed_by=assignee,
                    note="Seed status adjustment.",
                )
            elif target_status == MaintenanceWorkOrder.Status.COMPLETED:
                complete_work_order(
                    work_order=work_order,
                    completed_by=assignee,
                    completion_notes="Seed completion notes.",
                    resolution_summary="Seed preventive maintenance completed successfully.",
                    downtime_minutes=45,
                    follow_up_required=False,
                )

            MaintenanceTask.objects.create(
                work_order=work_order,
                assigned_to=assignee,
                title="Inspect equipment condition",
                description="Perform the primary maintenance inspection step.",
                sequence=1,
                status=MaintenanceTask.Status.COMPLETED
                if work_order.status == MaintenanceWorkOrder.Status.COMPLETED
                else MaintenanceTask.Status.IN_PROGRESS,
                completed_at=now if work_order.status == MaintenanceWorkOrder.Status.COMPLETED else None,
                created_by=str(requester.id),
                updated_by=str(requester.id),
            )
            MaintenanceMaterial.objects.create(
                work_order=work_order,
                name="Standard maintenance kit",
                quantity="1.00",
                unit="kit",
                notes="Seed material entry.",
                created_by=str(requester.id),
                updated_by=str(requester.id),
            )
            MaintenanceLabor.objects.create(
                work_order=work_order,
                performed_by=assignee,
                description="Initial maintenance labor entry.",
                hours="2.50",
                labor_date=timezone.localdate(),
                created_by=str(assignee.id),
                updated_by=str(assignee.id),
            )
            MaintenanceAttachment.objects.create(
                work_order=work_order,
                uploaded_by=requester,
                file_name="seed-maintenance-checklist.txt",
                file_path="seed/maintenance/checklist.txt",
                content_type="text/plain",
                size_bytes=256,
                note="Seed attachment metadata only.",
                created_by=str(requester.id),
                updated_by=str(requester.id),
            )
            MaintenanceAISummary.objects.create(
                work_order=work_order,
                summary="Seed summary for maintenance work order context only.",
                model_name="seed-data",
                source_notes="AI automation is not active; this is a passive foundation record.",
                created_by=str(requester.id),
                updated_by=str(requester.id),
            )
            MaintenanceSupervisorApproval.objects.create(
                work_order=work_order,
                approved_by=requester,
                status=MaintenanceSupervisorApproval.Status.APPROVED,
                comments="Seed supervisor approval.",
                approved_at=now,
                created_by=str(requester.id),
                updated_by=str(requester.id),
            )
            MaintenanceEscalation.objects.create(
                work_order=work_order,
                escalated_by=requester,
                escalated_to=assignee,
                reason="Seed escalation visibility record.",
                level=MaintenanceEscalation.Level.LEVEL_1,
                is_active=work_order.status != MaintenanceWorkOrder.Status.COMPLETED,
                resolved_at=now if work_order.status == MaintenanceWorkOrder.Status.COMPLETED else None,
                created_by=str(requester.id),
                updated_by=str(requester.id),
            )
            created_work_orders += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded maintenance work order foundation records. Created {created_work_orders} new work orders."
            )
        )
