from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.inspection.models import (
    Inspection,
    InspectionCorrectiveAction,
    InspectionFinding,
    InspectionItem,
)
from apps.inspection.services.inspection_ai_service import upsert_ai_analysis
from apps.inspection.services.inspection_service import (
    assign_inspection,
    create_inspection,
    recalculate_inspection_sla,
)
from apps.master_data.models import Area, Building, Department, Floor, Organization, Tenant

User = get_user_model()


class Command(BaseCommand):
    help = "Seed minimal development 5S inspection data."

    def handle(self, *args, **options):
        tenant = Tenant.objects.first()
        organization = Organization.objects.filter(tenant=tenant).first() if tenant else None
        building = (
            Building.objects.filter(tenant=tenant, organization=organization).first()
            if tenant and organization
            else None
        )
        floor = (
            Floor.objects.filter(tenant=tenant, building=building).first()
            if tenant and building
            else None
        )
        area = (
            Area.objects.filter(tenant=tenant, building=building, floor=floor).first()
            if tenant and building and floor
            else None
        )
        department = (
            Department.objects.filter(tenant=tenant, organization=organization).first()
            if tenant and organization
            else None
        )

        if not all([tenant, organization, building]):
            self.stdout.write(
                self.style.ERROR(
                    "Master data seed records are required before seeding inspections."
                )
            )
            return

        inspector = User.objects.filter(tenant=tenant).order_by("created_at").first()
        if inspector is None:
            inspector = User.objects.create_user(
                email="inspection.inspector@example.com",
                password="Password123!",
                first_name="Inspection",
                last_name="Inspector",
                tenant=tenant,
                organization=organization,
            )

        supervisor = (
            User.objects.filter(tenant=tenant)
            .exclude(id=inspector.id)
            .order_by("created_at")
            .first()
        )
        if supervisor is None:
            supervisor = User.objects.create_user(
                email="inspection.supervisor@example.com",
                password="Password123!",
                first_name="Inspection",
                last_name="Supervisor",
                tenant=tenant,
                organization=organization,
            )

        created_count = 0
        seed_definitions = [
            {
                "title": "Weekly 5S inspection - lobby",
                "inspection_type": Inspection.InspectionType.ROUTINE,
                "five_s_category": Inspection.FiveSCategory.SHINE,
                "priority": Inspection.Priority.HIGH,
                "scheduled_date": timezone.now() + timedelta(hours=2),
                "remarks": "Seed inspection for backend validation.",
            },
            {
                "title": "Monthly 5S audit - storage room",
                "inspection_type": Inspection.InspectionType.AUDIT,
                "five_s_category": Inspection.FiveSCategory.STANDARDIZE,
                "priority": Inspection.Priority.MEDIUM,
                "scheduled_date": timezone.now() + timedelta(days=1),
                "remarks": "Seed audit inspection.",
            },
        ]

        for definition in seed_definitions:
            if Inspection.objects.filter(tenant=tenant, title=definition["title"]).exists():
                continue

            inspection = create_inspection(
                actor=inspector,
                data={
                    "tenant": tenant,
                    "organization": organization,
                    "department": department,
                    "building": building,
                    "floor": floor,
                    "area": area,
                    "inspector": inspector,
                    "supervisor": supervisor,
                    **definition,
                },
                items_data=[
                    {
                        "sequence": 1,
                        "checklist_item": "Area is free from unnecessary materials.",
                        "category": "Sort",
                        "expected_result": "Only required items remain in the area.",
                        "max_score": "5.00",
                        "score": "4.00",
                        "is_pass": True,
                        "observation": "One unused box remained near the cabinet.",
                    },
                    {
                        "sequence": 2,
                        "checklist_item": "Cleaning tools are properly labeled.",
                        "category": "Shine",
                        "expected_result": "Tools are labeled and stored in designated locations.",
                        "max_score": "5.00",
                        "score": "3.00",
                        "is_pass": False,
                        "observation": "Label missing on one mop handle.",
                    },
                ],
            )
            assign_inspection(
                inspection=inspection,
                actor=supervisor,
                inspector=inspector,
                supervisor=supervisor,
                note="Seed assignment.",
            )
            finding = InspectionFinding.objects.create(
                inspection=inspection,
                item=inspection.items.last(),
                finding_type=InspectionFinding.FindingType.NON_CONFORMANCE,
                severity=InspectionFinding.Severity.MEDIUM,
                description="Label missing from one cleaning tool.",
                recommendation="Replace the missing label and review storage checklist.",
                created_by=str(inspector.id),
                updated_by=str(inspector.id),
            )
            InspectionCorrectiveAction.objects.create(
                tenant=tenant,
                inspection=inspection,
                finding=finding,
                assigned_to=supervisor,
                due_date=timezone.now() + timedelta(days=3),
                status=InspectionCorrectiveAction.Status.OPEN,
                notes="Seed corrective action.",
                created_by=str(supervisor.id),
                updated_by=str(supervisor.id),
            )
            recalculate_inspection_sla(inspection=inspection)
            upsert_ai_analysis(
                inspection=inspection,
                actor=supervisor,
                summary="Seed 5S analysis summary.",
                analysis="Storage discipline is mostly compliant with one labeling gap.",
                recommendation_summary="Resolve the labeling issue and re-check within three days.",
                model_name="seed-data",
                source_notes="Static seed record only.",
            )
            created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded inspection foundation records. Created {created_count} new inspections."
            )
        )

