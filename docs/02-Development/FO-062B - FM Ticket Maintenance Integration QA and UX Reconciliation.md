# FO-062B - FM Ticket Maintenance Integration QA and UX Reconciliation

## Status

Complete — cumulative QA and confirmed UX reconciliation for FO-061 through FO-062A on draft PR #36 (2026-07-15). Automatic Ticket closure remains deferred (FO-063). PR #36 remains open, draft, and unmerged pending Sol’s final cumulative PR review.

## Purpose

Complete cumulative QA for FO-061 through FO-062A and reconcile confirmed Maintenance UX issues discovered during user browser testing so the experience clearly separates:

1. Standalone Work Order creation
2. Technician/Supervisor assignment
3. Status workflow actions
4. Linked FM Ticket synchronization
5. Deferred capabilities that are not currently persisted

## Confirmed Defects Corrected

### FO-062A (prior, retained)

- Frontend Zod allowed location-only create; backend requires Asset (and Building).
- `mutateAsync` create failures escaped to the Next.js runtime overlay.
- Structured API field errors lost field context (`This field may not be null.` without `Asset:`).

### FO-062A follow-ups (prior, retained)

- Workflow Hold/Complete/`mutateAsync` rejections escaped to the runtime overlay.
- Complete confirmation dialog overflowed the viewport and hid action buttons.

### FO-062B UX

- Outdated Create/Edit copy claimed assignment persistence was deferred.
- Create/Edit exposed non-persisted planning controls (category, type, notes, location description, team assignment, estimated hours, task/material/labor rows, disabled file input, disabled Save draft).
- Awkward workflow success wording (`Start completed successfully.` / `Resume completed successfully.`).
- Create/Edit lacked clear guidance that assignment and status live on Work Order Details, and that Ticket-originated work should use Generate Work Order.

## Form Simplification

Removed non-persisted Create/Edit controls confirmed absent from `WorkOrderCreateSerializer` / `WorkOrderUpdateSerializer` and from create/update payloads:

- Maintenance category
- Maintenance type
- General planning notes
- Free-text location description
- Team or department assignment
- General estimated hours
- Planning-only task, material, and labor rows
- Disabled attachment file input
- Disabled “Save draft unavailable” action

Retained informational guidance only:

- Assignment: create first; manage Technician/Supervisor from Work Order Details.
- Attachments: available when the Maintenance upload workflow becomes available.
- Workflow location: Details for assignment and status; Generate Work Order from eligible Tickets.

## Final Persisted Standalone Form Contract

Visible and submitted fields align with the backend create/update contract:

- Title, Description, Priority
- Asset (required)
- Tenant, Organization, Department (optional)
- Building (required), Floor (optional), Area (optional)
- Requested by / Requested date (display; requester owned by session)
- Due date
- Scheduled start / Scheduled end

FO-062A Asset and Building client validation and structured API field-error handling remain in place.

## Workflow Success Messages

Consistent frontend wording:

- Work order assigned / reassigned / unassigned successfully.
- Work order started / placed on hold / resumed / completed / cancelled / reopened successfully.
- Work order submitted successfully.

## Cumulative Contract Review

### Relationship

- One Ticket → maximum one linked Work Order (`source_ticket` OneToOne).
- Standalone Work Orders keep `source_ticket = null`.
- Bidirectional UUID navigation remains available in detail summaries.

### Assignment

- Same-tenant active technicians via shared directory / Maintenance candidates.
- Generated Work Orders receive one active `MaintenanceAssignment` matching Ticket assignee through `assign_work_order()`.
- Standalone assignment remains post-creation on Work Order Details.
- Supervisor remains optional.

### Generation

- Explicit coordinator Generate Work Order only.
- Ticket create/assignment do not auto-generate.
- Asset, assignee, and eligible status required; duplicate generation returns 409.

### Synchronization

- Work Order → Ticket only.
- Start/Resume/Reopen → Ticket `in_progress`
- Hold → Ticket `on_hold`
- Complete → Ticket `resolved` (not closed)
- Cancel → Ticket status unchanged + linked cancel history
- Standalone Work Orders skip Ticket sync
- No automatic Ticket closure

