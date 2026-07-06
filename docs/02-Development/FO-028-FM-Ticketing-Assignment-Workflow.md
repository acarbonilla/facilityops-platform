# FO-028 - FM Ticketing Assignment Workflow

## Task ID

- FO-028

## Task Title

- FM Ticketing Assignment Workflow

## Purpose

- Verify the backend assignment workflow and extend the frontend FM ticket detail experience so assignment capability is surfaced safely without inventing unsupported user lookup APIs.

## Scope

- Verify backend assignment support and permission behavior
- Add frontend assignment payload and response types
- Add the dedicated frontend assignment API function for the supported backend action
- Add a ticket assignment panel on the ticket detail screen
- Preserve assignee visibility on the ticket list and detail screen
- Document the current assignee-source limitation

## Backend Assignment Support Discovered

- Supported: yes
- Verified endpoint: `POST /api/fm-tickets/tickets/{id}/assign/`
- Verified permission: `fm_tickets.assign`
- Verified backend behavior:
  - The assign action uses `FmTicketAssignSerializer`
  - The backend service updates `assignee`
  - Assignment history is recorded through `FmTicketHistory`
  - Tickets in `draft` or `open` move to `assigned` automatically during assignment

## Endpoint Used

- Frontend assignment write path: `POST /api/fm-tickets/tickets/{id}/assign/`
- Frontend does not use `PATCH /api/fm-tickets/tickets/{id}/` for assignment because the current update serializer does not accept `assignee`

## Types Added

- `FmTicketAssignmentPayload`
- `FmTicketAssignmentResponse`
- `FmTicketAssigneeOption`
- `FmTicketAssignmentState`

## API Functions Added

- `assignFmTicket(ticketId, payload)` in `frontend/services/api/fm-tickets.ts`

## Assignment UI Behavior

- The ticket detail screen now includes `TicketAssignmentPanel`
- The panel always shows the current assignee
- The panel shows the verified permission and endpoint used for assignment
- Users without `fm_tickets.assign` see a read-only assignment state
- Users with `fm_tickets.assign` still do not see an assignment selector unless a supported assignee list endpoint exists
- No fake frontend-only assignment history or unsupported controls were added

## Assignee Option Source

- Source requested by task: existing user-management API from FO-021 if available
- Source discovered in this repository: unavailable
- Current frontend discovery exposes no supported users list endpoint
- Current backend account routes expose `/api/auth/me/` only for current-user context

## Permission Assumptions

- `fm_tickets.view` can see current assignee
- `fm_tickets.assign` is required to change assignment
- Backend remains the source of truth for permission enforcement

## Known Limitations

- Interactive assign/reassign UI is hidden because no supported users list endpoint exists yet
- `assignFmTicket` is wired to the supported backend action but is not invoked from the UI until assignee options can be loaded safely
- Assignment detail and history refresh behavior are therefore not triggered from the current UI path yet
- No attachments, notifications, SLA, escalation, AI, maintenance, reporting, or dashboard automation were added

## Validation Commands

Backend, from `backend/`:

```text
python manage.py check
python manage.py migrate
python manage.py seed_rbac
python manage.py seed_master_data
python manage.py seed_fm_tickets
python manage.py runserver
```

Frontend, from `frontend/`:

```text
npm install
npm run lint
npm run dev
```

## Next Task Recommendation

- FO-029 - FM Ticketing SLA and Escalation Foundation
