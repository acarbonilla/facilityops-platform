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

FO-050 and FO-051 subsequently added and adopted the dedicated role detail endpoint:

- `GET /api/access-control/roles/:id/`

The permission detail helper retains its list fallback because Permission CRUD and dedicated permission administration remain outside the current feature.

## Frontend Routes Created

- `/admin`
- `/admin/roles`
- `/admin/roles/[id]`
- `/admin/roles/new` (added by FO-051)
- `/admin/roles/[id]/edit` (added by FO-051)
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

## FO-051 Roles Management Upgrade

FO-051 upgrades the original read-only roles experience with backend pagination, search, system/active filters, supported ordering, custom-role creation, custom-role metadata editing, immutable code display, protected system-role states, and non-destructive deactivation. The role detail route now uses the dedicated FO-050 endpoint directly.

Mutation controls require `roles.manage` in the UI and remain subject to the backend's global-scope enforcement. System roles never expose mutation controls. See `FO-051 - Roles Management Frontend.md` for the current contract.

## Role-Permission Assignment Limitation

The current backend does not expose role-permission assignment or removal endpoints, and it does not currently provide assigned permissions from a dedicated role detail response. For that reason:

- assignment and removal UI are not implemented
- the UI clearly identifies permission assignment as pending FO-052
- the permission catalog remains read-only

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

- The permissions catalog route is frontend-protected with `roles.manage` to match the current backend endpoint authorization.
- Role-permission assignment and removal UI are intentionally absent until backend endpoints exist.
- Permission CRUD and role reactivation remain unavailable.

## Next Task Recommendation

FO-052 - Permission Assignment Workflow is the next Roles & Permissions milestone.
