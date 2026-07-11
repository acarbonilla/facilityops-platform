# FO-048 - Shared User Directory and Assignment Pickers

## Assignment-safe permission contract

The shared active-user directory is authorized separately from User Management:

| Method | Endpoint | Permission |
| ------ | -------- | ---------- |
| GET | `/api/users/` | `users.view` |
| GET | `/api/users/{id}/` | `users.view` |
| GET | `/api/users/directory/` | `users.directory` |

`users.directory` grants only the tenant-scoped, active-user directory action. It does not grant list, detail, create, update, delete, role assignment, staff-state, or password access. The response remains limited to `id`, `email`, `first_name`, `last_name`, `display_name`, `tenant`, `organization`, and `is_active`, with existing search, filtering, ordering, and pagination behavior preserved.

## Seeded role review

- `system_admin` receives `users.directory` because it is the seeded user-administration role and must explicitly carry both administrative and directory capabilities.
- `facility_manager` receives `users.directory` because it currently carries `maintenance.assign`, `inspection.assign`, and `inspection.manage_corrective_action`, covering maintenance assignee, inspection assignee, and corrective-action owner selection.
- `inspector`, `technician`, and `viewer` do not receive `users.directory` because their seeded permissions do not include these assignment-owner workflows.

The endpoint performs no hardcoded fallback checks for module assignment permissions. A custom role with `maintenance.assign` or `inspection.assign` must also be explicitly granted `users.directory` to use the directory.