### Security

- Backend remains authoritative.
- Same-tenant linkage required; inaccessible records remain generic 404.
- Frontend cannot submit source Ticket or force synchronized Ticket status.

### History and notifications

- Synchronized transitions record Ticket status history plus synchronization metadata.
- Two audit entries per synchronized action remain acceptable (Status Changed + Work Order Status Synchronized).
- Assignment and status notifications remain module-scoped; actor exclusion and deduplication preserved.
- Standalone actions create no FM Ticket notification.

## Realtime Limitation

Cross-tab realtime refresh is not implemented.

- Same-query-client mutations invalidate related queries.
- Separately opened browser tabs may require manual refresh.
- WebSocket/SSE remains deferred.
- No polling was added in FO-062B.

## Attachment Deferral

Attachment upload is not implemented. Create/Edit shows an informational message only; no nonfunctional file chooser.

## User-Executed Manual Acceptance (2026-07-15)

Recorded as user-executed browser tests. Codex did not execute these browser tests.

### FM Ticket → Work Order

- Same-tenant technician picker worked.
- Ticket assignment succeeded; Ticket became Assigned.
- Linked Work Order generation succeeded with the same technician.
- FM Ticket and Maintenance assignment notifications appeared.
- Ticket ↔ Work Order navigation worked.

### Standalone Work Order

- Standalone creation succeeded after FO-062A.
- Technician assignment succeeded from Work Order Details.
- Start → Hold → Resume → Complete lifecycle succeeded; completion date recorded; Reopen available.
- No linked FM Ticket was affected.

### Linked Work Order synchronization

- Start/Hold/Resume synchronized Ticket statuses as mapped.
- Complete synchronized Ticket to Resolved; Work Order ended Completed.
- FM Ticket remained Resolved, not Closed.
- Ticket history contained synchronized transitions; linked summary showed Completed.
- No automatic Ticket closure occurred.

### Manual limitations

- One successful same-tenant linked workflow
- One successful standalone workflow
- Rejection/isolation matrix primarily automated
- Cross-tab realtime refresh not implemented
- Attachment upload not implemented

## Automated Validation

| Command | Exit | Result |
| --- | --- | --- |
| `python manage.py test apps.fm_tickets --noinput` | 0 | Ran 63 — OK |
| `python manage.py test apps.maintenance --noinput` | 0 | Ran 84 — OK |
| `python manage.py test apps.notifications --noinput` | 0 | Ran 78 — OK |
| `python manage.py test apps.accounts apps.access_control --noinput` | 0 | Ran 109 — OK |
| `python manage.py test --parallel 4 --noinput` | 0 | Ran 426 — OK |
| `python manage.py check` | 0 | No issues |
| `python manage.py makemigrations --check --dry-run` | 0 | No changes detected |
| `python manage.py showmigrations fm_tickets maintenance` | 0 | fm_tickets 0001–0002; maintenance 0001–0005 applied |
| `npm test` | 0 | 135 helper tests pass |
| `npm run lint` | 0 | ESLint passed |
| `npx tsc --noEmit` | 0 | TypeScript passed |
| `npm run build` | 0 | Production build passed |

No backend tests were added in FO-062B; existing FO-062 sync/generation coverage already asserts standalone skip, completion → resolved (not closed), cancel/history, reopen, and rollback paths.

## Remaining Deferred Scope

- Automatic FM Ticket closure (FO-063)
- Reverse Ticket → Work Order status sync
- Attachment upload workflow
- Cross-tab realtime (WebSocket/SSE/polling)
- Planning line-item persistence on create/update APIs
- Save draft

## Status Conclusions

- FO-062A: Complete
- FO-062B: Complete
- FO-062 status synchronization: Complete
- FM Ticket–Maintenance Integration implementation: Complete
- Draft PR #36: remains open, draft, and unmerged pending Sol’s final cumulative PR review
