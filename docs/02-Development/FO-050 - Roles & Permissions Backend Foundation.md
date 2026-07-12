# FO-050 - Roles & Permissions Backend Foundation

## Status

Complete

## Architecture

FO-050 extends the existing global `access_control.Role` catalog without changing its schema. Roles have no tenant relationship, so catalog mutations are platform-wide operations. Read access remains permission-based, while writes require both `roles.manage` and the global-user scope already defined by User Management: an active superuser or an active user with an active `system_admin` role assignment.

Role domain operations live in `apps.access_control.services`. `create_role`, `update_role`, and `deactivate_role` independently enforce authentication, active-user status, `roles.manage`, global scope, system-role protection, code immutability, and transaction boundaries. Views repeat the global-scope guard for mutation requests so the API boundary and service boundary both enforce the catalog architecture.

## Endpoints and Permissions

| Method | Endpoint | Purpose | Required permission | Additional scope |
| ------ | -------- | ------- | ------------------- | ---------------- |
| GET | `/api/access-control/roles/` | Paginated role catalog | `roles.view` | None |
| POST | `/api/access-control/roles/` | Create a custom role | `roles.manage` | Global |
| GET | `/api/access-control/roles/{id}/` | Retrieve a role | `roles.view` | None |
| PUT | `/api/access-control/roles/{id}/` | Replace supported custom-role metadata | `roles.manage` | Global |
| PATCH | `/api/access-control/roles/{id}/` | Partially update custom-role metadata | `roles.manage` | Global |
| DELETE | `/api/access-control/roles/{id}/` | Soft-deactivate a custom role | `roles.manage` | Global |
| GET | `/api/access-control/permissions/` | Read the active permission catalog | `roles.manage` | Existing contract preserved |
| GET | `/api/access-control/me/permissions/` | Read the current user's effective RBAC data | Authenticated | None |

Basic role responses expose `id`, `name`, `code`, `description`, `is_system_role`, `is_active`, `created_at`, and `updated_at`. They do not expose `RolePermission`, `UserRole`, or permission-assignment internals.

## Role Creation and Update

Creation accepts only `name`, `code`, and optional `description`. Names are trimmed and cannot be blank. Codes accept letters, numbers, spaces, underscores, and hyphens, then use Django's slug convention to produce a deterministic lowercase code. Blank, malformed, and duplicate normalized codes return controlled `400` responses. Every API-created role is active and has `is_system_role=false`; attempts to submit protected state fields are rejected.

Custom-role names and descriptions can be updated. A role code is an immutable identifier after creation: supplying the existing normalized code is compatible with full replacement, while attempting to change it returns `400`. `is_system_role`, `is_active`, `created_at`, and `updated_at` are not writable. Deactivation is available only through `DELETE`; reactivation is outside FO-050.

## System-Role Protection

Roles seeded with `is_system_role=true` remain readable to actors with `roles.view`, but no metadata can be changed and they cannot be deactivated. Service-layer checks protect this rule even when a service is called outside the viewset.

## Soft Deactivation

`DELETE` is non-destructive and idempotent. In one transaction it:

1. Sets the custom role's `is_active` flag to false.
2. Sets every active `RolePermission` for the role to inactive.
3. Sets every active `UserRole` for the role to inactive.

No `Role`, `RolePermission`, or `UserRole` row is deleted. Cascading soft deactivation ensures a future role-reactivation feature cannot silently restore old permission or user assignments. Existing effective-permission resolution continues to ignore inactive roles and inactive assignment rows, and User Management's role-assignment contracts are unchanged.

## List Query Contract

The role list uses `StandardResultsSetPagination` (20 records by default, with `page` and bounded `page_size` support). It supports:

- Search across `name`, `code`, and `description` with `search`.
- Exact Boolean filters `is_system_role` and `is_active`.
- Ordering by `name`, `code`, `is_system_role`, `is_active`, `created_at`, or `updated_at` with `ordering`.
- Deterministic default ordering by name.

The existing frontend API adapter accepts the new paginated response and continues returning its established role-array contract to current consumers.

## Tests and Validation

Backend coverage includes unauthenticated and unauthorized reads, pagination, search, both exact filters, ordering, mutation permission checks, tenant-bound manager rejection at API and service boundaries, superuser and active-system-administrator creation, inactive-user rejection, normalization, validation and duplicate handling, protected fields, custom metadata updates, code immutability, system-role protection, idempotent soft deletion, related-assignment soft deactivation, compatibility endpoints, and RBAC seed idempotency.

Validation completed with Django system checks, migration drift detection, focused access-control tests, combined account/access-control tests, the full parallel backend suite, frontend static checks for the compatibility adapter, and `git diff --check`.

## Limitations

- Permission records remain read-only; Permission CRUD is pending.
- FO-053 extends this service architecture with atomic active-role duplication while preserving the same authorization and protected-field rules.
- Role reactivation is not provided.
- Roles remain a global catalog; tenant-scoped roles require a separately approved schema design.
- FO-053 verifies the system-role protections and permits active system roles only as read-only duplication templates; every duplicate remains custom.
