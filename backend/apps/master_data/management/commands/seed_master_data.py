from django.core.management.base import BaseCommand

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


class Command(BaseCommand):
    help = "Seed minimal development master data."

    def handle(self, *args, **options):
        tenant, _ = Tenant.objects.update_or_create(
            code="default",
            defaults={
                "name": "Default Tenant",
                "description": "Default development tenant.",
                "is_active": True,
            },
        )
        organization, _ = Organization.objects.update_or_create(
            tenant=tenant,
            code="default_org",
            defaults={
                "name": "Default Organization",
                "description": "Default development organization.",
                "is_active": True,
            },
        )
        Department.objects.update_or_create(
            organization=organization,
            code="facilities",
            defaults={
                "tenant": tenant,
                "name": "Facilities",
                "description": "Facilities department.",
                "is_active": True,
            },
        )
        building, _ = Building.objects.update_or_create(
            organization=organization,
            code="main_building",
            defaults={
                "tenant": tenant,
                "name": "Main Building",
                "address": "",
                "description": "Default development building.",
                "is_active": True,
            },
        )
        floor, _ = Floor.objects.update_or_create(
            building=building,
            code="ground_floor",
            defaults={
                "tenant": tenant,
                "name": "Ground Floor",
                "level_number": 0,
                "description": "Default development floor.",
                "is_active": True,
            },
        )
        area, _ = Area.objects.update_or_create(
            floor=floor,
            code="lobby",
            defaults={
                "tenant": tenant,
                "building": building,
                "name": "Lobby",
                "description": "Default development area.",
                "is_active": True,
            },
        )
        asset_type, _ = AssetType.objects.update_or_create(
            tenant=tenant,
            code="general_equipment",
            defaults={
                "name": "General Equipment",
                "description": "Default development asset type.",
                "is_active": True,
            },
        )
        Asset.objects.update_or_create(
            tenant=tenant,
            code="sample_asset",
            defaults={
                "organization": organization,
                "building": building,
                "floor": floor,
                "area": area,
                "asset_type": asset_type,
                "name": "Sample Asset",
                "serial_number": "",
                "description": "Default development asset.",
                "is_active": True,
            },
        )

        self.stdout.write(
            self.style.SUCCESS("Seeded master data foundation records.")
        )
