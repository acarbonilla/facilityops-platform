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

Phase 12A - Application Development, Stage 1 - Foundation. FO-006 establishes the Redis and Celery foundation after backend, frontend, shared environment, and PostgreSQL configuration.

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
python -m pytest
```

Frontend, from `frontend/`:

```text
npm run lint
npm run build
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

FO-010 - Master Data Foundation.
