# FO-018 - Stage 1 Foundation Stabilization and MVP QA

## Task ID

FO-018

## Task Title

Stage 1 Foundation Stabilization and MVP QA

## Purpose

FO-018 validates the full Stage 1 foundation after FO-001 through FO-017, fixes blocking stabilization issues, and records the current internal MVP readiness across backend, frontend, RBAC, master data, dashboard, and local infrastructure dependencies.

## Scope

- Backend startup and health validation
- PostgreSQL migration validation
- RBAC and master data seed validation
- Authentication and authorization API validation
- Dashboard summary endpoint validation
- Master data read/create/update API validation
- Frontend lint and TypeScript validation
- Frontend local startup probing
- Documentation cleanup for Stage 1 QA findings

No new business modules, analytics systems, AI features, notification features, or production deployment work were added.

## Validation Checklist

- [x] Backend starts successfully
- [ ] Frontend starts successfully
- [x] Clean database migration works
- [x] RBAC seed works
- [x] Master data seed works
- [ ] Redis responds correctly
- [ ] Celery worker starts
- [ ] Celery smoke test passes
- [x] Health endpoint works
- [x] Login works
- [x] Logout works
- [x] Current user loads
- [x] Permissions load
- [x] Sidebar navigation works at the data/permission-contract level
- [ ] Profile page works
- [x] Dashboard loads at the API contract level
- [x] Dashboard foundation metrics display at the API contract level
- [ ] Master data read screens work
- [ ] Master data create forms work
- [ ] Master data edit forms work
- [x] Loading states render safely in code paths reviewed
- [x] Error states render safely in code paths reviewed
- [x] Unauthorized states render safely in code paths reviewed
- [x] Backend tests pass
- [x] Frontend lint passes
- [x] README is updated
- [x] Development documentation is updated
- [x] No new business modules were implemented
- [x] No advanced analytics were implemented
- [x] No AI features were implemented
- [x] No notification features were implemented

Unchecked items remained blocked by local host dependencies or unreliable route-level frontend probing in this environment, not by newly introduced Stage 2 scope.

## Commands Executed

Backend:

```text
cd backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_rbac
.\.venv\Scripts\python.exe manage.py seed_master_data
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe manage.py shell -c "<create local MVP admin and assign system_admin>"
```

Backend live smoke:

```text
python manage.py runserver 127.0.0.1:8000
GET /api/health/
POST /api/auth/login/
GET /api/auth/me/
GET /api/access-control/me/permissions/
GET /api/dashboard/foundation-summary/
GET /api/master-data/tenants/
POST /api/master-data/tenants/
PATCH /api/master-data/tenants/{id}/
POST /api/auth/logout/
```

Frontend:

```text
cd frontend
npm run lint
npx tsc --noEmit
npm run dev
```

Additional frontend startup probes were attempted with dedicated ports and direct HTTP requests to `/login`, `/dashboard`, and `/master-data`.

## Bugs Found

1. Backend startup could crash in local environments where a machine-level `DEBUG` variable contained a non-boolean value such as `release`.
2. The frontend API client required `NEXT_PUBLIC_API_URL` to be explicitly set even though local documentation described a default backend URL.
3. Local Redis tooling and Redis service were unavailable on this host, preventing Redis/Celery smoke validation.
4. Route-level scripted probes against `next dev` were unreliable in this host. The dev server bound ports successfully, but HTTP responses did not complete during the automated checks.

## Bugs Fixed

1. Hardened boolean environment parsing in `backend/config/settings/base.py` and `backend/config/settings/development.py` so invalid external boolean values fall back safely instead of crashing Django startup.
2. Updated `frontend/services/api/client.ts` to default `NEXT_PUBLIC_API_URL` to `http://127.0.0.1:8000/api`, aligning the code with the documented local-development expectation and avoiding a blank API base URL during Stage 1 MVP setup.

## Known Limitations

- Redis is not installed or reachable on `localhost:6379` in this environment, so Redis and Celery smoke validation could not be completed.
- `redis-cli` is not available on this host.
- Frontend route probing through `next dev` remained unreliable in this environment even after the API-base fix. Lint and TypeScript validation passed, but browser-equivalent route validation was incomplete.
- Manual profile, read-screen, and form-screen browser validation remains recommended on a stable local frontend runtime.
- The local backend `SECRET_KEY` remains weak for cryptographic warnings in test output. This does not block Stage 1 development but should not carry into any deployed environment.

## MVP Acceptance Result

Stage 1 foundation is acceptable for internal backend/API MVP validation with two caveats:

- core backend startup, migrations, seeds, auth, RBAC, dashboard, and master data API flows passed
- frontend code validation passed through lint and TypeScript checks, but route-level browser validation remains partially blocked by host-specific `next dev` probing instability

The internal MVP flow is therefore **partially accepted** for Stage 1 stabilization. Backend and contract-level functionality is validated. Final browser-driven frontend smoke validation should be rerun in a cleaner local frontend runtime before depending on it as the sole demonstration environment.

## Stage 2 Recommendation

Proceed to Stage 2 - Core Platform after:

- confirming Redis availability and rerunning the Celery smoke test
- running one clean browser-driven frontend smoke pass for login, dashboard, profile, master data read, create, edit, and logout
- replacing local development secrets with stronger values where applicable
