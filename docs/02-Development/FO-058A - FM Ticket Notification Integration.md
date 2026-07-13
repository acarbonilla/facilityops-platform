# FO-058A - FM Ticket Notification Integration

## Status

Complete

## Purpose

FO-058A integrates the existing in-app notification service with confirmed FM Ticket assignment and status-change workflows. Notifications are created synchronously inside the authoritative FM Ticket service layer and reuse `apps.notifications.services.create_notification` without duplicating persistence logic.

This task covers FM Ticketing only. Maintenance, 5S Inspection, frontend surfaces, migrations, and delivery channels remain out of scope.

## Integration Points

Authoritative workflow hooks:

| Service function | File | Notification trigger |
| ---------------- | ---- | -------------------- |
| `assign_ticket()` | `backend/apps/fm_tickets/services.py` | after successful assignment persistence and history |
| `change_ticket_status()` | `backend/apps/fm_tickets/services.py` | after successful status persistence and history |

Helper boundary:

| Function | File | Responsibility |
| -------- | ---- | -------------- |
| `notify_fm_ticket_assigned()` | `backend/apps/fm_tickets/notification_service.py` | assignment recipient resolution and notification creation |
| `notify_fm_ticket_status_changed()` | `backend/apps/fm_tickets/notification_service.py` | status-change recipient resolution and notification creation |

Notifications are not generated from views, serializers, signals, model save methods, or frontend code.

## Assignment Event Contract

| Field | Value |
| ----- | ----- |
| Event code | `fm_ticket.assigned` |
| Recipient | new assignee |
| Title | `FM ticket assigned to you` |
| Message | includes ticket number and ticket title |
| Severity | `info` |
| Source module | `fm_tickets` |
| Source object ID | `ticket.id` |
| Target URL | `/fm-tickets/{ticket.id}` |

Metadata:

```json
{
  "ticket_number": "<string>",
  "event": "assigned"
}
```

Create only when:

- assignee actually changes
- recipient is active
- recipient belongs to the same tenant as the ticket
- recipient is not the actor performing the assignment

## Status Change Event Contract

| Field | Value |
| ----- | ----- |
| Event code | `fm_ticket.status_changed` |
| Recipients | ticket requester and current assignee when present |
| Title | `FM ticket status updated` |
| Message | includes ticket number, previous status label, and new status label |
| Source module | `fm_tickets` |
| Source object ID | `ticket.id` |
| Target URL | `/fm-tickets/{ticket.id}` |

Metadata:

```json
{
  "ticket_number": "<string>",
  "event": "status_changed",
  "from_status": "<string>",
  "to_status": "<string>"
}
```

Severity mapping:

| New status | Severity |
| ---------- | -------- |
| `resolved`, `closed` | `success` |
| `cancelled` | `warning` |
| all other valid transitions | `info` |

## Recipient Inclusion and Exclusion Rules

Eligible recipients must be:

- active
- tenant-bound with `recipient.tenant_id == ticket.tenant_id`
- different from the workflow actor

Excluded recipients:

- the actor performing the workflow
- inactive users
- global users (`tenant_id is null`)
- cross-tenant users
- duplicate UUIDs in the same status-change event

Ineligible recipients are skipped before notification creation. Recipient eligibility checks are defensive integration guards and do not replace existing FM Ticket assignment and tenant-validation rules.

Notification messages never include internal notes, escalation reasons, private comments, or unrestricted metadata.

## Transaction and Rollback Behavior

`assign_ticket()` and `change_ticket_status()` are wrapped in `transaction.atomic`.

Within each workflow:

1. ticket state is persisted
2. history and status-history records are written
3. eligible notifications are created synchronously through `create_notification`

No `transaction.on_commit`, Celery jobs, signals, or background delivery are used.

If a required notification write fails unexpectedly, the workflow transaction rolls back and ticket state plus history remain unchanged. Ineligible recipients may be skipped without failing the workflow.

## Duplicate and No-Op Prevention

- Reassigning a ticket to the same assignee does not create another assignment notification.
- Changing status to the current status returns early and creates no notification or status history.

## Intentionally Excluded FM Ticket Events

- ticket creation
- ticket update outside assignment/status workflows
- comment creation
- escalation creation or resolution
- previous-assignee removal notifications
- email, SMS, push, WebSocket, or SSE delivery
- notification templates and preferences

## Tests Added

`apps.fm_tickets.tests.FmTicketNotificationIntegrationTests`:

- assignment creates one notification for a changed eligible assignee
- assignment notification uses the correct event code and source fields
- assignment target URL points to the FM Ticket detail route
- assignment notification includes only approved metadata
- same-assignee reassignment creates no additional notification
- actor assigned to themselves receives no self-notification
- inactive assignee receives no notification
- cross-tenant recipient receives no tenant-bound notification
- global recipient receives no tenant-bound notification
- status change notifies eligible requester
- status change notifies eligible assignee
- actor is excluded from status notifications
- requester and assignee resolving to the same user are deduplicated
- no-op status change creates no notification
- resolved and closed status use success severity
- cancelled status uses warning severity
- other status changes use info severity
- assignment notification failure rolls back ticket workflow state and history
- status notification failure rolls back ticket workflow state and history

Existing FM Ticket API/model tests and notification isolation tests remain passing.

## Validation

Commands run from `backend/`:

- `python manage.py test apps.fm_tickets.tests.FmTicketNotificationIntegrationTests --noinput` -> passed (20 tests)
- `python manage.py test apps.fm_tickets --noinput` -> passed (43 tests)
- `python manage.py test apps.notifications --noinput` -> passed (41 tests)
- `python manage.py test apps.accounts apps.access_control --noinput` -> passed (109 tests)
- `python manage.py test --parallel 4 --noinput` -> passed (311 tests)
- `python manage.py check` -> passed
- `python manage.py makemigrations --check --dry-run` -> no changes detected

Repository checks:

- no migration created
- no frontend files changed
- PR #34 remains open, draft, and unmerged

## Deferred Scope

FO-058 cumulative milestone work remains pending after FO-058A:

- Maintenance notification integration
- 5S Inspection notification integration
- additional FM Ticket events such as comments, escalations, and ticket creation
- FO-059 and FO-060 follow-on notification module work

Notifications remains `In Progress` at the module level.
