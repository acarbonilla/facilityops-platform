# FO-004: Shared Environment Configuration

## Purpose

Standardize backend and frontend development environment conventions and startup instructions before database configuration.

## Scope

This task updates example environment files, makes the backend timezone configurable, documents local startup, and verifies Git safety. It does not add runtime services, secrets, integrations, or business functionality.

## Backend Environment Variables

- `SECRET_KEY=change-me`
- `DEBUG=True`
- `ALLOWED_HOSTS=localhost,127.0.0.1`
- `DATABASE_URL=`
- `CORS_ALLOWED_ORIGINS=http://localhost:3000`
- `TIME_ZONE=Asia/Manila`

The backend reads these values with python-decouple. An empty `DATABASE_URL` uses SQLite in development.

## Frontend Environment Variables

- `NEXT_PUBLIC_APP_NAME=FacilityOps Platform`
- `NEXT_PUBLIC_APP_VERSION=1.0.0`
- `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api`

Public frontend variables must not contain secrets. No API client or backend connection is introduced by this task.

## Local Startup Flow

1. Create and activate `backend/.venv`, install development requirements, run migrations, and start Django.
2. Install frontend packages and start the Next.js development server.
3. Open `http://localhost:3000` and verify `http://127.0.0.1:8000/api/health/`.

Detailed commands are maintained in the repository root `README.md`.

## Validation Checklist

- Both `.env.example` files contain the required variables.
- Real environment files and generated dependencies remain ignored.
- `.env.example` remains trackable.
- Django uses SQLite when `DATABASE_URL` is empty.
- Django checks, migrations, and health endpoint pass.
- Frontend lint, build, startup, and placeholder page pass.

## Known Limitations

PostgreSQL, Redis, Celery, Docker runtime, authentication, business modules, AI services, and frontend API integration are not configured. SQLite remains the local development database.

## Next Task Recommendation

Proceed with FO-005 — PostgreSQL Configuration after confirming the deployment-specific database credentials and secret-management approach.
