# FO-062 - FM Ticket and Work Order Status Synchronization

## Status

Complete on draft PR #36 (implementation + automated validation). Broader FM Ticket ↔ Maintenance Integration remains **In Progress** until final QA. Automatic Ticket closure remains deferred (FO-063).

## Business Outcome

Users track one continuous operational process:

FM Ticket → Work Order generated → technician starts work → work held/resumed → work completed → FM Ticket becomes **resolved** → authorized Ticket closure remains a separate FM Ticket action.

## Authoritative Direction

**One-way only:** Maintenance Work Order workflow status → linked FM Ticket status.

Do not synchronize FM Ticket status → Maintenance Work Order status. This avoids circular ownership and conflicting workflow authority.

Maintenance execution remains authoritative during linked maintenance work.

## Status Mapping

| Maintenance action/status | Linked FM Ticket status | Behavior |
| --- | --- | --- |
| Work Order generated and assigned | `assigned` | Normally already set by Ticket assignment; idempotent if revisited |
| Start → `in_progress` | `in_progress` | Synchronize |
| Resume → `in_progress` | `in_progress` | Synchronize |
| Reopen → `reopened` | `in_progress` | Reopen Ticket execution; clear resolution timestamps |
| Hold → `on_hold` | `on_hold` | Synchronize |
| Complete → `completed` | `resolved` | Work done; Ticket is **not** closed |
| Cancel → `cancelled` | No automatic Ticket cancellation | Record `linked_work_order_cancelled` history; coordinator decides Ticket outcome |
| Close → `closed` | No automatic Ticket closure | No Maintenance `close` workflow action is present; Ticket closure remains separately authorized |
| Standalone Work Order | No Ticket action | Missing `source_ticket` skips safely |

No new status values were introduced.

## Closed Ticket Conflict Rule

If the linked FM Ticket is already `closed` or `cancelled` and a Maintenance action would require changing Ticket status:

- Synchronization raises a clear `ValidationError`
- The Maintenance workflow action rolls back completely
- The closed Ticket is **not** silently reopened

## Service Architecture

Dedicated service: `backend/apps/maintenance/ticket_sync_service.py`

Public entry point:

`synchronize_source_ticket_status(*, work_order, previous_work_order_status, actor, maintenance_action)`

Wired from the authoritative Maintenance transition helper `_transition_work_order()` after Work Order status/history persistence and before Maintenance status notifications.

Not placed in views, serializers, models, signals, frontend code, or notification services.

Reuses:

- `apps.fm_tickets.services.change_ticket_status()` for mapped status transitions
- `apps.fm_tickets.services.record_ticket_history()` for sync metadata and cancel-linked history

## Tenant Isolation

Before synchronization:

- Work Order and source Ticket must share the same tenant
- Source Ticket must not be soft-deleted
- Actor authorization remains the Maintenance workflow permission already enforced for the action
- No second FM Ticket mutation permission is required for this internal system sync
- Ticket IDs and target statuses are never accepted from the frontend
- Tenant mismatch or deleted Ticket raises `ValidationError` and rolls back the Maintenance action

Ticket is re-fetched with `select_for_update` inside the active Maintenance transaction to avoid stale FK caches.

## Transaction and Rollback Behavior

Synchronization runs synchronously inside the same `transaction.atomic` boundary as the Maintenance workflow action.

Order:

1. Validate Maintenance transition
2. Persist Work Order transition and workflow history
3. Synchronize linked Ticket when mapped (or record cancel-linked history)
4. Emit normal Maintenance notifications
5. Commit

Unexpected Ticket sync / Ticket history / Ticket notification failures roll back Work Order status, Maintenance history, completion/reopen/SLA effects, Ticket history, and notifications together.

No signals, `transaction.on_commit`, Celery, background jobs, or WebSocket/SSE transport.

## History Behavior

Mapped transitions produce normal FM Ticket status history through `change_ticket_status()`.

Additional Ticket general history action `work_order_status_synchronized` includes safe metadata:

- `event`
- `work_order_id`
- `work_order_number`
- `from_work_order_status`
- `to_work_order_status`
- `target_ticket_status`
- `maintenance_action`

Cancel records `linked_work_order_cancelled` without changing Ticket status.

## Notification Behavior

- Maintenance status actions keep their normal Maintenance notifications
- Mapped Ticket status changes produce normal FM Ticket status notifications when the Ticket actually changes
- Actor exclusion and recipient deduplication remain active
- Standalone Work Orders produce no Ticket notification
- No-op Ticket synchronization (already at target status) creates no Ticket notification or sync history
- No new notification model or delivery channel

## Frontend Behavior

No second status mutation and no manual sync button.

After successful Maintenance workflow mutations (start/hold/resume/complete/cancel/reopen), query invalidation includes:

- Maintenance detail/lists/history/assignments/SLA/escalations
- Linked FM Ticket detail/lists/history when `source_ticket.id` is present
- Notification queries

Maintenance detail shows:

“Updates to this linked Work Order may update the source FM Ticket’s execution status.”

FM Ticket detail continues to show linked Work Order number, status, and navigation.

## Tests and Validation

Backend coverage in `apps.maintenance.tests.test_ticket_sync` includes start/hold/resume/complete/reopen/cancel paths, standalone skip, no-op prevention, closed-ticket conflict rollback, soft-delete and cross-tenant isolation, notification/history metadata, and atomic rollback on Ticket sync/notification failure.

Frontend helper tests cover linked Ticket invalidation targets, sync messaging, and absence of a manual sync action.

### Validation results (2026-07-14)

| Command | Exit | Result |
| --- | --- | --- |
| `python manage.py test apps.fm_tickets --noinput` | 0 | Ran 63 — OK |
| `python manage.py test apps.maintenance --noinput` | 0 | Ran 84 — OK |
| `python manage.py test apps.notifications --noinput` | 0 | Ran 78 — OK |
| `python manage.py test apps.accounts apps.access_control --noinput` | 0 | Ran 109 — OK |
| `python manage.py test --parallel 4 --noinput` | 0 | Ran 426 — OK |
| `python manage.py check` | 0 | No issues |
| `python manage.py makemigrations --check --dry-run` | 0 | No changes detected |
| `npm test` | 0 | 126 helper tests pass |
| `npm run lint` | 0 | ESLint passed |
| `npx tsc --noEmit` | 0 | TypeScript passed |
| `npm run build` | 0 | Production build passed |

Manual browser smoke: not Codex-executed in this task (pending local user confirmation).

## Deferred Scope

- Automatic FM Ticket closure (FO-063)
- Reverse Ticket → Work Order synchronization
- Automatic Ticket cancellation
- Supervisor approval redesign
- Attachment/comment/AI transfer
- Multiple Work Orders per Ticket
- WebSocket/SSE realtime transport
- Email/SMS/push delivery
- Background synchronization jobs
- Broad workflow refactoring
