# FO-052 - Permission Assignment Workflow

## Status

Complete

## Objective

FO-052 implements secure, dedicated role-permission assignment for the global RBAC catalog. Authorized global administrators can read a role's effective active assigned permissions and atomically replace the active permission set for active custom roles.

The implementation preserves all prior contracts:

- Permission remains a global, seeded, read-only catalog.
- RolePermission remains the only role-to-permission assignment table.
- Role create/update payloads do not accept permission IDs.
- Assignment removal is soft (`is_active=false`) rather than hard delete.
- Existing inactive assignment rows are reactivated instead of duplicated.

## Endpoint Contracts

### GET /api/access-control/roles/{role_id}/permissions/

Purpose:

- Return the role and currently active assigned permissions.

Authorization:

- Authenticated active actor with `roles.view`.
- Read does not require global scope.

Response shape:

- `role`: compact role reference (`id`, `name`, `code`, `description`, `is_system_role`, `is_active`)
- `assigned_permissions`: active permissions only, sorted by `module`, `action`, `name`

### PUT /api/access-control/roles/{role_id}/permissions/

Purpose:

- Atomically replace the complete active permission set for an active custom role.

Authorization:

- Authenticated active actor with `roles.manage` plus global scope.
- Service-layer enforcement remains authoritative.
- Tenant-bound `roles.manage` actors without global scope receive `403`.

Request shape:

```json
{
  "permission_ids": [
    "permission-uuid-1",
    "permission-uuid-2"
  ]
}
```

Response shape:

- Same as GET, with updated active assignments.

## Role and Mutation Rules

- System roles are readable but immutable for assignment mutation under FO-052.
- Inactive custom roles cannot be mutated.
- PUT does not change role metadata (`name`, `code`, `description`, `is_active`, `is_system_role`).
- PUT does not modify UserRole rows.

## Validation Rules

`permission_ids`:

- Required list of UUID values.
- Empty list is valid and deactivates all current active assignments.
- Duplicate IDs are rejected with `400`.
- Malformed UUID values are rejected with `400`.
- Unknown permission IDs are rejected with `400`.
- Inactive permission IDs are rejected with `400`.
- Full request validation occurs before any RolePermission mutation.

## Atomic Replacement Behavior

Replacement executes in `transaction.atomic`:

- Keep existing active RolePermission rows for unchanged requested IDs.
- Reactivate existing inactive rows for requested IDs.
- Create RolePermission rows only when no row exists.
- Deactivate currently active rows omitted from `permission_ids`.
- Never hard-delete RolePermission rows.

The unique `(role, permission)` relationship remains intact.

## Effective Permission Propagation

FO-052 preserves `get_user_permission_codes()` semantics:

- Users assigned to the updated role gain newly active permissions on next resolution.
- Users lose removed permissions from the edited role on next resolution.
- Inactive RolePermission rows remain ignored.
- Permissions still granted by another active role remain effective.

## Frontend Workflow

The existing role detail flow is upgraded in place:

- Assigned permissions are shown in role detail grouped by module.
- Group entries show permission name, code, action, and description.
- Empty assigned state is explicit.
- Manage Permissions action is shown only for active custom roles and actors with `roles.manage`.
- Manage action is hidden for system and inactive roles.

Manage Permissions dialog behavior:

- Reuses existing permission catalog endpoint.
- Groups available permissions by module.
- Supports search over name, code, module, action, and description.
- Initializes selections from assigned permissions.
- Submits complete unique `permission_ids` set via PUT.
- Supports Select all visible and Clear all visible.
- Preserves selection state on backend validation failure.
- Prevents duplicate submissions while pending.
- Displays backend field and non-field validation errors.
- Warns clearly when saving an empty selection.

## Query and Cache Behavior

Added RBAC query key and API/hook coverage for role-permission assignments:

- Query key: role-permission assignment per role
- API functions: `getRolePermissions(roleId)`, `replaceRolePermissions(roleId, payload)`
- Hook coverage for query and mutation

Successful replacement invalidates:

- The affected role-permission assignment query
- The role detail query
- Current-user permission query
- User role-assignment-related permission caches

Unrelated module queries are not invalidated.

## Tests and Validation

Backend coverage includes:

- 401 for unauthenticated GET/PUT
- GET authorization (`roles.view`)
- PUT authorization (`roles.manage` + global scope)
- Tenant-bound mutation rejection
- System-role and inactive-role mutation rejection
- Unknown/inactive/duplicate/malformed permission ID rejection
- Empty payload deactivation behavior
- create/reactivate/deactivate/no-duplicate replacement behavior
- invalid-input atomicity
- direct service scope enforcement
- effective permission gain/loss behavior including multi-role preservation
- no hard-delete behavior

Frontend helper coverage includes:

- assigned selection initialization
- unique replacement payload
- module grouping stability
- search matching across all required fields
- visible-only select/clear behavior
- empty selection payload behavior
- manage-action visibility rules for permission, system-role, and inactive-role states

Validation gates executed:

- Backend: `check`, `makemigrations --check --dry-run`, targeted suites, and full parallel suite
- Frontend: tests, ESLint, TypeScript no-emit, and production build
- Repository: `git diff --check` and `git status`

## Out of Scope

- Permission CRUD endpoints
- Assignment via role create/update payloads
- Role duplication and reactivation
- Tenant-scoped role catalogs
- UserRole mutation during permission replacement
