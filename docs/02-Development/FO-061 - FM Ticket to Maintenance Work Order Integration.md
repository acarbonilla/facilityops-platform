# FO-061 - FM Ticket to Maintenance Work Order Integration

## Status

Complete

## Purpose

Implements the coordinator-controlled workflow that converts an eligible FM Ticket into one linked Maintenance Work Order after review and assignment.

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

## API Contract

`POST /api/v1/fm-tickets/tickets/{ticket_uuid}/generate-work-order/`

- Empty request body
- Success: HTTP 201 with `{ id, work_order_number, status, title, source_ticket_id }`
- Errors: 400 eligibility/data, 401 auth, 403 permission, 404 inaccessible/deleted/cross-tenant, 409 already linked

## Field Mapping

| Work Order field | Source |
| --- | --- |
| source_ticket | FM Ticket |
| tenant/org/dept/building/floor/area/asset | Ticket fields |
| requester | ticket.requester |
| assignee | ticket.assignee |
| title/description | ticket fields |
| priority | mapped (`urgent` → `critical`) |
| status | `assigned` |
| created_by/updated_by | generating coordinator |
| requested_at | ticket.reported_at |
| due_at | ticket.due_at |

Reuses `create_work_order()` for numbering, SLA, history, and status-history baselines.

## Permission and Tenant Isolation

- Backend permission enforcement is authoritative
- Caller tenant must match ticket tenant (generic 404 otherwise)
- No client-supplied tenant/requester/assignee/source identity
- No superuser cross-tenant bypass for this workflow

## Duplicate and Concurrency Protection

- Ticket row locked with `select_for_update` before generation
- Existing link check before create
- Database OneToOne uniqueness
- Second request returns HTTP 409

## Transaction and Rollback Behavior

`generate_work_order_from_ticket()` runs in `transaction.atomic`. Work Order creation failure or ticket-history failure rolls back the complete workflow.

## Frontend Behavior

- Ticket detail panel with explanation, confirmation, pending/disabled states
- Linked Work Order summary + route to `/maintenance/work-orders/{id}`
- Maintenance detail shows source ticket section only when present
- Query invalidation for ticket detail/lists and maintenance lists/detail

## Test Coverage

Backend: successful generation, no auto-generation, auth/isolation, eligibility, 409 idempotency, atomic rollback, detail serialization.

Frontend helper tests: eligibility, labels, messages, routes.

## Validation

Backend:

- `python manage.py test apps.fm_tickets --noinput` -> passed (57 tests)
- `python manage.py test apps.maintenance --noinput` -> passed (69 tests)
- `python manage.py test apps.notifications --noinput` -> passed (78 tests)
- `python manage.py test apps.accounts apps.access_control --noinput` -> passed (109 tests)
- `python manage.py test --parallel 4 --noinput` -> passed (405 tests)
- `python manage.py check` -> passed
- `python manage.py makemigrations --check --dry-run` -> no changes detected
- Migration `maintenance.0005_work_order_source_ticket` applies successfully on clean test databases

Frontend:

- `npm test` -> passed (115 tests)
- `npm run lint` -> passed
- `npx tsc --noEmit` -> passed
- `npm run build` -> passed

## Deferred Scope

- Automatic Work Order creation on ticket create
- Two-way status synchronization
- Automatic Ticket closure from Work Order completion
- Attachment/comment/AI transfer
- Work Order deletion/unlinking
- Multiple Work Orders per Ticket
- External delivery channels
