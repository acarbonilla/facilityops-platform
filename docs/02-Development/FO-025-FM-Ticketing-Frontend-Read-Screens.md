# FO-025 - FM Ticketing Frontend Read Screens

## Task ID

FO-025

## Task Title

FM Ticketing Frontend Read Screens

## Purpose

FO-025 introduces the first read-only frontend experience for FM Ticketing. It consumes the existing backend ticketing APIs, reuses the authenticated application shell and RBAC foundation, and intentionally stops before any create, edit, assignment, status-change, or comment-write workflows.

## Scope

- FM Ticketing TypeScript models for list, detail, comment, and history payloads
- Authenticated API service functions for FM ticket list, detail, comments, and history
- Stable TanStack Query keys for list, detail, comments, and history reads
- Permission-guarded list and detail routes under the existing app shell
- Read-only comments and history sections inside the detail screen
- Simple list filtering with a mix of backend exact filters and current-page client search
- Sidebar navigation entry guarded by `fm_tickets.view`
- README and task documentation updates

Out of scope:

- Ticket create forms
- Ticket edit forms
- Assignment UI
- Status-change UI
- Comment creation
- File attachments
- Notifications
- SLA or escalation automation
- AI recommendations
- Maintenance or 5S workflows

## Backend Endpoints Used

- `GET /api/fm-tickets/tickets/`
- `GET /api/fm-tickets/tickets/{id}/`
- `GET /api/fm-tickets/tickets/{id}/comments/`
- `GET /api/fm-tickets/tickets/{id}/history/`

Actual response behavior consumed by the frontend:

- Ticket list returns a paginated payload with `count`, `next`, `previous`, and `results`
- Ticket detail returns a single object
- Comments and history return paginated payloads
- No separate status-history read endpoint is exposed by the current backend routes, so the frontend renders ticket history only

## Frontend Routes Created

- `/fm-tickets`
- `/fm-tickets/[id]`

## Types Created

File: `frontend/types/fm-tickets.ts`

Included:

- `FmTicket`
- `FmTicketListItem`
- `FmTicketDetail`
- `FmTicketComment`
- `FmTicketHistory`
- `FmTicketStatusHistory`
- `FmTicketStatus`
- `FmTicketPriority`
- `FmTicketCategory`
- `FmTicketSource`
- `FmTicketListParams`

## API Services Created

File: `frontend/services/api/fm-tickets.ts`

Functions:

- `getFmTickets`
- `getFmTicket`
- `getFmTicketComments`
- `getFmTicketHistory`

## Query Keys Added

File: `frontend/services/api/query-keys.ts`

Keys:

- `fmTicketsQueryKeys.all`
- `fmTicketsQueryKeys.list(params)`
- `fmTicketsQueryKeys.detail(id)`
- `fmTicketsQueryKeys.comments(id)`
- `fmTicketsQueryKeys.history(id)`

## Components Created

- `frontend/features/fm-tickets/components/ticket-list.tsx`
- `frontend/features/fm-tickets/components/ticket-detail.tsx`
- `frontend/features/fm-tickets/components/ticket-status-badge.tsx`
- `frontend/features/fm-tickets/components/ticket-priority-badge.tsx`
- `frontend/features/fm-tickets/components/ticket-filters.tsx`
- `frontend/features/fm-tickets/components/ticket-comments.tsx`
- `frontend/features/fm-tickets/components/ticket-history.tsx`
- `frontend/features/fm-tickets/components/ticket-shared.tsx`

## Filter Behavior

- `status`, `priority`, `category`, `building`, and `assignee` are sent to the backend as exact-match query parameters because the backend filter helper supports direct field filtering
- `ticket number/title` search is client-side only and applies to the currently loaded page
- Building and assignee dropdown options are derived from the currently loaded ticket page, not from a dedicated lookup endpoint
- The default frontend fetch uses `page_size=100` for the read screen

## Permission Assumptions

- All FM Ticketing frontend read routes require `fm_tickets.view`
- The frontend uses existing `ProtectedPermissionRoute` and sidebar permission filtering
- Backend authorization remains the source of truth
- If permissions fail to load, the existing frontend guard shows safe loading or error states instead of exposing the route content

## Known Limitations

- Search by ticket number or title is not server-backed yet because the current backend filter helper only applies exact query params from an allowlist
- Comments and history read only the first paginated response page currently returned by the backend
- Status history has a backend model and serializer foundation, but no dedicated read route is exposed for the frontend in the current task scope
- Building and assignee filter options reflect the current loaded ticket page only

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

FO-026 - FM Ticketing Create/Edit Forms should build on these read screens and existing ticket types/service foundations without expanding assignment or status workflows prematurely.
