from django.core.management.base import BaseCommand

from apps.access_control.models import Permission, Role, RolePermission


ROLE_DEFINITIONS = [
    {
        "name": "System Administrator",
        "code": "system_admin",
        "description": "Full access to foundation platform administration.",
        "is_system_role": True,
    },
    {
        "name": "Facility Manager",
        "code": "facility_manager",
        "description": "Foundation facility management role.",
        "is_system_role": True,
    },
    {
        "name": "Inspector",
        "code": "inspector",
        "description": "Foundation inspection role.",
        "is_system_role": True,
    },
    {
        "name": "Technician",
        "code": "technician",
        "description": "Foundation technician role.",
        "is_system_role": True,
    },
    {
        "name": "Viewer",
        "code": "viewer",
        "description": "Read-only foundation role.",
        "is_system_role": True,
    },
]

PERMISSION_DEFINITIONS = [
    ("users", "view", "View users"),
    ("users", "create", "Create users"),
    ("users", "update", "Update users"),
    ("users", "delete", "Delete users"),
    ("settings", "view", "View settings"),
    ("settings", "manage", "Manage settings"),
    ("roles", "view", "View roles"),
    ("roles", "manage", "Manage roles"),
]


class Command(BaseCommand):
    help = "Seed the RBAC foundation roles and permissions."

    def handle(self, *args, **options):
        seeded_roles = []
        for role_definition in ROLE_DEFINITIONS:
            role, _ = Role.objects.update_or_create(
                code=role_definition["code"],
                defaults={
                    **role_definition,
                    "is_active": True,
                },
            )
            seeded_roles.append(role)

        seeded_permissions = []
        for module, action, name in PERMISSION_DEFINITIONS:
            permission, _ = Permission.objects.update_or_create(
                code=f"{module}.{action}",
                defaults={
                    "name": name,
                    "module": module,
                    "action": action,
                    "description": f"Foundation permission for {module} {action}.",
                    "is_active": True,
                },
            )
            seeded_permissions.append(permission)

        system_admin_role = Role.objects.get(code="system_admin")
        for permission in seeded_permissions:
            RolePermission.objects.update_or_create(
                role=system_admin_role,
                permission=permission,
                defaults={"is_active": True},
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Seeded RBAC foundation roles, permissions, and assignments."
            )
        )
