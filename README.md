# FacilityOps Platform

## Project Overview

FacilityOps Platform is an enterprise facility operations management platform. The repository separates backend, frontend, shared contracts, documentation, and future infrastructure concerns while the product foundation is established.

## Technology Stack

- Backend: Python, Django, and Django REST Framework
- Frontend: Next.js, React, TypeScript, and Tailwind CSS
- Data configuration: SQLite for current local development; PostgreSQL is not configured yet
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

Phase 12A — Application Development, Stage 1 — Foundation. FO-004 standardizes shared local environment conventions after backend and frontend initialization.

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
- `DATABASE_URL` — an empty value uses SQLite during development
- `CORS_ALLOWED_ORIGINS`
- `TIME_ZONE`

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
- Do not introduce Redis, Celery, Docker runtime, authentication, business modules, or AI services before their approved tasks.

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

## Next Task

FO-006 — Redis and Celery Configuration.
