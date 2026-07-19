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
    ("users", "directory", "View assignment-safe user directory"),
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
    ("maintenance", "submit", "Submit maintenance work orders"),
    ("maintenance", "assign", "Assign maintenance work orders"),
    ("maintenance", "reassign", "Reassign maintenance work orders"),
    ("maintenance", "unassign", "Unassign maintenance work orders"),
    ("maintenance", "view_assignment", "View maintenance assignment history"),
    ("maintenance.work_order", "assign", "Assign maintenance work orders"),
    ("maintenance.work_order", "reassign", "Reassign maintenance work orders"),
    ("maintenance.work_order", "unassign", "Unassign maintenance work orders"),
    (
        "maintenance.work_order",
        "view_assignment",
        "View maintenance assignment history",
    ),
    ("maintenance", "view_sla", "View maintenance SLA"),
    ("maintenance", "recalculate_sla", "Recalculate maintenance SLA"),
    ("maintenance", "view_escalation", "View maintenance escalations"),
    ("maintenance", "acknowledge_escalation", "Acknowledge maintenance escalations"),
    ("maintenance", "resolve_escalation", "Resolve maintenance escalations"),
    ("maintenance.work_order", "view_sla", "View maintenance SLA"),
    ("maintenance.work_order", "recalculate_sla", "Recalculate maintenance SLA"),
    ("maintenance.work_order", "view_escalation", "View maintenance escalations"),
    ("maintenance.work_order", "acknowledge_escalation", "Acknowledge maintenance escalations"),
    ("maintenance.work_order", "resolve_escalation", "Resolve maintenance escalations"),
    ("maintenance", "start", "Start maintenance work orders"),
    ("maintenance", "hold", "Place maintenance work orders on hold"),
    ("maintenance", "resume", "Resume maintenance work orders"),
    ("maintenance", "complete", "Complete maintenance work orders"),
    ("maintenance", "cancel", "Cancel maintenance work orders"),
    ("maintenance", "reopen", "Reopen maintenance work orders"),
    ("maintenance.work_order", "view", "View maintenance work orders"),
    ("maintenance.work_order", "create", "Create maintenance work orders"),
    ("maintenance.work_order", "update", "Update maintenance work orders"),
    ("maintenance.work_order", "submit", "Submit maintenance work orders"),
    ("maintenance.work_order", "start", "Start maintenance work orders"),
    ("maintenance.work_order", "hold", "Place maintenance work orders on hold"),
    ("maintenance.work_order", "resume", "Resume maintenance work orders"),
    ("maintenance.work_order", "complete", "Complete maintenance work orders"),
    ("maintenance.work_order", "cancel", "Cancel maintenance work orders"),
    ("maintenance.work_order", "reopen", "Reopen maintenance work orders"),
    ("maintenance", "manage", "Manage maintenance work orders"),
    ("inspection", "view", "View inspections"),
    ("inspection", "create", "Create inspections"),
    ("inspection", "update", "Update inspections"),
    ("inspection", "delete", "Delete inspections"),
    ("inspection", "complete", "Complete inspections"),
    ("inspection", "verify", "Verify inspections"),
    ("inspection", "assign", "Assign inspections"),
    ("inspection", "view_ai", "View inspection AI analysis"),
    (
        "inspection",
        "manage_corrective_action",
        "Manage inspection corrective actions",
    ),
    ("inspection", "manage", "Manage inspections"),
    ("reporting", "view", "View operational reporting"),
]

