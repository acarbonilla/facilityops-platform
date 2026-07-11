# FO-047 - User Role Assignment Workflow

## Status

Complete

## Purpose

FO-047 delivers a secure user-role assignment workflow across backend and frontend layers. Authorized administrators can view a user's assigned roles and replace role assignments while preserving tenant isolation and preventing tenant-bound privilege escalation to global system-administrator authority.

## Scope Delivered

- backend endpoint support for reading and replacing user role assignments
- service-layer authorization and tenant-scope enforcement for role assignment
- protection against assignment of inactive, unknown, duplicate, and unauthorized roles
- explicit prevention of tenant administrators granting `system_admin` authority
- frontend role-assignment section on user detail with permission-aware controls
- frontend role-assignment dialog with selection, validation feedback, and submit flow
- helper-level frontend tests for role-assignment payload and visibility logic
- backend workflow tests for access control, replacement behavior, and security rules

## Backend Implementation

### API Contract

`apps.accounts.views.UserViewSet` now exposes a `roles` detail action at:

- `GET /api/users/{id}/roles/`
- `PUT /api/users/{id}/roles/`

The action uses service-level permission and scope enforcement and returns role assignment data in a frontend-friendly shape.

Permission contract for the endpoint methods is intentionally split:

- `GET /api/users/{id}/roles/` requires both `users.view` and `roles.view`
- `PUT /api/users/{id}/roles/` requires `roles.manage` and does not require the GET read permissions

To enforce this contract safely, mutation responses are built by an internal response-data helper that does not re-run GET authorization checks.

### Serializers

`apps.accounts.serializers` adds dedicated serializers for role-assignment read and write flows:

- user summary serializer for the target account
- assigned-role serializer with role metadata
- read serializer for current assignments
- write serializer with `role_ids` validation including duplicate detection

### Service Logic

`apps.accounts.services` adds role-assignment workflow methods that enforce:

- authenticated and active actor requirements
- permission requirements for role visibility and role management
- tenant-aware target-user visibility and cross-tenant rejection
- manageable-role filtering based on actor global scope
- invalid role rejection for unknown or inactive roles
- duplicate role rejection in replacement payloads
- prohibition on tenant-bound assignment of `is_system_role` roles
- self-protection guard preventing removal of the actor's final active `system_admin` assignment
- atomic replacement semantics that reactivate existing assignments and soft-deactivate removed assignments

The service also separates response-data construction from GET authorization. The read service validates `users.view` plus `roles.view`, while the replace service validates `roles.manage` and then returns the same response schema through a shared private builder.

### Tests

`apps.accounts.tests.UserRoleAssignmentWorkflowTests` covers:

- read and replace authorization requirements
- tenant isolation and hidden cross-tenant behavior
- inactive, unknown, and duplicate role ID handling
- replacement reactivation and deactivation behavior
- global-role escalation restrictions for tenant-bound administrators
- self-role-change safety guard for final system-admin assignment
- permission reflection behavior after role updates

## Frontend Implementation

### Types and API

- `frontend/types/users.ts` adds role-assignment domain types
- `frontend/services/api/endpoints.ts` adds a `users.roles(id)` endpoint helper
- `frontend/services/api/users.ts` adds role-assignment fetch and replace functions with response normalization

### Hooks and Helpers

- `frontend/hooks/use-users.ts` adds role-assignment query and mutation hooks
- `frontend/lib/users/roles.ts` adds pure helpers for:
  - section visibility checks
  - selected-role initialization from assignments
  - unique replacement payload creation
  - tenant-bound filtering of system roles

### UI Integration

- `frontend/features/admin/users/components/user-role-assignment-dialog.tsx` provides an accessible manage-roles dialog
- `frontend/features/admin/users/components/user-detail-screen.tsx` now renders:
  - assigned-roles section
  - permission-aware `Manage Roles` action
  - mutation wiring and backend error handling
  - `refreshPermissions()` when the authenticated user changes their own roles

## Validation Results

Backend:

- `python manage.py check` - passed
- `python manage.py makemigrations --check --dry-run` - passed
- `python manage.py test apps.accounts apps.access_control --keepdb --noinput` - passed
- `python manage.py test --parallel 4 --keepdb --noinput` - passed (`Ran 200 tests ... OK`)

Frontend:

- `npm run test` - passed
- `npm run lint` - passed
- `npx tsc --noEmit` - passed
- `npm run build` - passed

Repository hygiene:

- `git diff --check` - passed with line-ending warnings only

## Security Notes

- Role assignment is never tenant-trusting from client input; backend service logic is authoritative.
- Tenant-bound administrators cannot grant global system roles.
- Cross-tenant target users are treated as inaccessible by the assignment workflow.
- Role updates are idempotent and non-destructive through active-flag toggling of assignment rows.

## Limitations

- Role assignment currently supports full replacement semantics only; granular add/remove mutation endpoints are not part of FO-047.
- Frontend coverage remains helper-level; no dedicated component test harness exists yet.
- Shared user directory pickers for broader assignment workflows remain scoped to FO-048.

## Result

FO-047 is complete: authorized administrators can safely view and manage user role assignments through a tenant-isolated, permission-aware workflow with backend-enforced escalation controls and validated frontend integration.