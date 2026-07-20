# FO-076 - Employee My Requests Frontend Experience

## Status

Implemented on `feature/employee-requester`. FO-075 was independently approved at
`513977a66e69c572948e8a22af24da23ab81f99d`. FO-077 requester workflow and
notification alignment is implemented on the same branch. Pull request #42
remains open, draft, and unmerged. FO-078 has not started.

## Objective

Deliver the requester-safe Employee frontend experience on top of the approved
FO-075 backend foundation without weakening backend authorization or exposing
operational FM Ticket controls.

## Role and access-mode contract

- Active role codes from `GET /access-control/me/permissions/` are now preserved
  in frontend auth state and cleared on login, logout, failed refresh, and token
  loss through the existing `clearSessionQueryCache` architecture.
- Employee requester mode requires active `employee` role plus
  `fm_tickets.view` / `fm_tickets.create` as applicable.
- `system_admin`, `facility_manager`, `technician`, and `viewer` retain the
  existing operational FM Ticketing experience when also assigned Employee.
- Staff alone provides no bypass.
- Fail closed while roles or permissions are loading or unavailable.
- Frontend limitation: flattened permissions cannot attribute
  `fm_tickets.view` to a specific non-employee custom role the way backend
  `_has_broader_fm_ticket_permission()` excludes the Employee role. Known
  operational system roles and any FM Ticket permission beyond view/create are
  treated as operational. A later backend-derived `access_mode` field is
  recommended to remove this ambiguity.

## Routes and navigation

- `/my-requests`
- `/my-requests/new`
- `/my-requests/[id]`

Employee-only navigation shows Dashboard and My Requests only. Operational
navigation (FM Ticketing, Maintenance, 5S Inspection, Reporting, Master Data,
Admin) is hidden for Employee requester mode. Multi-role operational users keep
FM Ticketing and do not receive a duplicate My Requests entry.

Operational route reconciliation redirects Employee-only users from
`/fm-tickets`, `/fm-tickets/new`, and `/fm-tickets/{uuid}` to the corresponding
My Requests routes before operational screens render.

## API and query contracts

Reuses the existing FM Ticket API client:

- `GET /api/fm-tickets/tickets/` requester-owned list
- `GET /api/fm-tickets/tickets/{id}/` requester-safe detail
- `POST /api/fm-tickets/tickets/` safe create payload
- `GET /api/fm-tickets/tickets/request-options/` scoped options without
  `settings.view`

Query keys:

- `myRequests()`
- `myRequestList(params)`
- `myRequestDetail(id)`
- `myRequestOptions()`

Hooks remain disabled until auth restoration, permissions/roles readiness,
Employee requester mode, and required permission are confirmed.

## Requester-safe UI

### List

Paginated requester-owned list with status/category filters, loading/error/
empty/filtered-empty states, and requester-friendly status labels.

### Create

Visible controls: title, description, category, building, optional floor/area/
asset, read-only organization context. Payload contains only approved fields.
Cascading location resets prevent stale hidden selections. Attachment guidance
only; no file input.

### Detail

Displays requester-safe fields only with status guidance and deferred comments/
response guidance. No operational actions or internal metadata.

## Deferred behavior

- Attachments
- Public comments
- AI

FO-077 adds cancel, acknowledge, and reopen workflows plus notification target
alignment. FO-078 remains pending.

## Validation

Frontend helper tests: 24 new My Requests tests (24/24 pass).

Final frontend gates on branch:

- `npm test`: 251 passed (24 new My Requests tests)
- `npm run lint`: passed
- `npx tsc --noEmit`: passed
- `npm run build`: passed

Backend unchanged from FO-075 baseline: 633 tests, Django check passed, no
migration drift.

## Pull request

PR #42 remains open, draft, and unmerged.
