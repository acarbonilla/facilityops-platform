# FO-024 - FM Ticketing Backend Foundation

## Task ID

FO-024

## Task Title

FM Ticketing Backend Foundation

## Purpose

FO-024 introduces the first backend-only foundation for FacilityOps FM ticketing. It adds ticket records, comments, history tracking, RBAC-protected API endpoints, sample seed data, and backend tests while intentionally stopping short of any frontend ticketing screens or workflow automation.

## Scope

- New `fm_tickets` Django app
- FM ticket, comment, history, and status-history models
- DRF serializers and service helpers
- Ticket API routes under `/api/fm-tickets/`
- RBAC permission seeding and enforcement
- Django admin registration
- Idempotent `seed_fm_tickets` command
- Backend tests
- README and development documentation updates

Out of scope:

- Frontend ticketing screens
- Maintenance work orders
- 5S inspection
- AI recommendations
- File attachments
- Reporting dashboards
- SLA or escalation automation

## Models Created

- `FmTicket`
- `FmTicketComment`
- `FmTicketHistory`
- `FmTicketStatusHistory`

The optional assignment and SLA models were intentionally not added in this task. Assignment is handled through a simple ticket action and assignee field to keep the foundation stable.

## API Routes Created

- `GET /api/fm-tickets/tickets/`
- `POST /api/fm-tickets/tickets/`
- `GET /api/fm-tickets/tickets/{id}/`
- `PATCH /api/fm-tickets/tickets/{id}/`
- `GET /api/fm-tickets/tickets/{id}/comments/`
- `POST /api/fm-tickets/tickets/{id}/comments/`
- `GET /api/fm-tickets/tickets/{id}/history/`
- `POST /api/fm-tickets/tickets/{id}/assign/`
- `POST /api/fm-tickets/tickets/{id}/change-status/`

## Permission Codes Added

- `fm_tickets.view`
- `fm_tickets.create`
- `fm_tickets.update`
- `fm_tickets.assign`
- `fm_tickets.close`
- `fm_tickets.manage`

Role seeding now includes:

- `system_admin`: all FM ticket permissions
- `facility_manager`: view, create, update, assign, close
- `technician`: view, update
- `viewer`: view

## Seed Command

Command:

```text
cd backend
python manage.py seed_fm_tickets
```

Behavior:

- Requires master data to exist first
- Requires at least one user
- Creates two sample tickets
- Adds a sample comment
- Adds history and status-history entries through the service layer
- Remains idempotent for the seeded sample titles and requester

## Validation Commands

Backend:

```text
cd backend
.venv\Scripts\activate
python manage.py check
python manage.py makemigrations
python manage.py migrate
python manage.py seed_rbac
python manage.py seed_master_data
python manage.py seed_fm_tickets
pytest
python manage.py runserver
```

## Known Limitations

- Ticket number generation is readable and unique for normal use, but it is not yet backed by a dedicated database sequence for stronger concurrency guarantees.
- No frontend ticketing UI is included yet.
- No attachment, notification, SLA, escalation, or reporting workflows are implemented.
- Status-change rules are intentionally lightweight and do not yet enforce a full workflow state machine.
- Status history has its own `changed_at` field and also inherits the shared base timestamp fields through the existing backend model convention.

## Next Task Recommendation

FO-025 - FM Ticketing Frontend Read Screens should consume these backend endpoints and expose list/detail views without expanding the backend workflow scope prematurely.
