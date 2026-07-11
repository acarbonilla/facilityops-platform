# FO-046 - User Management Frontend Screens

## Status

Complete

## Purpose

FO-046 delivers the frontend user-management workflow on top of the FO-045 backend contract. The scope covers protected, permission-aware list, detail, create, and edit screens for tenant-scoped account administration, plus non-destructive deactivation controls.

## Routes Implemented

- `/admin/users`
- `/admin/users/new`
- `/admin/users/[id]`
- `/admin/users/[id]/edit`

Each route is wrapped with the existing protected permission route pattern:

- list and detail require `users.view`
- create requires `users.create`
- edit requires `users.update`

## Frontend Architecture

The implementation follows the existing Next.js app-router structure and reuses the shared frontend layers already established in the repository:

- `frontend/services/api/users.ts` for typed API access through the shared API client
- `frontend/services/api/query-keys.ts` for centralized React Query keys
- `frontend/hooks/use-users.ts` for list, detail, directory, create, update, deactivate, and form-option hooks
- `frontend/lib/users/form.ts` for display helpers, payload mapping, defaults, flash messaging, and permission helpers
- `frontend/lib/validations/users.ts` for Zod validation shared by create and edit
- `frontend/features/admin/users/components/*` for list, detail, form, and deactivation UI

No second HTTP client was introduced, and page components do not call `fetch` or `axios` directly.

## API Integration

The frontend integrates with the FO-045 endpoints:

- `GET /api/users/`
- `POST /api/users/`
- `GET /api/users/{id}/`
- `PATCH /api/users/{id}/`
- `DELETE /api/users/{id}/`
- `GET /api/users/directory/`

List requests support the required backend-driven query parameters:

- `page`
- `page_size`
- `search`
- `tenant`
- `organization`
- `is_active`
- `is_staff`
- `ordering`

Mutations invalidate only the user-management query space. Update refreshes list, detail, and directory caches. Deactivation refreshes list and detail data, and create refreshes user lists through the shared `usersQueryKeys` namespace.

## Permission Behavior

- The Users navigation entry remains permission-aware through `users.view`.
- `Create User` is shown only when the session has `users.create`.
- `Edit` is shown only when the session has `users.update`.
- `Deactivate` is shown only when the session has `users.delete` and the target is not the authenticated user.
- The detail screen mirrors the same action gating as the list screen.
- Self-deactivation controls stay hidden in both list and detail views.

## Screen Behavior

### List

The user list screen provides:

- backend-driven search for email, first name, and last name
- filters for tenant, organization, active status, and staff status
- organization options filtered by the selected tenant
- backend ordering controls
- paginated table results with shared loading, empty, and error states
- display-name fallback to email when both name fields are blank

### Detail

The detail screen renders only the supported safe fields:

- full name
- email
- tenant
- organization
- active status
- staff status
- created timestamp
- updated timestamp

It intentionally excludes passwords, roles, groups, permissions, last login, and superuser fields. Missing or inaccessible records are surfaced as not found or inaccessible without disclosing cross-tenant data.

### Create and Edit

Create and edit share one reusable `UserForm` component. The form uses React Hook Form with the repository's Zod validation pattern.

Behavior delivered:

- password and confirm-password are required on create
- password is optional on edit
- empty edit passwords are omitted from the PATCH payload
- password confirmation mismatch is rejected client-side
- empty tenant and organization values normalize to `null`
- disabled tenant selectors do not control the submitted tenant value for tenant-bound administrators
- tenant-bound submissions explicitly preserve the authenticated tenant even if the disabled form control omits the tenant field
- organization options are filtered by the selected tenant
- organization is cleared when a tenant change makes the existing organization invalid
- tenant-bound administrators default to their tenant and are not encouraged to switch tenants
- `is_staff` is rendered only for globally scoped staff sessions under the repository's current convention
- backend field errors map onto matching form controls
- non-field API errors render in the form-level error area
- successful create and edit flows redirect to detail with one-time flash messaging

## Activation and Deactivation

`DELETE /api/users/{id}/` is presented as deactivation only. The confirmation dialog explicitly states that the account is not permanently deleted. Deactivation success triggers user-facing feedback and query refreshes.

Activation remains available through edit when the session can update `is_active`.

## Tests

Focused frontend tests remain lib-level because the repository does not yet provide a dedicated component-test harness for admin screens.

Covered helper and validation tests:

- create payload includes password and normalizes empty tenant and organization to `null`
- edit payload omits an empty password
- UUID normalization safely handles `undefined`, `null`, empty, whitespace-only, and trimmed UUID input
- tenant-bound submissions preserve the authenticated tenant when the disabled tenant control omits or conflicts with form data
- globally scoped administrators preserve their selected tenant value on submit
- password-confirmation mismatch fails frontend validation
- display-name fallback uses email when names are blank
- permission helpers hide create, edit, and deactivate actions without the required permissions
- self-deactivation remains hidden even with `users.delete`

## Validation Results

Frontend:

- `npm run lint` - passed
- `npx tsc --noEmit` - passed
- `npm run test` - passed
- `npm run build` - passed

Backend compatibility:

- `python manage.py check` - passed
- `python manage.py test apps.accounts --keepdb --noinput` - passed

Repository hygiene:

- `git diff --check` - passed with line-ending warnings only

## Limitations

- No dedicated frontend component or browser-test harness exists yet, so validation is limited to helper tests plus lint, typecheck, build, and backend compatibility checks.
- Role assignment remains out of scope for FO-046 and stays pending for FO-047.
- Cross-module user-assignment pickers remain out of scope for FO-048.
- Any broader user-management milestone should remain in progress until FO-049 is complete.

## Result

FO-046 completes the user-management frontend screens for the current scope: authorized users can list, inspect, create, edit, activate, and deactivate accounts through the shared FacilityOps frontend architecture while preserving tenant scope, RBAC gating, safe-field rendering, and backend-authoritative validation.