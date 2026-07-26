# FO-063 - Automatic FM Ticket Closure

## Status

Implementation complete on `feature/fm-ticket-auto-closure`. Automated
validation pending/recorded in this document. Pull request remains **Draft**
and **unmerged**. Manual browser acceptance is **pending**. FO-079 has not
started.

## Business objective

When a resolved FM Ticket remains unacknowledged for a configured period, close
it automatically through a scheduled, tenant-isolated background process while
preserving requester acknowledge/reopen workflows, operational permissions,
audit history, notifications, and established API contracts.

## Closure-period decision

| Setting | Default | Notes |
| --- | --- | --- |
| `FM_TICKET_AUTO_CLOSE_DAYS` | **7** | Full calendar days from authoritative `resolved_at` |
| `FM_TICKET_AUTO_CLOSE_BATCH_SIZE` | 100 | Bounded batch per run |
| `FM_TICKET_AUTO_CLOSE_ENABLED` | True | Disables Celery Beat entry and task body when false |

Deadline comparison: `resolved_at <= now - timedelta(days=N)`. Exact-boundary
tickets are eligible. Hourly Beat scheduling means closure is not guaranteed to
the minute.

## Reconciliation with reserved FO-063 wording

FO-062D reserved FO-063 for automatic closure after the Maintenance approval /
closure path that leaves tickets in `RESOLVED`. FO-062 intentionally stops at
`RESOLVED`. This implementation closes **any** eligible `RESOLVED` ticket after
the acknowledgement period, including tickets resolved operationally without a
Work Order. That satisfies the reserved next-step after Maintenance-driven
resolution and matches the explicit FO-063 product contract.

## Eligibility rules

A ticket is eligible only when all are true:

- Active Tenant (`is_active`, not soft-deleted)
- Status is `RESOLVED`
- `resolved_at` is present
- `resolved_at` is at or before the cutoff
- Not soft-deleted
- Locked revalidation still finds the ticket eligible

Acknowledgement already transitions `RESOLVED → CLOSED`, so acknowledged
tickets are excluded by status. Reopen clears `resolved_at` and moves to
`in_progress`, so stale eligibility cannot force closure.

## Authoritative resolution timestamp

`FmTicket.resolved_at`, set by `_apply_status_timestamps` when entering
`RESOLVED` (and preserved on `RESOLVED → CLOSED`). No new model field.

## Status transition

Uses established `change_ticket_status(..., to_status=CLOSED, changed_by=None)`:

- Note: `Automatically closed after the acknowledgement period expired.`
- History description: automatic-closure wording
- History metadata: `source=automatic_closure`, `auto_close_days`, `resolved_at`
- Notifications: requester-specific auto-close copy; operational recipients keep
  status-change notification through existing recipient rules

## Backend service

`apps.fm_tickets.auto_closure`:

- `is_ticket_eligible_for_auto_close`
- `eligible_auto_close_queryset`
- `auto_close_resolved_ticket` — `select_for_update`, revalidate, close
- `process_automatic_ticket_closures` — bounded batch, per-ticket isolation
- `ticket_was_automatically_closed` — read helper for serializers

## Celery task and schedule

- Task: `fm_tickets.process_automatic_ticket_closures`
- Module: `apps.fm_tickets.tasks`
- Beat: hourly (`crontab(minute=0)`) when `FM_TICKET_AUTO_CLOSE_ENABLED=True`
- Management command: `process_fm_ticket_auto_closures` for manual/dev runs
  (`--days`, `--batch-size`)

## Concurrency and idempotency

- Row lock before revalidation
- Already-closed / non-resolved tickets skip without duplicate history
- Repeated task runs close each ticket at most once
- One failed ticket is logged and does not stop independent successes
- Notification failure inside `change_ticket_status` rolls back the transition

## Tenant isolation

- Query filters by active Tenant
- History/notifications inherit ticket Tenant via existing services
- Recipient eligibility remains same-Tenant
- No client Tenant/requester identity influences the worker

## Frontend behavior

- My Requests detail exposes read-only `closed_automatically`
- Closed automatic requests show acknowledgement-period guidance and timestamp
- Manual/acknowledge closures show generic closed guidance
- Operational history shows null actor as “System activity” plus the automatic
  note/metadata
- No new mutation endpoints or workflow actions

## API impact

- Additive read-only field `closed_automatically` on Employee detail serializer
- Optional kwargs on `change_ticket_status` / `notify_fm_ticket_status_changed`
  for history and notification context (backward compatible defaults)

## Tests

Backend `apps.fm_tickets.test_auto_closure` covers eligibility timing, status
exclusions, acknowledge/reopen protection, idempotency, batch isolation,
Tenant separation, notification rollback, and Celery enable flag.

Frontend helper tests cover automatic vs manual closed guidance text.

## Validation

| Gate | Result |
| --- | --- |
| Focused `test_auto_closure` | 18 passed |
| Related FM Ticket workflow/requester + notifications | 132 passed |
| Full backend `--parallel 4 --noinput` | **679 passed** |
| Frontend helper tests | **268 passed** |
| ESLint | Passed |
| TypeScript / production build | Passed |
| Django check | Passed |
| Migration drift | **None** |
| Dependencies | **None added** |

## Manual acceptance checklist

1. Sign in as an Employee requester.
2. Open a resolved ticket owned by that requester.
3. Confirm resolved status and timestamps.
4. Shorten the period (`FM_TICKET_AUTO_CLOSE_DAYS=0` or `--days 0`) or age
   `resolved_at` via approved fixture.
5. Run `python manage.py process_fm_ticket_auto_closures` (or wait for Beat).
6. Confirm the ticket becomes closed.
7. Confirm the UI explains automatic closure.
8. Confirm the closure timestamp is visible.
9. Confirm the requester in-app notification mentions acknowledgement expiry.
10. Open the notification and confirm `/my-requests/{id}`.
11. Confirm reopen is unavailable after close (existing `RESOLVED`-only rule).
12. Confirm acknowledge before the deadline prevents automatic closure.
13. Confirm a reopened ticket is not closed from stale state.
14. Confirm another requester cannot access the ticket.
15. Confirm a Facility Manager sees System activity / automatic history.
16. Confirm no email/SMS/push was introduced.
17. Confirm manual close and other FM Ticket workflows still work.

## Deferred

- FO-079
- Comments, attachments, AI
- Email/SMS/push, WebSocket/SSE
- Per-Tenant closure-period UI
- FO-078B-O1 and FO-078-O1–O6 polish

## Pull request

Draft PR targeting `main` from `feature/fm-ticket-auto-closure`. Merge pending
manual acceptance and explicit authorization.
