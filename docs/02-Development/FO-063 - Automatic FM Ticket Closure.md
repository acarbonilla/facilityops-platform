# FO-063 - Automatic FM Ticket Closure

## Status

Implementation complete. Manual acceptance **passed** on **2026-07-27** against
the local development environment using safe `FO-063-ACCEPT` prefixed test data.
Final pre-merge validation is recorded below. PR #43 is advanced to Ready for
Review and then merged under the FO-063 merge-lifecycle authorization.

FO-078D (Employee-Safe Maintenance Notification Routing) has **not** started.
FO-079 has **not** started. No attachment or AI scope was included.

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
the minute. Management command `--days` may override the period for local
acceptance; values `< 1` are rejected by the settings helper and fall back to 7
unless supplied as an explicit command/runtime override.

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

## Manual acceptance

| Field | Value |
| --- | --- |
| Date | 2026-07-27 |
| Environment | Local development (`config.settings.development`, SQLite `db.sqlite3`, `runserver` + `npm run dev` available) |
| Executor | Codex/Cursor implementation engineer under Product Owner merge-lifecycle authorization |
| Test data | Isolated tenants `fo063-accept-a` / `fo063-accept-b` and tickets titled `FO-063-ACCEPT *` only |
| Defects found | None blocking. During an early acceptance attempt, a global `--days 0` command briefly closed two pre-existing resolved tickets; both were restored to `RESOLVED` with auto-close history/notifications removed before final acceptance. Final harness scoped batch processing to FO-063 acceptance tickets only. |
| Defects corrected | None in product code (acceptance harness scoping only; harness not committed) |
| Result | **PASSED** (17/17 acceptance checks) |

### Acceptance evidence (summary)

1. Eligible `RESOLVED` ticket with `resolved_at` created — PASS
2. Processor closed ticket; `closed_automatically` true — PASS
3. Status/history note and metadata `source=automatic_closure`; null/system actor — PASS
4. Requester notification target `/my-requests/{id}`; assignee `/fm-tickets/{id}` — PASS
5. Second run idempotent (no duplicate close/history/auto-close notifications) — PASS
6. Acknowledge-before-deadline prevents auto-close — PASS
7. Reopen clears `resolved_at` and prevents auto-close — PASS
8. Recent/ineligible, soft-deleted, inactive-tenant tickets unchanged — PASS
9. Cross-tenant notifications remain tenant-bound; no cross-tenant leak — PASS
10. Structured counts returned (`examined`/`closed`/`skipped`/`failed`/…) — PASS
11. Manual `RESOLVED → CLOSED` remains distinguishable — PASS
12. My Requests auto vs manual guidance helpers present — PASS
13. Management command path with scoped `--days 0` — PASS
14. Employee detail serializer `closed_automatically` true/false — PASS

Employee Maintenance notification routing defects remain deferred to **FO-078D**
and were not introduced or expanded in FO-063.

## Validation

| Gate | Result |
| --- | --- |
| Focused `apps.fm_tickets.test_auto_closure` | **18 passed** |
| Related `apps.fm_tickets` + `apps.notifications` | **220 passed** |
| Full backend `--parallel 4 --noinput` | **679 passed** |
| Full frontend (`npm test -- --run`) | **268 passed** |
| ESLint | Passed |
| TypeScript (`tsc --noEmit`) | Passed |
| Production build | Passed |
| Django check | Passed (0 issues) |
| Migration drift (`makemigrations --check --dry-run`) | **No changes detected** |
| Dependencies | **None added** |
| `git diff --check` | Clean (CRLF warnings only) |

## Deferred

- FO-078D Employee-Safe Maintenance Notification Routing (next defect correction)
- FO-079 Secure Attachment Backend and Storage Foundation (not started)
- Comments, attachments, AI
- Email/SMS/push, WebSocket/SSE
- Per-Tenant closure-period UI
- FO-078B-O1 and FO-078-O1–O6 polish

## Pull request / merge

- Branch: `feature/fm-ticket-auto-closure`
- PR: [#43](https://github.com/acarbonilla/facilityops-platform/pull/43)
- Starting Draft HEAD: `be4f5fc012ca484fa564a07f7896c5b6fcb26fed`
- Acceptance/readiness documentation commit recorded on the feature branch before
  Ready-for-Review and merge
- Merge status: updated after GitHub merge completes
