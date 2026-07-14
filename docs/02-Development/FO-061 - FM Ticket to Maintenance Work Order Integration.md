# FO-061 - FM Ticket to Maintenance Work Order Integration

## Status

Complete (FO-061A reconciliation on draft PR #36; awaiting Sol cumulative review before independent approval)

## Purpose

Implements the coordinator-controlled workflow that converts an eligible FM Ticket into one linked Maintenance Work Order after review and assignment.

## FO-061A Correction Scope

Manual testing of FO-061 discovered two connected defects:

1. **Assignment UI incomplete** — `ticket-assignment-panel.tsx` reported assignment as Available but rendered no technician picker or Assign action when state was `ready`. It also checked legacy User Management list discovery instead of FO-048 `users.directory` / `UserDirectoryPicker`.
2. **Generated Work Order assignment incomplete** — `generate_work_order_from_ticket()` copied `ticket.assignee` onto `MaintenanceWorkOrder.assignee` and created the Work Order directly in `assigned` status, without calling `assign_work_order()`. No active `MaintenanceAssignment` was created, leaving assignee field, assignment history, status history, and Maintenance assignment notifications inconsistent.

FO-061A repairs both defects on the same draft PR without starting FO-062.

## Correct Trigger

A Work Order is generated only through an explicit authorized **Generate Work Order** action.

- Requester ticket creation does not create a Work Order.
- Ticket assignment alone does not create a Work Order.

## Schema Relationship

`MaintenanceWorkOrder.source_ticket` is a nullable `OneToOneField` to `fm_tickets.FmTicket`:

- `on_delete=PROTECT`
- `related_name="maintenance_work_order"`
- Manually created Work Orders keep `source_ticket` null
- One Ticket may generate at most one Work Order
- Migration: `maintenance.0005_work_order_source_ticket`
- No additional schema change in FO-061A

## FM Ticket Assignment Workflow

- Endpoint: `POST /api/v1/fm-tickets/tickets/{ticket_uuid}/assign/`
- Permissions: `fm_tickets.assign` for mutation; `users.directory` for picker population
- Frontend reuses shared `UserDirectoryPicker` scoped to the ticket tenant (and organization when present)
- Backend validates active, same-tenant, non-global assignee and eligible roles (`technician`, `facility_manager`, `system_admin`) using the same soft role-intersection rule as Maintenance
- Assign endpoint enforces caller tenant match (generic 404 for inaccessible tickets)
- Supports initial assignment and reassignment; optional note is accepted
- Atomic ticket assignment, status/history updates, and FM assignment notification remain authoritative

## Eligibility Rules

Generation requires:

- Authenticated caller
- Permission: `fm_tickets.assign` or `fm_tickets.manage`
- Ticket tenant matches caller tenant
- Ticket is not soft-deleted
- Ticket has an assigned technician
- Ticket status is `assigned` or `in_progress`
- Ticket has an asset (Maintenance requires asset)
- No existing linked Work Order
- Assignee is active and belongs to the ticket tenant (global/cross-tenant assignees rejected)

Rejected statuses: `draft`, `open`, `on_hold`, `resolved`, `closed`, `cancelled`

Frontend shows a specific disabled reason when generation is unavailable (missing assignee, missing asset, invalid status, already linked, or missing permission).

## API Contract

`POST /api/v1/fm-tickets/tickets/{ticket_uuid}/generate-work-order/`

- Empty request body
- Success: HTTP 201 with `{ id, work_order_number, status, title, source_ticket_id }`
- Errors: 400 eligibility/data, 401 auth, 403 permission, 404 inaccessible/deleted/cross-tenant, 409 already linked

## Field Mapping and Assignment Sequence

| Work Order field | Source |
| --- | --- |
| source_ticket | FM Ticket |
| tenant/org/dept/building/floor/area/asset | Ticket fields |
| requester | ticket.requester |
| assignee | set by `assign_work_order()` from ticket.assignee |
| title/description | ticket fields |
| priority | mapped (`urgent` → `critical`) |
| status | created as `open`, then transitioned to `assigned` by `assign_work_order()` |
| created_by/updated_by | generating coordinator |
| requested_at | ticket.reported_at |
| due_at | ticket.due_at |

Inside the atomic generation transaction:

1. Lock and validate the FM Ticket
2. Create the linked Work Order in `open` (pre-assignment) status with `source_ticket` preserved
3. Call `assign_work_order(..., enforce_permission=False)` so FO-061 generation authorization remains the gate
4. Authoritative Maintenance assignment creates active `MaintenanceAssignment`, Work Order assignee, status/history, SLA first-response effects, and Maintenance assignment notification
5. Record FO-061 linkage history on both Ticket and Work Order

Supervisor remains unset because FM Tickets do not provide an authoritative supervisor source.

## Permission and Tenant Isolation

- Backend permission enforcement is authoritative
- Caller tenant must match ticket tenant (generic 404 otherwise)
- No client-supplied tenant/requester/assignee/source identity
- No superuser cross-tenant bypass for this workflow
- Directory candidates remain tenant-scoped active users only

## Duplicate and Concurrency Protection

- Ticket row locked with `select_for_update` before generation
- Existing link check before create
- Database OneToOne uniqueness
- Second request returns HTTP 409
- Repeated generation creates no duplicate Work Order or active assignment

## Transaction and Rollback Behavior

`generate_work_order_from_ticket()` runs in `transaction.atomic`. Failure of Work Order creation, `assign_work_order()`, assignment notification, or ticket-history recording rolls back the complete workflow. No partial Work Order remains.

## Frontend Behavior

- Functional FM Ticket assignment form using shared directory picker
- Read-only assignee display without `fm_tickets.assign`
- Directory-required message without falsely advertising Available when `users.directory` is missing
- Generate Work Order eligibility explanations
- Linked Work Order summary + View Work Order route to `/maintenance/work-orders/{uuid}`
- Maintenance detail source ticket section with return link to FM Ticket
- Standalone Maintenance create wording clarified as Create Standalone Work Order
- Query invalidation for ticket detail/lists/history, maintenance lists/detail/assignments, and notifications

## Test Coverage

Backend: assignment authorization and isolation, generation with active Maintenance assignment consistency, rollback for assignment/notification failures, duplicate protection, ticket and maintenance detail serialization.

Frontend helper tests: assignment permission state mapping, assign vs reassign labels, UUID payload normalization, generation disabled reasons, linked-record routes.

## Validation

Backend:

- `python manage.py test apps.fm_tickets --noinput` -> passed (63 tests)
- Related suite results recorded during FO-061A validation run
- `python manage.py check` -> passed
- `python manage.py makemigrations --check --dry-run` -> no changes detected

Frontend:

- Helper tests include FO-061A assignment and generation coverage
- `npm run lint`, `npx tsc --noEmit`, and `npm run build` recorded during FO-061A validation run

## Deferred Scope

- FO-062 status synchronization
- Automatic Ticket closure from Work Order completion
- Automatic Work Order creation on ticket create or assign
- Supervisor inference
- Attachment/comment/AI transfer
- Work Order deletion/unlinking
- Multiple Work Orders per Ticket
- Assignment teams or maintenance trades
- Broad Maintenance form redesign
- External delivery channels
