# FO-053 - Role Duplication and System Role Protection

## Summary

FO-053 adds secure role duplication to the existing global RBAC catalog and completes the feature-level system-role protection review. Authorized global administrators can use an active custom or system role as a read-only template. Every result is a new active custom role with a new immutable code, copied active permissions, and no user assignments.

## Endpoint Contract

`POST /api/access-control/roles/{role_id}/duplicate/`

Request:

```json
{
  "name": "Facilities Coordinator Copy",
  "code": "facilities-coordinator-copy",
  "description": "Optional replacement description"
}
```

- `name` and `code` are required.
- Names are trimmed and must remain non-blank.
- Codes reuse the role catalog validation and Django slug normalization rules and must be unique across active and inactive roles.
- `description` is optional. When omitted, the source description is copied; when supplied, the submitted value is used.
- Protected and unsupported fields are rejected explicitly: `is_system_role`, `is_active`, `permission_ids`, `user_ids`, `source_role_id`, `created_at`, and `updated_at`.

Success returns `201` with the normal role response: `id`, `name`, `code`, `description`, `is_system_role`, `is_active`, `created_at`, and `updated_at`.

## Authorization and Global Scope

The duplicate action uses the same mutation contract as role create, update, deactivation, and permission replacement:

- authenticated actor;
- active actor;
- `roles.manage`;
- global administrator scope through the existing Accounts scope service.

The API boundary and `duplicate_role` service both enforce this contract. Tenant-bound `roles.manage` actors without global scope receive `403`. The service remains authoritative for direct callers.

## Source and Result Rules

- Active custom roles may be duplicated.
- Active system roles may be used only as read-only templates.
- Inactive roles return controlled `400` responses.
- The duplicate is always a newly created active custom role.
- The source role is never reactivated or modified.
- Source metadata, timestamps, permission assignments, and user assignments remain unchanged.

## Permission Copy Behavior

The service selects source `RolePermission` rows only when both the assignment and its related `Permission` are active. It bulk-creates one active assignment per selected permission for the new role, preserving permission IDs exactly. Inactive assignments and assignments to inactive permissions are excluded. No source assignment is updated, reactivated, duplicated, or deleted.

## User Assignment Exclusion

`UserRole` rows are never queried for copying and are never created for the duplicate. Users assigned to the source retain exactly their prior effective permissions. The new role has no effective users until it is assigned through the existing User Role Assignment workflow.

## Transaction Safety

The complete operation runs inside `transaction.atomic`. Actor/source validation, normalized role creation, active permission selection, and assignment creation form one transaction. A role validation failure or assignment creation failure rolls back the new role and all new relationships, leaving no partial duplicate.

## System-Role Protection Verification

FO-053 does not add a system-role mutation endpoint. Existing protections remain unchanged:

- system roles cannot be updated;
- system roles cannot be deactivated;
- system-role permissions cannot be replaced;
- normal role creation rejects protected write fields;
- duplication rejects protected write fields and always forces `is_system_role=false` and `is_active=true`;
- using a system role as a source does not change its metadata, state, timestamps, permissions, or user assignments.

## Frontend Workflow

Active roles expose **Duplicate role** in the existing list and detail workflows when the actor has `roles.manage`. This includes active system roles because the source remains read-only. Inactive roles and actors without `roles.manage` do not receive the action.

The guarded route is `/admin/roles/{id}/duplicate`. It loads the dedicated role-detail query and displays source name, code, type, and status as read-only context. Defaults are:

- name: `<source name> Copy`;
- code: a normalized `<source code>-copy` suggestion;
- description: the source description.

The screen states that the result is custom and active, active permissions are copied, users are not copied, and the source is unchanged. It exposes no state, permission, or user controls. Backend errors map to the existing role form without clearing values, and pending submissions are disabled. Success populates the new role detail cache, invalidates role lists and the new assignment query, then navigates to the new role detail with a success message.

## Tests

Backend coverage verifies authentication, permission and global-scope enforcement, active/inactive actors and sources, custom and system templates, unique normalized codes, protected fields, description defaults and overrides, active-permission filtering, no `UserRole` copying, complete source immutability, transaction rollback, normal create protection, existing CRUD/permission assignment regressions, and seed idempotency.

Frontend helper coverage verifies duplicate defaults, normalized suggestions, metadata-only payloads, protected-field omission, description isolation, and action visibility for custom, system, inactive, and unauthorized states. The established test, lint, TypeScript, and production-build gates remain authoritative.

## Validation Results

- Django system check: passed with 0 issues.
- Migration drift check: passed with no changes detected.
- Access Control tests: 66 passed.
- Combined Accounts and Access Control tests: 109 passed.
- Full parallel backend regression: 250 passed.
- Frontend helper tests: 65 passed.
- ESLint: passed.
- TypeScript no-emit check: passed.
- Next.js production build: passed, including `/admin/roles/[id]/duplicate`.
- `git diff --check`: passed.

## Limitations

- Permission CRUD remains unavailable.
- Role reactivation remains unavailable.
- Tenant-scoped role catalogs are not introduced.
- The suggested duplicate code is not a reservation; backend uniqueness validation remains authoritative.
- User assignments must be added separately through the existing assignment workflow.
- Component/browser automation remains outside the current frontend test infrastructure.

FO-054 remains the final Roles & Permissions QA and stabilization milestone.
