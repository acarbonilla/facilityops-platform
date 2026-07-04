# FO-006 - Redis and Celery Configuration

## Task ID

FO-006

## Task Title

Redis and Celery Configuration

## Purpose

Configure Redis and Celery as the asynchronous processing foundation for future backend jobs without implementing business workflows.

## Scope

- Add Celery and Redis backend dependencies.
- Configure Django settings for Redis-backed Celery broker and result backend.
- Add a single infrastructure smoke test task.
- Document local setup and validation commands.

## Redis Purpose

Redis provides the local message broker and result backend used by Celery workers during development.

## Celery Purpose

Celery provides the asynchronous task execution foundation for future notifications, reports, AI jobs, file processing, and long-running backend operations.

## Environment Variables

- `REDIS_URL=redis://localhost:6379/0`
- `CELERY_BROKER_URL=redis://localhost:6379/0`
- `CELERY_RESULT_BACKEND=redis://localhost:6379/1`
- `CELERY_TASK_ALWAYS_EAGER=False`

Existing backend variables remain required:

- `SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- `DATABASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `TIME_ZONE`

## Local Redis Setup Assumption

This task assumes Redis is already installed and running locally on the default port `6379`. No Docker runtime, Redis installation scripts, or service automation are added in FO-006.

## Backend Validation Commands

From the repository root:

```text
cd backend
```

Activate the virtual environment.

Windows:

```text
.venv\Scripts\activate
```

Linux or macOS:

```text
source .venv/bin/activate
```

Install requirements:

```text
pip install -r requirements/development.txt
```

Run Django checks and migrations:

```text
python manage.py check
python manage.py migrate
```

Run the backend server:

```text
python manage.py runserver
```

Validate the health endpoint:

```text
GET http://127.0.0.1:8000/api/health/
```

Expected response:

```json
{
  "status": "ok",
  "service": "facilityops-backend"
}
```

## Celery Worker Command

```text
cd backend
source .venv/bin/activate
celery -A config worker -l info
```

## Windows Celery Worker Note

Use the solo pool on Windows:

```text
celery -A config worker -l info -P solo
```

## Smoke Test Task

`apps.core.tasks.celery_health_check` is the only Celery task introduced in FO-006. It returns `celery-ok` and exists only to validate Celery worker wiring.

Optional smoke test:

```text
python manage.py shell
```

```python
from apps.core.tasks import celery_health_check

result = celery_health_check.delay()
result.get(timeout=10)
```

Expected result:

```text
celery-ok
```

## Validation Checklist

- [ ] `celery` added to backend requirements
- [ ] `redis` added to backend requirements
- [ ] `backend/config/celery.py` exists
- [ ] `backend/config/__init__.py` exposes `celery_app`
- [ ] Celery settings are defined through environment variables
- [ ] `backend/.env.example` includes Redis and Celery variables
- [ ] Redis URL defaults are safe for local development
- [ ] `apps/core/tasks.py` contains only the infrastructure smoke test task
- [ ] `python manage.py check` passes
- [ ] migrations still run
- [ ] backend health check still works
- [ ] Celery worker starts successfully when Redis is running
- [ ] smoke test task returns `celery-ok` when Redis is running
- [ ] root `README.md` updated
- [ ] FO-006 development documentation exists
- [ ] no business Celery tasks were created
- [ ] no scheduled jobs were implemented
- [ ] no Celery Beat was added
- [ ] no `django-celery-results` was added
- [ ] no frontend integration was added

## Known Limitations

- Redis must be installed and running locally for worker startup and async smoke testing.
- Celery Beat is intentionally not configured in this task.
- Persistent task result storage is intentionally not configured in this task.
- No business jobs or scheduled jobs are implemented in FO-006.

## Next Task Recommendation

Proceed to `FO-007 - Initial Database Migration and Base Models` after Redis and Celery foundation validation is complete.
