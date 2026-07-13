# FO-058B - Maintenance Work Order Notification Integration

## Status

Complete

## Purpose

FO-058B integrates the existing in-app notification service with authoritative Maintenance Work Order assignment, reassignment, and status workflow services. Notifications are created synchronously inside existing assignment and workflow transaction boundaries and reuse `apps.notifications.services.create_notification`.

This task covers Maintenance only. FM Ticket behavior, 5S Inspection, frontend surfaces, migrations, and delivery channels remain out of scope.

## Integration Points

Authoritative workflow hooks:

| Service function | File | Notification trigger |
| ---------------- | ---- | -------------------- |
| `assign_work_order()` | `backend/apps/maintenance/work_order_assignment_service.py` | after assignment persistence, SLA update, status history, and general history |
| `reassign_work_order()` | `backend/apps/maintenance/work_order_assignment_service.py` | after reassignment persistence and history |
| `_transition_work_order()` | `backend/apps/maintenance/work_order_workflow_service.py` | after workflow status persistence, SLA recalculation, and history |
| `complete_work_order()` | `backend/apps/maintenance/work_order_workflow_service.py` | inherits status notification from `_transition_work_order()` inside one outer transaction |
| `reopen_work_order()` | `backend/apps/maintenance/work_order_workflow_service.py` | inherits status notification from `_transition_work_order()` inside one outer transaction |

Helper boundary:

| Function | File | Responsibility |
| -------- | ---- | -------------- |
| `notify_maintenance_assigned()` | `backend/apps/maintenance/notification_service.py` | initial assignment notifications |
| `notify_maintenance_reassigned()` | `backend/apps/maintenance/notification_service.py` | changed-principal reassignment notifications |
| `notify_maintenance_status_changed()` | `backend/apps/maintenance/notification_service.py` | status workflow notifications |

Notifications are not generated from views, serializers, models, signals, or frontend code.

## Assignment Event Contract

| Field | Value |
| ----- | ----- |
| Event code | `maintenance.assigned` |
| Recipients | newly assigned technician and/or newly assigned supervisor |
| Title | `Maintenance work order assigned to you` |
| Message | includes work-order number and title |
| Severity | `info` |
| Source module | `maintenance` |
| Source object ID | `work_order.id` |
| Target URL | `/maintenance/work-orders/{work_order.id}` |

Metadata:

```json
{
  "work_order_number": "<string>",
  "event": "assigned",
  "assignment_role": "technician" | "supervisor"
}
```

## Status Change Event Contract

| Field | Value |
| ----- | ----- |
| Event code | `maintenance.status_changed` |
| Recipients | requester, current assignee, active assignment supervisor when present |
| Title | `Maintenance work order status updated` |
| Message | includes work-order number, previous status label, and new status label |
| Source module | `maintenance` |
| Source object ID | `work_order.id` |
| Target URL | `/maintenance/work-orders/{work_order.id}` |

Metadata:

```json
{
  "work_order_number": "<string>",
  "event": "status_changed",
  "from_status": "<string>",
  "to_status": "<string>"
}
```

Severity mapping:

| New status | Severity |
| ---------- | -------- |
| `completed`, `closed` | `success` |
| `cancelled`, `on_hold` | `warning` |
| all other valid transitions | `info` |

## Changed-Principal and Duplicate Prevention

Assignment:

- initial assignment notifies all eligible new technician and supervisor principals
- reassignment notifies only principals whose assignment changed
- unchanged technician or supervisor receives no additional notification

Status:

- requester, assignee, and active supervisor are deduplicated by UUID
- actor is excluded
- no-op status transitions create no notification

Recipient eligibility:

- active users only
- tenant-bound users with `recipient.tenant_id == work_order.tenant_id`
- global and cross-tenant users are excluded
- assignment notes, reasons, and private workflow text are not included in messages or metadata

## Transaction and Rollback Behavior

Assignment services already used `transaction.atomic`; notification writes now occur at the end of those transactions.

Workflow services now use:

- `@transaction.atomic` on `_transition_work_order()`
- `@transaction.atomic` on `complete_work_order()`
- `@transaction.atomic` on `reopen_work_order()`

Each public workflow is all-or-nothing across work-order state, SLA updates, status history, general history, completion or reopen side effects, and notifications.

No `transaction.on_commit`, Celery jobs, signals, or asynchronous delivery are used.

If a required notification write fails unexpectedly, the workflow transaction rolls back. Ineligible recipients may be skipped without failing the workflow.

## Intentionally Excluded Maintenance Events

- unassignment notifications
- previous-assignee removal notifications
- SLA escalation notifications
- comment notifications
- work-order-created notifications
- email, SMS, push, WebSocket, or SSE delivery
- notification templates and preferences

## Tests Added

`apps.maintenance.tests.test_maintenance.MaintenanceNotificationIntegrationTests`:

- initial assignment notifies eligible technician and supervisor
- actor exclusion for assignment and status workflows
- inactive, global, and cross-tenant principals are rejected or skipped
- reassignment notifies only changed technician or supervisor principals
- assignment role metadata, target URL, and source fields
- status transition notifies requester, assignee, and active supervisor
- status recipient deduplication and actor exclusion
- severity mapping for completed, cancelled, on-hold, and other transitions
- approved status metadata only
- invalid transition creates no notification
- assignment, reassignment, status, completion, and reopen notification failures roll back workflow side effects

Existing Maintenance workflow tests, notification isolation tests, and FM Ticket integration tests remain passing.

## Validation

Commands run from `backend/`:

- `python manage.py test apps.maintenance.tests.test_maintenance.MaintenanceNotificationIntegrationTests --noinput` -> passed (21 tests)
- `python manage.py test apps.maintenance --noinput` -> passed (69 tests)
- `python manage.py test apps.notifications --noinput` -> passed (41 tests)
- `python manage.py test apps.fm_tickets --noinput` -> passed (43 tests)
- `python manage.py test apps.accounts apps.access_control --noinput` -> passed (109 tests)
- `python manage.py test --parallel 4 --noinput` -> passed (332 tests)
- `python manage.py check` -> passed
- `python manage.py makemigrations --check --dry-run` -> no changes detected

Repository checks:

- no migration created
- no frontend files changed
- PR #34 remains open, draft, and unmerged

## Deferred Scope

Cumulative FO-058 remains pending after FO-058B:

- FO-058C follow-on notification work
- 5S Inspection integration
- additional Maintenance events such as unassignment, escalation, and comments
- FO-059 and FO-060

Notifications remains `In Progress` at the module level.
