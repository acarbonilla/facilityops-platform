# FO-029 - FM Ticketing SLA and Escalation Foundation

## Task ID

- FO-029

## Task Title

- FM Ticketing SLA and Escalation Foundation

## Purpose

- Extend the existing FM Ticketing foundation with minimal SLA and escalation support so ticket detail can surface response and resolution targets, SLA status, escalation history, and a safe manual escalation action.

## Scope

- Verify current backend support before adding new code
- Add minimal SLA fields to `FmTicket`
- Add a dedicated `FmTicketEscalation` model
- Expose SLA and escalation data through the existing FM ticket API
- Add frontend SLA and escalation types, API functions, and detail components
- Keep notification sending, automated jobs, and analytics out of scope

## Backend Support Discovered

- Existing `FmTicketSla` model: not present
- Existing `FmTicketEscalation` model: not present
- Existing SLA fields on `FmTicket`: not present
- Existing escalation endpoint: not present
- Existing FM ticket foundation reused:
  - `FmTicket`
  - `FmTicketComment`
  - `FmTicketHistory`
  - `FmTicketStatusHistory`
  - `assign`, `change-status`, comments, and history actions

## Models And Fields Added Or Reused

- Reused model: `FmTicket`
- Added SLA fields on `FmTicket`:
  - `response_due_at`
  - `resolution_due_at`
  - `first_responded_at`
  - `response_met`
  - `resolution_met`
- Added escalation model: `FmTicketEscalation`
- Added escalation fields:
  - `ticket`
  - `escalated_by`
  - `escalated_to`
  - `resolved_by`
  - `reason`
  - `level`
  - `created_at`
  - `is_active`
  - `resolved_at`

## API Endpoints Exposed

- Existing detail endpoint, now extended with SLA and escalation payloads:
  - `GET /api/fm-tickets/tickets/{id}/`
- Added escalation list endpoint:
  - `GET /api/fm-tickets/tickets/{id}/escalations/`
- Added manual escalation endpoint:
  - `POST /api/fm-tickets/tickets/{id}/escalate/`

## Frontend Components Added

- `frontend/features/fm-tickets/components/ticket-sla-badge.tsx`
- `frontend/features/fm-tickets/components/ticket-sla-panel.tsx`
- `frontend/features/fm-tickets/components/ticket-escalation-history.tsx`
- `frontend/features/fm-tickets/components/ticket-escalation-form.tsx`

## Permission Assumptions

- `fm_tickets.view` can view SLA and escalation data
- `fm_tickets.manage` can create manual escalations
- No new `fm_tickets.escalate` permission was introduced
- Backend authorization remains the source of truth

## SLA Status Behavior

- SLA status is calculated through `calculate_ticket_sla_status(ticket)`
- Supported statuses:
  - `not_started`
  - `within_sla`
  - `at_risk`
  - `breached`
  - `met`
  - `missed`
  - `not_applicable`
- First response is marked automatically on assignment, non-requester comments, or status changes beyond `draft` and `open`
- SLA display is read-only in the frontend

## Escalation Behavior

- Manual escalation creates a new active escalation record
- Existing active escalations for the same ticket are resolved before a new one is created
- Escalation records appear in both ticket detail and the dedicated escalation-history panel
- Manual escalation defaults the backend target to the current assignee when no explicit target is provided
- No notifications, emails, or scheduled escalation automation were added

## Known Limitations

- No background SLA monitoring or scheduled escalation jobs exist yet
- No notification sending is implemented
- No frontend assignee lookup is added for escalation targeting; the current assignee is reused safely
- SLA target editing is not exposed in the frontend create or edit forms
- No analytics, dashboards, attachments, AI, maintenance work orders, or inspection workflows were added

## Validation Commands

Backend, from `backend/`:

```text
python manage.py check
python manage.py makemigrations
python manage.py migrate
python manage.py seed_rbac
python manage.py seed_master_data
python manage.py seed_fm_tickets
pytest
python manage.py runserver
```

Frontend, from `frontend/`:

```text
npm install
npm run lint
npm run dev
```

## Next Task Recommendation

- FO-030 - FM Ticketing Module QA and Stabilization
