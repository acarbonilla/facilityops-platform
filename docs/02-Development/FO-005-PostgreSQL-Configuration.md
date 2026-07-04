# FO-005: PostgreSQL Configuration

## Purpose

Configure Django to select PostgreSQL through `DATABASE_URL` while retaining SQLite for local development when that variable is empty.

## Scope

This task changes database connection configuration and documentation only. It does not introduce business models, application tables, runtime containers, authentication, Redis, or Celery.

## Database Configuration Strategy

`config/settings/base.py` reads `DATABASE_URL` with python-decouple. A non-empty value is parsed by dj-database-url. Production settings continue to require `DATABASE_URL` and apply production connection options.

## SQLite Fallback Behavior

When `DATABASE_URL` is empty or absent under development settings, Django uses `backend/db.sqlite3`. This keeps local setup usable without PostgreSQL.

## Local PostgreSQL Standard Values

- Database: `facilityops_db`
- User: `facilityops_user`
- Password: `facilityops_password`
- Host: `localhost`
- Port: `5432`

The standard password is for local development only.

## Environment Variable Setup

```text
DATABASE_URL=postgres://facilityops_user:facilityops_password@localhost:5432/facilityops_db
```

Place local values in an ignored `backend/.env`; never commit real credentials. Set `DATABASE_URL=` to select SQLite fallback.

## PostgreSQL Commands

Run these statements as a PostgreSQL administrator:

```sql
CREATE DATABASE facilityops_db;
CREATE USER facilityops_user WITH PASSWORD 'facilityops_password';
ALTER ROLE facilityops_user SET client_encoding TO 'utf8';
ALTER ROLE facilityops_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE facilityops_user SET timezone TO 'Asia/Manila';
GRANT ALL PRIVILEGES ON DATABASE facilityops_db TO facilityops_user;
```

For PostgreSQL 15 and later, connect to the database and grant schema permissions:

```text
\c facilityops_db
```

```sql
GRANT ALL ON SCHEMA public TO facilityops_user;
ALTER SCHEMA public OWNER TO facilityops_user;
```

## Django Validation Commands

From `backend/`, activate `.venv`, set the intended `DATABASE_URL`, then run:

```text
pip install -r requirements/development.txt
python manage.py check
python manage.py migrate
python manage.py runserver
```

## Health Check Validation

Request `GET http://127.0.0.1:8000/api/health/`. The expected response is:

```json
{"status":"ok","service":"facilityops-backend"}
```

## Validation Checklist

- Required database packages remain installed.
- A PostgreSQL URL selects the PostgreSQL backend.
- Empty or absent `DATABASE_URL` selects SQLite.
- Django checks and built-in migrations succeed against each available database.
- The health endpoint remains available.
- No business migrations or models are introduced.

## Known Limitations

Only Django's built-in tables exist. High availability, backups, pooling, TLS, deployed secrets, Redis, Celery, and Docker runtime are outside this task.

## Next Task Recommendation

Proceed with FO-006 — Redis and Celery Configuration after defining environment-specific broker and worker operation standards.