ROLE_PERMISSION_CODES = {
    "system_admin": {
        "users.view",
        "users.directory",
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
        "maintenance.submit",
        "maintenance.assign",
        "maintenance.reassign",
        "maintenance.unassign",
        "maintenance.view_assignment",
        "maintenance.work_order.assign",
        "maintenance.work_order.reassign",
        "maintenance.work_order.unassign",
        "maintenance.work_order.view_assignment",
        "maintenance.view_sla",
        "maintenance.recalculate_sla",
        "maintenance.view_escalation",
        "maintenance.acknowledge_escalation",
        "maintenance.resolve_escalation",
        "maintenance.work_order.view_sla",
        "maintenance.work_order.recalculate_sla",
        "maintenance.work_order.view_escalation",
        "maintenance.work_order.acknowledge_escalation",
        "maintenance.work_order.resolve_escalation",
        "maintenance.start",
        "maintenance.hold",
        "maintenance.resume",
        "maintenance.complete",
        "maintenance.cancel",
        "maintenance.reopen",
        "maintenance.work_order.view",
        "maintenance.work_order.create",
        "maintenance.work_order.update",
        "maintenance.work_order.submit",
        "maintenance.work_order.start",
        "maintenance.work_order.hold",
        "maintenance.work_order.resume",
        "maintenance.work_order.complete",
        "maintenance.work_order.cancel",
        "maintenance.work_order.reopen",
        "maintenance.manage",
        "inspection.view",
        "inspection.create",
        "inspection.update",
        "inspection.delete",
        "inspection.complete",
        "inspection.verify",
        "inspection.assign",
        "inspection.view_ai",
        "inspection.manage_corrective_action",
        "inspection.manage",
        "reporting.view",
    },
    "facility_manager": {
        "users.directory",
        "settings.view",
        "fm_tickets.view",
        "fm_tickets.create",
        "fm_tickets.update",
        "fm_tickets.assign",
        "fm_tickets.close",
        "maintenance.view",
        "maintenance.create",
        "maintenance.update",
        "maintenance.submit",
        "maintenance.assign",
        "maintenance.reassign",
        "maintenance.unassign",
        "maintenance.view_assignment",
        "maintenance.work_order.assign",
        "maintenance.work_order.reassign",
        "maintenance.work_order.unassign",
        "maintenance.work_order.view_assignment",
        "maintenance.view_sla",
        "maintenance.recalculate_sla",
        "maintenance.view_escalation",
        "maintenance.acknowledge_escalation",
        "maintenance.resolve_escalation",
        "maintenance.work_order.view_sla",
        "maintenance.work_order.recalculate_sla",
        "maintenance.work_order.view_escalation",
        "maintenance.work_order.acknowledge_escalation",
        "maintenance.work_order.resolve_escalation",
        "maintenance.start",
        "maintenance.hold",
        "maintenance.resume",
        "maintenance.complete",
        "maintenance.cancel",
        "maintenance.reopen",
        "maintenance.work_order.view",
        "maintenance.work_order.create",
        "maintenance.work_order.update",
        "maintenance.work_order.submit",
        "maintenance.work_order.start",
        "maintenance.work_order.hold",
        "maintenance.work_order.resume",
        "maintenance.work_order.complete",
        "maintenance.work_order.cancel",
        "maintenance.work_order.reopen",
        "inspection.view",
        "reporting.view",
    },
    "technician": {
        "fm_tickets.view",
        "fm_tickets.update",
        "maintenance.view",
        "maintenance.view_assignment",
        "maintenance.work_order.view_assignment",
        "maintenance.view_sla",
        "maintenance.view_escalation",
        "maintenance.acknowledge_escalation",
        "maintenance.resolve_escalation",
        "maintenance.work_order.view_sla",
        "maintenance.work_order.view_escalation",
        "maintenance.work_order.acknowledge_escalation",
        "maintenance.work_order.resolve_escalation",
        "maintenance.update",
        "maintenance.start",
        "maintenance.hold",
        "maintenance.resume",
        "maintenance.complete",
        "maintenance.work_order.view",
        "maintenance.work_order.update",
        "maintenance.work_order.start",
        "maintenance.work_order.hold",
        "maintenance.work_order.resume",
        "maintenance.work_order.complete",
        "inspection.view",
        "inspection.update",
        "inspection.complete",
        "inspection.view_ai",
    },
    "viewer": {
        "fm_tickets.view",
        "maintenance.view",
        "maintenance.work_order.view",
        "inspection.view",
        "reporting.view",
    },
}

REVOKED_ROLE_PERMISSION_CODES = {
    "facility_manager": {
        "inspection.create",
        "inspection.update",
        "inspection.complete",
        "inspection.verify",
        "inspection.assign",
        "inspection.view_ai",
        "inspection.manage_corrective_action",
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
        for role_code, permission_codes in REVOKED_ROLE_PERMISSION_CODES.items():
            role = roles_by_code.get(role_code)
            if role is not None:
                RolePermission.objects.filter(
                    role=role,
                    permission__code__in=permission_codes,
                ).update(is_active=False)
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
