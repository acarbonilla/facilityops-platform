# FacilityOps Platform

## Project Overview

FacilityOps Platform is an enterprise facility operations management platform. The repository separates backend, frontend, shared contracts, documentation, and future infrastructure concerns while the product foundation is established.

## Technology Stack

- Backend: Python, Django, and Django REST Framework
- Frontend: Next.js, React, TypeScript, and Tailwind CSS
- Data configuration: PostgreSQL for local database validation with SQLite fallback when `DATABASE_URL` is empty
- Async foundation: Redis and Celery
- Tooling: pytest, Black, isort, flake8, ESLint, and npm

## Repository Structure

```text
facilityops-platform/
|-- backend/          Django and REST API application
|-- frontend/         Next.js application
|-- docs/             Architecture and development documentation
|-- infrastructure/   Reserved infrastructure workspace
|-- shared/           Reserved cross-application contracts and utilities
`-- .github/          GitHub workflow workspace
```

## Current Development Stage

Phase 12A - Application Development, Stage 1 - Foundation. FO-018 stabilizes the Stage 1 internal MVP, validates the backend and frontend foundations, and documents the remaining local-environment QA gaps before Stage 2.

## Backend Local Setup

```text
cd backend
python -m venv .venv
```

Activate the environment on Windows:

```text
.venv\Scripts\activate
```

Activate it on Linux or macOS:

```text
source .venv/bin/activate
```

Install and start the backend:

```text
pip install --upgrade pip
pip install -r requirements/development.txt
python manage.py check
python manage.py migrate
python manage.py runserver
```

## Frontend Local Setup

```text
cd frontend
npm install
npm run lint
npm run dev
```

## Frontend Integration Foundation

- The frontend API base URL is configured by `NEXT_PUBLIC_API_URL` and falls back locally to `http://127.0.0.1:8000/api` when no explicit browser-safe override is provided.
- The home page validates backend availability through `GET /health/` and displays safe loading, connected, and unavailable states.
- TanStack Query manages asynchronous server-state requests through the root application providers.
- The responsive app shell provides shared header, sidebar, and main-content foundations without authentication or permission gating.

## Frontend Authentication

- Login page: `http://localhost:3000/login`
- Backend endpoints: `/api/auth/login/`, `/api/auth/refresh/`, `/api/auth/logout/`, and `/api/auth/me/`
- Access and refresh tokens are centralized in browser local storage for local development; the production storage strategy requires a dedicated security review.
- The auth provider restores the current user, supports login/logout, and supplies the protected-route foundation used by `/dashboard`.

## Frontend RBAC

- Permission codes use the `module.action` convention.
- Frontend permissions are loaded from `/api/access-control/me/permissions/`.
- The sidebar filters navigation items against the authenticated user's permissions.
- Frontend route guards improve UX, but backend authorization remains the source of truth.
- Admin RBAC routes are available at `/admin`, `/admin/roles`, and `/admin/permissions`.
- Roles screens are guarded by `roles.view`.
- The permissions catalog currently requires `roles.manage` because the backend permissions endpoint enforces that permission.
- User management comes later and is not part of the current admin UI scope.

## User Management UI

- Users route: `/admin/users`
- Permission requirement: `users.view`
- Supported operations: admin navigation entry and backend-support discovery state
- Unsupported operations: user list loading, detail, create, edit, role assignment, invitations, password reset, and SSO
- User management remains separate from invitations and identity-provider workflows.

## Organization Management

- Route: `/admin/organization`
- Uses the existing master-data foundation and services
- Focuses on tenants, organizations, departments, buildings, floors, and areas
- Reuses existing master-data create/edit routes for authorized users
- Does not implement operational workflows, delete, bulk actions, or import/export

## Asset Management UI

- Primary routes: `/master-data/assets`, `/master-data/assets/new`, `/master-data/assets/[id]`, and `/master-data/assets/[id]/edit`
- Admin alias: `/admin/assets`
- Reuses the existing master-data asset service and types instead of introducing new backend models
- Adds a dedicated asset detail screen, clearer location/context display, and links back to organization structure screens
- Includes simple frontend filtering by name/code, asset type, building, and active status for the current loaded page only
- Improves the asset create/edit form layout by grouping asset information, classification, and location fields
- Does not implement maintenance workflows, ticketing, inspections, delete, bulk actions, import/export, or reporting

## FM Ticketing Backend

- Backend FM ticketing APIs are available under `/api/fm-tickets/`
- The backend foundation includes tickets, comments, history, status history, SLA tracking fields, escalation records, RBAC enforcement, admin registration, and sample seed data
- Frontend read-only routes are now available at `/fm-tickets` and `/fm-tickets/[id]`
- The FM Ticketing frontend currently supports read-only list, detail, comments, and history views guarded by `fm_tickets.view`
- Create and edit routes are available at `/fm-tickets/new` and `/fm-tickets/[id]/edit` for authorized users
- Comments and basic status updates are now supported on the ticket detail screen for authorized users
- The ticket detail screen now verifies backend assignment support and shows the current assignee with permission-aware assignment status
- Interactive assignment is intended for the ticket detail screen and uses the dedicated `/api/fm-tickets/tickets/{id}/assign/` backend action when a supported assignee list endpoint exists
- The ticket detail screen now shows a read-only SLA panel and escalation history for authorized viewers
- Manual escalation is supported through `POST /api/fm-tickets/tickets/{id}/escalate/` for users with `fm_tickets.manage`
- Notification sending and Celery-driven escalation automation are intentionally deferred
- Attachments and AI workflows are still deferred

