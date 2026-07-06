# FO-020 - Roles and Permissions UI

## Task ID

FO-020

## Task Title

Roles and Permissions UI

## Purpose

FO-020 introduces the first RBAC administration UI for FacilityOps. It allows authorized users to review backend roles, inspect a role detail view, and browse the permission catalog while keeping backend authorization as the source of truth.

## Scope

- RBAC TypeScript contracts for roles, permissions, and grouped permission display
- Roles and permissions API service functions built on the authenticated API client
- Stable RBAC TanStack Query keys
- Admin landing page
- Roles list route
- Role detail route
- Permissions list route
- RBAC-aware navigation updates
- README and task documentation updates

User management UI, user-role assignment, invitations, audit logs, business-module permissions, and advanced admin workflows remain out of scope.

## Backend Endpoints Used

- `GET /api/access-control/roles/`
- `GET /api/access-control/permissions/`
- `GET /api/access-control/me/permissions/`

The frontend also probes for these detail endpoints and falls back safely when they are not available:

- `GET /api/access-control/roles/:id/`
- `GET /api/access-control/permissions/:id/`

## Frontend Routes Created

- `/admin`
- `/admin/roles`
- `/admin/roles/[id]`
- `/admin/permissions`

The legacy `/roles` route now redirects to `/admin/roles`.

## Types Added

Added or expanded in `frontend/types/rbac.ts`:

- `Role`
- `Permission`
- `RolePermission`
- `RoleDetailResponse`
- `PermissionGroup`
- `RoleListResponse`
- `PermissionListResponse`
- `RbacListParams`
- `PermissionListParams`

## API Services Added

Added or updated in `frontend/services/api/rbac.ts`:

- `getRoles(params?)`
- `getRole(id)`
- `getPermissions(params?)`
- `getPermission(id)`
- `getCurrentUserPermissions()`

## Permission Assumptions

- `roles.view` grants access to roles read screens.
- `roles.manage` is required for the permissions catalog screen because the current backend permissions endpoint enforces that permission.
- Backend RBAC remains authoritative even when frontend guards hide or show navigation.
- Elevated staff access in the frontend permission helpers remains a UX convenience only and does not replace backend checks.

## Role-Permission Assignment Limitation

The current backend does not expose role-permission assignment or removal endpoints, and it does not currently provide assigned permissions from a dedicated role detail response. For that reason:

- the role detail screen is read-only
- assignment and removal UI were not implemented
- the UI documents that backend follow-up is required before richer role-permission management can be added

## Validation Commands

Backend:

```text
cd backend
.venv\Scripts\activate
python manage.py check
python manage.py migrate
python manage.py seed_rbac
python manage.py runserver
```

On Linux or macOS:

```text
cd backend
source .venv/bin/activate
python manage.py check
python manage.py migrate
python manage.py seed_rbac
python manage.py runserver
```

Frontend:

```text
cd frontend
npm install
npm run lint
npm run dev
```

Validate:

- login works
- permissions load after authentication
- admin navigation appears for authorized users
- `/admin/roles` loads
- `/admin/roles/[id]` loads
- `/admin/permissions` loads for `roles.manage`
- unauthorized users are blocked safely
- no user management UI appears

## Known Limitations

- The backend currently exposes list endpoints only for roles and permissions; detail responses are not guaranteed.
- The permissions catalog route is frontend-protected with `roles.manage` to match the current backend endpoint authorization.
- Role detail falls back to list data when a dedicated detail endpoint is unavailable, so assigned permissions may not be visible yet.
- Role-permission assignment and removal UI are intentionally absent until backend endpoints exist.
- User management remains deferred to the next task.

## Next Task Recommendation

FO-021 - User Management UI should add controlled user administration screens without bypassing the backend RBAC boundary or mixing user-role assignment into unsupported APIs.
