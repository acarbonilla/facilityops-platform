# FO-027 - FM Ticketing Comments and Status Workflow

## Task ID

FO-027

## Task Title

FM Ticketing Comments and Status Workflow

## Purpose

FO-027 adds the first interactive workflow layer to FM Ticketing by enabling comment creation and controlled status updates on the ticket detail screen, while continuing to defer assignment, attachments, notifications, and automation concerns.

## Scope

- FM Ticketing comment-create and status-update payload types
- Frontend API wrappers for comment creation and status-change actions
- Validation schemas for comment and status workflow forms
- Permission-aware comment form on ticket detail
- Permission-aware status workflow actions on ticket detail
- Query invalidation for ticket detail, comments, history, and list data after successful workflow actions
- README and development documentation updates

Out of scope:

- Assignment UI
- File attachments
- Notifications
- SLA automation
- Escalation automation
- AI recommendations
- Maintenance work orders

## Backend Endpoints Used

- `POST /api/fm-tickets/tickets/{id}/comments/`
- `POST /api/fm-tickets/tickets/{id}/change-status/`
- `GET /api/fm-tickets/tickets/{id}/`
- `GET /api/fm-tickets/tickets/{id}/comments/`
- `GET /api/fm-tickets/tickets/{id}/history/`

Verified backend behavior:

- Comment creation is supported through the existing `comments` action route
- Status change is supported through the existing `change-status` action route
- The backend permission model currently treats `resolved`, `closed`, and `cancelled` target statuses as close/manage transitions
- The regular ticket `PATCH` serializer does not accept status updates, so the frontend uses the dedicated status-change endpoint

## Types Added

Updated file: `frontend/types/fm-tickets.ts`

Added:

- `FmTicketCommentCreatePayload`
- `FmTicketStatusUpdatePayload`
- `FmTicketStatusTransition`
- `FmTicketWorkflowAction`
- `FM_TICKET_WORKFLOW_STATUSES`
- `FM_TICKET_STATUS_TRANSITIONS`

## API Functions Added

Updated file: `frontend/services/api/fm-tickets.ts`

Added:

- `createFmTicketComment`
- `changeFmTicketStatus`

## Components Added

- `frontend/features/fm-tickets/components/ticket-comment-form.tsx`
- `frontend/features/fm-tickets/components/ticket-status-actions.tsx`

Updated component integration:

- `frontend/features/fm-tickets/components/ticket-detail.tsx`

## Validation Schemas Added

Updated file: `frontend/lib/validations/fm-tickets.ts`

Added:

- `fmTicketCommentSchema`
- `fmTicketStatusUpdateSchema`

Validation behavior:

- Comment body is required and must be at least 3 characters
- `is_internal` remains optional
- `to_status` is required for status changes
- Status note remains optional

## Comment Behavior

- Comment form is shown only when the current user has `fm_tickets.update` or `fm_tickets.manage`
- Successful comment submission invalidates:
  - `["fm-tickets", id]`
  - `["fm-tickets", id, "comments"]`
  - `["fm-tickets", id, "history"]`
- The form resets after a successful submission
- Success and API error states are rendered inline

## Status Workflow Behavior

- Status workflow controls are shown only when the current user can perform at least one valid transition
- Frontend transition options follow a simple allowed-transition map and then filter against actual backend permission expectations
- Backend-aligned permission behavior:
  - `assigned`, `in_progress`, and `on_hold` require `fm_tickets.update` or `fm_tickets.manage`
  - `resolved`, `closed`, and `cancelled` require `fm_tickets.close` or `fm_tickets.manage`
- Successful status changes invalidate:
  - `["fm-tickets", id]`
  - `["fm-tickets", id, "comments"]`
  - `["fm-tickets", id, "history"]`
  - `["fm-tickets"]`

## Permission Assumptions

- Ticket detail remains protected by `fm_tickets.view`
- Comment creation uses `fm_tickets.update` or `fm_tickets.manage`
- Close-style status targets use `fm_tickets.close` or `fm_tickets.manage`
- Backend authorization remains the source of truth

## Known Limitations

- The frontend uses a practical transition map and still relies on backend enforcement for final workflow validation
- No assignment, attachment, or notification actions are surfaced yet
- Status note is optional because the current backend serializer does not require it
- History remains a read view of backend activity records and does not yet expose status-history entries separately

## Validation Commands

Backend:

```text
cd backend
.venv\Scripts\activate
python manage.py check
python manage.py migrate
python manage.py seed_rbac
python manage.py seed_master_data
python manage.py seed_fm_tickets
python manage.py runserver
```

Frontend:

```text
cd frontend
npm install
npm run lint
npm run dev
```

## Next Task Recommendation

FO-028 - FM Ticketing Assignment Workflow should build on the new interactive ticket detail screen and add assignee actions through the dedicated backend assignment endpoint without mixing assignment into the status workflow layer.
