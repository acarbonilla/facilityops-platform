# FO-013 - Frontend RBAC and Navigation Guard Foundation

## Purpose

FO-013 adds the frontend foundation for permission-aware navigation and route access. It consumes the backend RBAC endpoint introduced earlier and keeps backend authorization as the enforcement boundary.

## Scope

- RBAC TypeScript contracts
- Current-user permission API service
- Shared permission utility functions
- Auth provider permission loading and reset behavior
- `usePermissions` hook
- Permission guard and protected permission route components
- Navigation metadata and sidebar filtering
- Minimal placeholder pages for permission validation
- README and task documentation updates

User management UI, role management UI, master data CRUD, dashboard metrics, and business module screens remain outside this task.

## Backend Endpoint Used

The frontend RBAC layer uses `GET /api/access-control/me/permissions/` through the authenticated API client.

The current backend payload shape is:

```json
{
  "roles": ["facility_admin"],
  "permissions": ["roles.view", "settings.view"]
}
```

The frontend normalizes this payload to empty arrays if either collection is absent.

## Permission Code Convention

Permission codes follow the `module.action` format. FO-013 only wires the foundation permissions already available from the backend, such as:

- `settings.view`
- `settings.manage`
- `roles.view`
- `roles.manage`
- `users.view`

Business-module permissions are intentionally excluded until their corresponding modules are implemented.

## RBAC Service Structure

`frontend/services/api/rbac.ts` exposes `getCurrentUserPermissions()`. It calls `/access-control/me/permissions/` via the shared API client and normalizes the returned `roles` and `permissions` arrays into `UserPermissionsResponse`.

Endpoint constants remain centralized in `frontend/services/api/endpoints.ts`, and reusable RBAC contracts live in `frontend/types/rbac.ts`.

## Permission Utilities

`frontend/lib/auth/permissions.ts` provides:

- `hasPermission()`
- `hasAnyPermission()`
- `hasAllPermissions()`

These helpers treat empty permission lists explicitly, trim invalid input, and allow elevated access when `AuthUser.is_staff` or a future `is_superuser` flag is present.

## Auth Provider Extension

`AuthProvider` now owns:

- `permissions`
- `permissionsLoading`
- `permissionsError`
- `refreshPermissions()`

After a user is restored or logs in successfully, the provider fetches current-user permissions separately from authentication. If permission loading fails, the user remains signed in and the provider exposes a safe error state while clearing permission-protected navigation until a retry succeeds. Logout clears both tokens and permission state.

## Navigation Filtering

`frontend/lib/navigation.ts` defines the sidebar items and their optional permission requirements. `Sidebar` uses `usePermissions()` to filter items before rendering:

- `Dashboard` is available to authenticated users.
- `Master Data` requires `settings.view`.
- `Users` requires `users.view`.
- `Roles & Permissions` requires `roles.view`.
- `Settings` requires `settings.view`.

If no routes remain visible, the sidebar shows a safe fallback instead of failing. If permission loading fails, permission-based items remain hidden.

## Permission Guard Behavior

`PermissionGuard` handles UI-level permission checks without redirecting by default. It:

- accepts one permission or a list
- supports `all` or `any` matching
- shows a loading state while permissions are being fetched
- shows a retryable safe error state if permissions could not be loaded
- shows an unauthorized state when the user lacks access

`ProtectedPermissionRoute` builds on that behavior by redirecting anonymous users to `/login` first and then applying permission checks for authenticated users.

## Placeholder Route Notes

Minimal placeholder pages were added only to validate the RBAC wiring:

- `/master-data`
- `/users`
- `/roles`
- `/settings`

These pages contain placeholder text only. They do not include CRUD, tables, forms, metrics, or business workflows.

## Validation Commands

Backend:

```text
cd backend
.venv\Scripts\activate
python manage.py runserver
```

On Linux or macOS:

```text
source .venv/bin/activate
python manage.py runserver
```

Frontend:

```text
cd frontend
npm install
npm run lint
npm run build
npm run dev
```

Validate:

- login succeeds
- current user loads
- permissions load after authentication
- sidebar hides unauthorized items
- dashboard remains available to authenticated users
- protected placeholder routes show safe unauthorized states when access is missing
- logout clears permissions

## Known Limitations

- Frontend guards are UX helpers only; backend RBAC remains authoritative.
- Permission state is loaded on authentication and on manual retry only; there is no broader cache invalidation strategy yet.
- Roles are returned from the backend response but are not yet surfaced in the UI.
- Automatic token refresh and middleware-based route protection remain outside this task.

## Next Task Recommendation

FO-014 - User Profile and Current User UI should build on the authenticated and permission-aware shell without widening this RBAC foundation into user or role management screens.