## Current User UI

- Profile route: `/profile`
- The header exposes a user menu for authenticated sessions.
- Logout is available from the user menu and continues through the existing auth provider flow.
- Profile editing, password management, and avatar uploads are intentionally deferred.

## Master Data Frontend

- Read-only master data screens are available under `/master-data`.
- The frontend includes tenants, organizations, departments, buildings, floors, areas, asset types, and assets list screens.
- The screens use the authenticated API client and TanStack Query for read operations and related option loading.
- Create and edit workflows are now available; delete remains deferred.
- Business modules are still not implemented.

## Master Data Write UI

- Create and edit master data screens are available for tenants, organizations, departments, buildings, floors, areas, asset types, and assets.
- Write routes are permission-guarded with the existing master data management foundation.
- Delete, import, export, and bulk actions are not implemented yet.
- Business modules are still not implemented.

## Dashboard Foundation

- Dashboard route: `/dashboard`
- Authenticated users can access the dashboard from the shared sidebar.
- The dashboard displays foundation metrics only: tenants, organizations, departments, buildings, floors, areas, asset types, and assets.
- Backend summary endpoint: `/api/dashboard/foundation-summary/`
- Backend connectivity is surfaced through the existing health check foundation.
- No business analytics, charts, workflow metrics, exports, or notifications are implemented yet.

## Environment Configuration

Copy the relevant `.env.example` file to a local ignored environment file when local overrides are needed. Never commit real secrets.

Backend variables:

- `SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- `DATABASE_URL` - an empty value uses SQLite during development
- `CORS_ALLOWED_ORIGINS`
- `TIME_ZONE`
- `REDIS_URL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `CELERY_TASK_ALWAYS_EAGER`

Frontend variables:

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_VERSION`
- `NEXT_PUBLIC_API_URL`

Values prefixed with `NEXT_PUBLIC_` are exposed to the browser and must not contain secrets.

## Local Development URLs

- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:8000`
- Backend health check: `http://127.0.0.1:8000/api/health/`

## Validation Commands

Backend, from `backend/`:

```text
python manage.py check
python manage.py migrate
python manage.py seed_rbac
python manage.py seed_master_data
python -m pytest
```

Frontend, from `frontend/`:

```text
npm run lint
npx tsc --noEmit
npm run dev
```

## Development Rules

- Keep secrets and real environment files out of Git.
- Keep backend and frontend dependencies isolated in their respective workspaces.
- Add only work approved by the current task scope.
- Do not introduce Docker runtime, authentication, business modules, or AI services before their approved tasks.

## PostgreSQL Local Setup

PostgreSQL is required when validating the database configuration introduced by FO-005. Use these standard local values:

- Database: `facilityops_db`
- User: `facilityops_user`
- Host: `localhost`
- Port: `5432`

Configure the backend with:

```text
DATABASE_URL=postgres://facilityops_user:facilityops_password@localhost:5432/facilityops_db
```

The example password is a local development convention only. Do not reuse it for deployed environments or commit real credentials. When `DATABASE_URL` is empty or absent, development settings continue to use SQLite.

Apply migrations from the repository root:

```text
cd backend
python manage.py migrate
```

After starting Django, validate `http://127.0.0.1:8000/api/health/`.

## Database Foundation Note

- UUID is the default primary key strategy for future backend models.
- Shared base models are abstract and do not create standalone business tables.
- Concrete business tables start in later tasks.

## Authentication Foundation

- JWT authentication is used for backend API authentication.
- Login URL: `/api/auth/login/`
- Refresh URL: `/api/auth/refresh/`
- Logout URL: `/api/auth/logout/`
- Current user URL: `/api/auth/me/`

## RBAC Foundation

- RBAC is backend-based.
- Permission code format is `module.action`.
- Seed command: `python manage.py seed_rbac`
- Business permissions are added later per module.
- Frontend route guards come later.

## Master Data Foundation

- Master data is required before business modules.
- Seed command: `python manage.py seed_master_data`
- API base path: `/api/master-data/`
- Business modules begin after this foundation.

## Redis and Celery Local Setup

Redis must be running locally before starting a Celery worker. The default local URLs used by the backend are:

- `REDIS_URL=redis://localhost:6379/0`
- `CELERY_BROKER_URL=redis://localhost:6379/0`
- `CELERY_RESULT_BACKEND=redis://localhost:6379/1`

Start the backend from `backend/`:

```text
python manage.py runserver
```

Start a Celery worker from `backend/`:

```text
celery -A config worker -l info
```

On Windows, use the solo pool:

```text
celery -A config worker -l info -P solo
```

Smoke test the infrastructure task from `backend/`:

```text
python manage.py shell
```

Then run:

```text
from apps.core.tasks import celery_health_check
result = celery_health_check.delay()
result.get(timeout=10)
```

Expected result:

```text
celery-ok
```

## Next Task

Stage 2 - Core Platform.
