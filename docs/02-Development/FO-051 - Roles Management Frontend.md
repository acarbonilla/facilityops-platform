# FO-051 - Roles Management Frontend

## Status

Complete

## Architecture and Reuse

FO-051 upgrades the existing FO-020 RBAC screens instead of adding a parallel administration area. It reuses the Admin navigation entry, authenticated API client, centralized RBAC query keys, permission guards, TanStack Query, React Hook Form, Zod, shared page states, data table, form fields, flash-message convention, and unsaved-changes prompt.

The backend remains authoritative. Frontend controls use `roles.view` and `roles.manage` as advisory visibility rules, but the current session does not expose enough active-role data to reproduce the backend's `system_admin` global-scope calculation safely. Consequently, users with `roles.manage` see relevant custom-role controls and receive the backend's clear `403` response if they lack global mutation scope.

## Routes

| Route | Permission | Purpose |
| ----- | ---------- | ------- |
| `/admin/roles` | `roles.view` | Paginated catalog with search, filters, ordering, and actions |
| `/admin/roles/new` | `roles.manage` | Create a custom global role |
| `/admin/roles/[id]` | `roles.view` | Read role metadata and status |
| `/admin/roles/[id]/edit` | `roles.manage` | Edit an active custom role's name and description |
| `/admin/permissions` | `roles.manage` | Existing read-only permission catalog |

The existing Roles sidebar item remains guarded by `roles.view`. Create Role is available from the roles screen and is not a separate navigation item.

## API and Query Integration

`getRoles` now preserves the FO-050 paginated response (`count`, `next`, `previous`, and `results`) instead of discarding metadata. `getRole` uses the reliable dedicated detail endpoint without the FO-020 list fallback. The existing RBAC API module also provides typed `createRole`, `updateRole`, and `deactivateRole` functions through the authenticated API client.

Central hooks provide paginated list/detail queries and create/update/deactivate mutations. Create invalidates role lists. Update invalidates lists and the affected detail. Deactivation invalidates role lists, the affected detail, current-user permission data, and cached per-user role-assignment queries without invalidating unrelated user, ticket, maintenance, or inspection data.

## Role List

The list displays Name, Code, Type, Status, Created, Updated, and Actions. Text labels distinguish System from Custom and Active from Inactive without relying on color. Backend query parameters provide:

- Search across name, code, and description.
- Exact system/custom and active/inactive filters.
- Ordering across supported name, code, system-role, active-state, creation, and update fields.
- Selectable 10, 20, 50, or 100 row pages.
- Previous and next controls driven by backend pagination metadata.

Loading, empty, backend-error, and route-level permission-denied states use existing shared components. Mutation controls never appear for system roles. Edit and Deactivate appear only for active custom roles with `roles.manage`.

## Create and Edit Forms

One reusable `RoleForm` supports both modes. Create accepts name, code, and optional description. Client validation trims required fields and permits only letters, numbers, spaces, underscores, and hyphens in codes. A live lowercase slug preview mirrors Django's documented slug behavior, while backend validation remains authoritative.

Edit accepts name and description only. Code is shown as a clearly labeled read-only reference and is omitted from update payloads. Neither mode exposes `is_system_role` or `is_active`. Backend name, code, description, and non-field errors map back into the form without clearing entered values. Pending submissions disable duplicate saves, and dirty forms use the established navigation and unload warning.

Direct navigation to a system-role edit route returns a protected read-only state and cannot submit a mutation. Inactive roles likewise do not expose an edit form because FO-051 has no reactivation workflow.

## Detail and System-Role Protection

The detail screen uses `GET /api/access-control/roles/{id}/` and displays name, code, description, type, status, created timestamp, and updated timestamp. A `404` renders a dedicated Role not found state. System roles show a protected-role notice and never show Edit or Deactivate. Active custom roles show those actions only with `roles.manage`.

Permission-assignment controls are intentionally absent. The detail screen states that permission assignment arrives in FO-052.

## Non-Destructive Deactivation

The accessible confirmation dialog consistently uses Deactivate terminology and explains that the role record remains stored, user-role and role-permission assignments become inactive, and reactivation is unavailable. The dialog supports initial keyboard focus and Escape dismissal, remains open on backend rejection, prevents duplicate submission, and displays the backend error. Successful deactivation refreshes role and permission-related data and displays a success message.

## Tests and Validation

Pure helper coverage verifies create and edit payload mapping, protected-field omission, backend-style code previews, action visibility for permissions/system/inactive states, parameter-sensitive query keys, and preservation of paginated response metadata. The existing frontend test runner is used without adding a component framework or dependency.

Validation includes frontend tests, ESLint, TypeScript, the production Next.js build, Django checks, focused access-control tests, migration drift detection, and `git diff --check`.

## Limitations

- Permission creation, editing, and deletion remain unavailable.
- Permission-to-role assignment remains pending FO-052.
- Role duplication remains pending FO-053.
- Role reactivation is unavailable.
- The frontend does not duplicate backend global-scope role-resolution logic.
- Component-level browser automation remains outside the current test infrastructure.

FO-052 - Permission Assignment Workflow remains the next milestone.
