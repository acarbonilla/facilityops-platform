from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.master_data.models import Area, Asset, Building, Department, Floor, Organization, Tenant

from apps.fm_tickets.models import FmTicket
from apps.fm_tickets.services import add_ticket_comment, assign_ticket, change_ticket_status, create_ticket


User = get_user_model()


class Command(BaseCommand):
    help = "Seed minimal development FM ticketing data."

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
            organization = (
                Organization.objects.filter(tenant=tenant).first() if tenant else None
            )
            building = (
                Building.objects.filter(
                    tenant=tenant,
                    organization=organization,
                ).first()
                if tenant and organization
                else None
            )
            floor = Floor.objects.filter(
                tenant=tenant,
                building=building,
            ).first() if tenant and building else None
            area = Area.objects.filter(
                tenant=tenant,
                building=building,
                floor=floor,
            ).first() if tenant and building and floor else None

        if not all([tenant, organization, building]):
            raise CommandError(
                "Master data seed records are required before seeding FM tickets."
            )

        department = Department.objects.filter(
            tenant=tenant,
            organization=organization,
        ).first()
        if asset is None:
            asset = Asset.objects.filter(
                tenant=tenant,
                organization=organization,
                building=building,
            ).first()

        requester = User.objects.order_by("created_at").first()
        if requester is None:
            raise CommandError("At least one user is required before seeding FM tickets.")

        assignee = User.objects.exclude(id=requester.id).order_by("created_at").first()
        created_tickets = 0

        ticket_definitions = [
            {
                "title": "Lobby lighting issue",
                "description": "Several lobby lights are flickering and need inspection.",
                "category": FmTicket.Category.ELECTRICAL,
                "priority": FmTicket.Priority.HIGH,
                "status": FmTicket.Status.OPEN,
                "source": FmTicket.Source.ADMIN,
                "tenant": tenant,
                "organization": organization,
                "department": department,
                "building": building,
                "floor": floor,
                "area": area,
                "asset": asset,
            },
            {
                "title": "Restroom plumbing leak",
                "description": "Reported water leak near the public restroom sink.",
                "category": FmTicket.Category.PLUMBING,
                "priority": FmTicket.Priority.URGENT,
                "status": FmTicket.Status.IN_PROGRESS,
                "source": FmTicket.Source.WEB,
                "tenant": tenant,
                "organization": organization,
                "department": department,
                "building": building,
                "floor": floor,
                "area": area,
                "asset": None,
            },
        ]

        for definition in ticket_definitions:
            existing_ticket = FmTicket.objects.filter(
                tenant=tenant,
                requester=requester,
                title=definition["title"],
            ).first()
            if existing_ticket:
                continue

            initial_status = definition.pop("status")
            ticket = create_ticket(requester=requester, data=definition)
            if assignee:
                assign_ticket(
                    ticket=ticket,
                    assigned_to=assignee,
                    assigned_by=requester,
                    note="Seed assignment.",
                )
            add_ticket_comment(
                ticket=ticket,
                author=requester,
                body="Seeded sample ticket comment.",
                is_internal=False,
            )
            if initial_status != ticket.status:
                change_ticket_status(
                    ticket=ticket,
                    to_status=initial_status,
                    changed_by=requester,
                    note="Seed status adjustment.",
                )
            created_tickets += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded FM ticket foundation records. Created {created_tickets} new tickets."
            )
        )
