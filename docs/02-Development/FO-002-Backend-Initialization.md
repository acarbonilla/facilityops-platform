# FO-002: Backend Initialization — Django + .venv + DRF

## Purpose

Establish the FacilityOps Django and Django REST Framework backend foundation without business modules, authentication, or authorization.

## Backend Structure

The backend contains the `config` project with split settings, the `apps.core` health-check app, API routing, common response and pagination utilities, service and test packages, static/media directories, and environment-specific requirement files.

## Packages Installed

- Django and Django REST Framework
- django-cors-headers
- python-decouple
- dj-database-url and psycopg2-binary
- black, isort, flake8, pytest, and pytest-django for development

Gunicorn is declared in the production requirements and is not part of the development installation.

## Environment Variables

`SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `DATABASE_URL`, and `CORS_ALLOWED_ORIGINS` are documented in `backend/.env.example`. Development uses SQLite when `DATABASE_URL` is empty. Production requires explicitly supplied secrets and database configuration.

## Commands to Run

From `backend/`:

```powershell
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -r requirements\development.txt
python manage.py check
python manage.py migrate
python manage.py runserver
```

On Linux or macOS, activate with `source .venv/bin/activate` and use forward slashes in requirement paths.

## Validation Checklist

- Django system check passes.
- Built-in migrations apply successfully.
- Pytest passes.
- `GET /api/health/` returns the expected service status.
- The frontend remains unchanged.

## Known Limitations

The foundation has no business models, authentication, authorization, production hardening, or deployment services. Dependency versions are not yet pinned.

## Next Task Recommendation

Confirm environment and dependency-version standards, then proceed with the next approved foundation task without adding business modules prematurely.
