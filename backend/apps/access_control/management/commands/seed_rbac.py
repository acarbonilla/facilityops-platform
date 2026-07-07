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
    ("fm_tickets", "view", "View FM tickets"),
    ("fm_tickets", "create", "Create FM tickets"),
    ("fm_tickets", "update", "Update FM tickets"),
    ("fm_tickets", "assign", "Assign FM tickets"),
    ("fm_tickets", "close", "Close FM tickets"),
    ("fm_tickets", "manage", "Manage FM tickets"),
    ("maintenance", "view", "View maintenance work orders"),
    ("maintenance", "create", "Create maintenance work orders"),
    ("maintenance", "update", "Update maintenance work orders"),
    ("maintenance", "assign", "Assign maintenance work orders"),
    ("maintenance", "complete", "Complete maintenance work orders"),
    ("maintenance", "manage", "Manage maintenance work orders"),
]

ROLE_PERMISSION_CODES = {
    "system_admin": {
        "users.view",
        "users.create",
        "users.update",
        "users.delete",
        "settings.view",
        "settings.manage",
        "roles.view",
        "roles.manage",
        "fm_tickets.view",
        "fm_tickets.create",
        "fm_tickets.update",
        "fm_tickets.assign",
        "fm_tickets.close",
        "fm_tickets.manage",
        "maintenance.view",
        "maintenance.create",
        "maintenance.update",
        "maintenance.assign",
        "maintenance.complete",
        "maintenance.manage",
    },
    "facility_manager": {
        "fm_tickets.view",
        "fm_tickets.create",
        "fm_tickets.update",
        "fm_tickets.assign",
        "fm_tickets.close",
        "maintenance.view",
        "maintenance.create",
        "maintenance.update",
        "maintenance.assign",
        "maintenance.complete",
    },
    "technician": {
        "fm_tickets.view",
        "fm_tickets.update",
        "maintenance.view",
        "maintenance.update",
    },
    "viewer": {
        "fm_tickets.view",
        "maintenance.view",
    },
}


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

        permissions_by_code = {
            permission.code: permission for permission in seeded_permissions
        }
        roles_by_code = {role.code: role for role in seeded_roles}
        for role_code, permission_codes in ROLE_PERMISSION_CODES.items():
            role = roles_by_code.get(role_code)
            if role is None:
                continue
            for permission_code in permission_codes:
                permission = permissions_by_code[permission_code]
                RolePermission.objects.update_or_create(
                    role=role,
                    permission=permission,
                    defaults={"is_active": True},
                )

        self.stdout.write(
            self.style.SUCCESS(
                "Seeded RBAC foundation roles, permissions, and assignments."
            )
        )
