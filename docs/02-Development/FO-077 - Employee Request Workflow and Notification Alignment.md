# FO-077 - Employee Request Workflow and Notification Alignment

## Status

Implemented on `feature/employee-requester`. Pull request #42 remains open,
draft, and unmerged. FO-077A corrected requester workflow concurrency locking
and confirmation-dialog accessibility on the same branch. FO-078 has not
started. Manual browser acceptance remains pending.

## Objective

Add requester-owned cancel, acknowledge, and reopen workflows for Employee My
Requests, and align FM Ticket status notifications so Employee requesters open
`/my-requests/{uuid}` while operational recipients keep `/fm-tickets/{uuid}`.

## Authoritative transition findings

Existing frontend/operational transition map already supports:

- Cancel from pre-execution statuses including `draft`, `open`, `assigned`, and
  `on_hold`
- Acknowledge as `resolved` → `closed`
- Reopen as `resolved` → `in_progress`

Backend `change_ticket_status()` remains the authoritative atomic service for
status, timestamps, history, and notifications. FO-077 adds dedicated requester
endpoints that call that service after ownership and eligibility checks. No new
status values or migrations were introduced.

## Implemented requester actions

| Action | Endpoint | Eligibility |
|--------|----------|-------------|
| Cancel | `POST .../requester-cancel/` | Own ticket; status in draft/open/assigned/on_hold; no active linked Maintenance Work Order; required reason |
| Acknowledge | `POST .../requester-acknowledge/` | Own ticket; status `resolved`; closes to `closed` |
| Reopen | `POST .../requester-reopen/` | Own ticket; status `resolved`; required reason; returns to `in_progress` |

Employee detail responses expose advisory flags:

- `can_cancel`
- `can_acknowledge`
- `can_reopen`

## Deferred / unsupported

- Comments remain deferred
- Attachments and AI remain outside this feature
- Cancel from `in_progress` remains blocked as active ticket execution
- Cancel remains blocked when a linked Work Order is in active Maintenance
  execution
- FO-078 cumulative QA has not started

## Ownership and isolation

- Dedicated endpoints require Employee requester mode and `fm_tickets.view`
- Scope uses existing requester-owned queryset; non-owned and cross-Tenant IDs
  return generic 404
- Staff alone provides no bypass
- Superuser / system_admin / multi-role operational accounts receive 403 on
  requester endpoints and keep operational `change-status`
- Payload cannot set requester, tenant, organization, assignee, or arbitrary
  status

## Notifications

- Actor exclusion and recipient deduplication preserved
- Employee requester recipients receive `/my-requests/{ticket_uuid}`
- Operational recipients continue to receive `/fm-tickets/{ticket_uuid}`
- Frontend also remaps legacy `/fm-tickets/{uuid}` targets for Employee mode
- Notification failure remains inside the existing transactional rollback
  contract

## Frontend

My Requests detail shows eligible Cancel / Acknowledge / Reopen actions only,
with an accessible confirmation modal (FO-077A), required reasons where
applicable, pending disablement, accessible success/error messaging, and cache
invalidation for My Requests, notifications, and FM Ticket keys.

## Concurrency (FO-077A)

Authoritative requester services lock and reload the Ticket with
`select_for_update` before eligibility revalidation. Cancellation also locks the
linked Work Order after the Ticket (order: Ticket → Work Order) when present.

## Validation

- Backend focused workflow tests: 15 passed (FO-077); FO-077A adds 6 concurrency tests
- FO-075 requester field regression updated for workflow flags
- Affected modules after FO-077A: `apps.fm_tickets` + `apps.notifications` = 202 passed
- Frontend helper tests after FO-077A: 264 passed
- ESLint and TypeScript: passed
- Production build: passed
- Django check: passed
- Migration drift: none
- Full backend `--parallel 4` after FO-077A: 654 passed (exit 0)

## Pull request

PR #42 remains open, draft, and unmerged.
