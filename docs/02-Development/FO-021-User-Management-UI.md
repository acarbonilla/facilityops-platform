# FO-021 - User Management UI

## Task ID

FO-021

## Task Title

User Management UI

## Purpose

FO-021 introduces the first admin-facing user-management route and navigation entry while preserving the backend as the source of truth for which operations are actually available.

## Scope

- User-management TypeScript contracts
- User-management service discovery metadata
- Admin users route
- Admin landing page update
- RBAC-aware navigation update
- README and task documentation updates

Invitations, password reset, forced password change, SSO, OAuth, audit logs, business workflows, and production identity-provider features remain out of scope.

## Backend Endpoints Discovered

Verified existing backend routes:

- `GET /api/auth/me/`
- `GET /api/access-control/me/permissions/`

Checked for user-management admin endpoints and did not find supported routes for:

- `GET /api/users/`
- `GET /api/accounts/users/`
- `GET /api/auth/users/`
- `GET /api/access-control/user-roles/`

No supported backend endpoint was discovered for user list, user detail, create, update, or user-role assignment.

## Supported Frontend Routes

- `/admin/users`

The legacy `/users` route now redirects to `/admin/users`.

Because backend user-management endpoints are not available yet, detail, create, and edit routes were intentionally not added.

## Types Added

Added in `frontend/types/users.ts`:

- `ManagedUser`
- `UserListResponse`
- `UserDetailResponse`
- `UserListParams`
- `UserManagementEndpointDiscovery`
- `UserManagementCapabilities`

Create/edit form types and user-role assignment types were intentionally omitted because the backend does not support those flows yet.

## API Services Added

Added in `frontend/services/api/users.ts`:

- `getUserManagementEndpointDiscovery()`
- `getUserManagementCapabilities()`

The service currently exposes backend-discovery metadata only and does not invent unsupported API calls.

## Permission Assumptions

- `users.view` protects the admin users route.
- `users.create` is reserved for future create support if a backend endpoint is added.
- `users.update` is reserved for future edit support if a backend endpoint is added.
- `roles.manage` is reserved for future user-role assignment support if a backend endpoint is added.

Backend authorization remains authoritative.

## Create/Edit Support Status

- Create user UI: not supported by current backend
- Edit user UI: not supported by current backend

## User-Role Assignment Support Status

- User-role assignment UI: not supported by current backend
- User-role viewing endpoint: not supported by current backend

Backend follow-up is required before user-role visibility or assignment can be exposed safely.

## Known Limitations

- The users screen is currently a read-only capability/status page because no supported backend user-management endpoints exist.
- No user list can be shown until the backend exposes a dedicated users API.
- No detail, create, edit, or role-assignment routes are created until backend support exists.
- Invitations, password reset, SSO, OAuth, and audit logging remain intentionally absent.

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

Frontend:

```text
cd frontend
npm install
npm run lint
npx tsc --noEmit
npm run dev
```

Validate:

- login works
- permissions load
- users navigation appears for authorized users
- `/admin/users` loads
- unauthorized users are blocked safely
- no invitation, password reset, or SSO UI appears

## Next Task Recommendation

FO-022 - Organization Management UI should build the next admin foundation area while backend work is planned for dedicated user-management endpoints.
