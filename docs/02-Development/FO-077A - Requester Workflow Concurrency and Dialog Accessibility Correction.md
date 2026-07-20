# FO-077A - Requester Workflow Concurrency and Dialog Accessibility Correction

## Status

Correction implemented on `feature/employee-requester`. Pull request #42 remains
open, draft, and unmerged. FO-078 has not started.

## Confirmed defects

### A — Transaction locking race

`requester_cancel_ticket()`, `requester_acknowledge_ticket()`, and
`requester_reopen_ticket()` received a previously loaded `Ticket` and validated
eligibility before any row lock. Concurrent requester actions could therefore
validate stale status and both attempt a transition.

### B — Incomplete confirmation dialog semantics

`MyRequestWorkflowActions` rendered `role="dialog"` with `aria-modal="true"` as
an inline panel without accessible naming, focus management, focus trap, Escape
handling, or background interaction blocking.

## Correction A — Ticket locking design

Inside each authoritative requester service:

1. Enter `transaction.atomic`
2. Reload the Ticket with `select_for_update`
3. Revalidate requester identity, ownership, tenant match, deletion state, and
   current status against the locked row (do not trust pre-lock eligibility)
4. Perform the transition via existing `change_ticket_status()` on the locked
   instance

Losing concurrent requests raise the established `ValidationError` → HTTP 400
path and create no second status history or notification. API-boundary generic
404 isolation for non-owned and cross-tenant IDs is unchanged because object
resolution still uses the scoped queryset before the service runs.

Notification failure continues to roll back status and history through the
existing nested atomic contract.

## Work Order locking decision

Cancellation inspects linked Maintenance execution after the Ticket lock.

**Locking order: Ticket → Work Order (when present).**

Rationale:

- `generate_work_order_from_ticket()` already locks the Ticket first. Matching
  that order avoids deadlocks with Work Order generation.
- Locking the linked Work Order after the Ticket yields a consistent active-
  execution view under row locks and closes status races where a Work Order
  could become active while cancellation proceeds on a stale relation cache.
- Smallest correct set: Ticket always; Work Order only for cancel when linked.

## Correction B — Accessible confirmation dialog

My Requests workflow confirmation is now a fixed overlay modal following the
existing master-data / RBAC dialog pattern (no new dependency):

- `aria-labelledby` / `aria-describedby` connected to title and description
- Initial focus on the reason field when required, otherwise the dismiss control
- Tab / Shift+Tab cycle within the dialog
- Escape closes only when no mutation is pending
- Focus returns to the opening action button
- Backdrop blocks background interaction; pending state blocks close and duplicate submit
- Reason validation remains associated with the reason field
- Narrow-screen layout uses full-width, scrollable dialog panel

Helpers live in `frontend/lib/my-requests/workflow-dialog.ts`.

## Tests added

Backend (`TransactionTestCase` where genuine concurrency is required):

- Two concurrent acknowledgements → one successful transition only
- Acknowledge versus reopen from the same resolved state → only one commits
- Two concurrent cancellations → one transition/history/notification only
- Eligibility rechecked after locked-row refresh
- Active linked Work Order still blocks cancellation
- Notification failure still rolls back

Frontend helper tests:

- Accessible dialog label/description identifiers
- Escape-close eligibility and pending-state close prevention
- Initial-focus target selection
- Focus-return target behavior
- Tab cycle within dialog controls
- Reason validation, eligibility, and success/error copy unchanged

## Validation

- Stage 1: requester concurrency 6 passed; existing workflow 15 passed (21 total)
- Stage 1: frontend dialog helpers 7 passed
- Stage 2 / module regression: `apps.fm_tickets` + `apps.notifications` = **202 passed**
- Frontend helper suite: **264 passed**; ESLint clean; TypeScript clean
- Production build: passed
- Django check: passed; migration drift: none
- Full backend `--parallel 4`: **654 passed** (exit 0)
- `git diff --check`: clean

### Test infrastructure note

During validation, stale PostgreSQL `idle in transaction` sessions on
`test_facilityops_db` blocked keepdb reuse and one interrupted mid-run produced
transient `connection already closed` errors in unrelated Work Order tests.
Confirmed stale backends were terminated; the module suite was retried once on a
fresh test database and passed. This was test infrastructure, not a product
failure.

## Deferred

- Comments, attachments, AI
- Manual browser acceptance
- FO-078 cumulative QA

## Pull request

PR #42 remains open, draft, and unmerged.
