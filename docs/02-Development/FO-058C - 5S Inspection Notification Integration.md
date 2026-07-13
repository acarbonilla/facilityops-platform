# FO-058C - 5S Inspection Notification Integration

## Status

Complete

## Purpose

FO-058C integrates the existing in-app notification service with authoritative 5S Inspection assignment and status workflow services. Notifications are created synchronously inside existing `assign_inspection()` and `change_status()` transaction boundaries and reuse `apps.notifications.services.create_notification`.

This task covers 5S Inspection only. FM Ticket and Maintenance notification behavior, frontend surfaces, migrations, and delivery channels remain out of scope.

## Integration Points

Authoritative workflow hooks:

| Service function | File | Notification trigger |
| ---------------- | ---- | -------------------- |
| `assign_inspection()` | `backend/apps/inspection/services/inspection_service.py` | after assignment persistence, optional draft-to-scheduled transition, SLA recalculation, and general history |
| `change_status()` | `backend/apps/inspection/services/inspection_service.py` | after status persistence, SLA recalculation, status history, and general history |

Helper boundary:

| Function | File | Responsibility |
| -------- | ---- | -------------- |
| `notify_inspection_assigned()` | `backend/apps/inspection/services/notification_service.py` | assignment notifications for changed inspector and/or supervisor principals |
| `notify_inspection_status_changed()` | `backend/apps/inspection/services/notification_service.py` | status workflow notifications |

Notifications are not generated from views, serializers, models, signals, or frontend code.

## Assignment Event Contract

| Field | Value |
| ----- | ----- |
| Event code | `inspection.assigned` |
| Recipients | newly assigned or changed inspector and/or supervisor |
| Title | `5S inspection assigned to you` |
| Message | `{inspection_number}: {title}` |
| Severity | `info` |
| Source module | `inspection` |
| Source object ID | `inspection.id` |
| Target URL | `/inspection/inspections/{inspection.id}` |

Metadata:

```json
{
  "inspection_number": "<string>",
  "event": "assigned",
  "assignment_role": "inspector" | "supervisor"
}
```

## Status Change Event Contract

| Field | Value |
| ----- | ----- |
| Event code | `inspection.status_changed` |
| Recipients | current inspector and current supervisor |
| Title | `5S inspection status updated` |
| Message | `{inspection_number}: status changed from {from_label} to {to_label}.` |
| Source module | `inspection` |
| Source object ID | `inspection.id` |
| Target URL | `/inspection/inspections/{inspection.id}` |

Metadata:

```json
{
  "inspection_number": "<string>",
  "event": "status_changed",
  "from_status": "<string>",
  "to_status": "<string>"
}
```

Severity mapping:

| New status | Severity |
| ---------- | -------- |
| `completed`, `verified` | `success` |
| `cancelled` | `warning` |
| all other valid transitions | `info` |

## Changed-Principal and Duplicate Prevention

Assignment:

- initial assignment notifies all eligible new inspector and supervisor principals
- reassignment through `assign_inspection()` notifies only principals whose `inspector_id` or `supervisor_id` changed
- unchanged inspector or supervisor receives no additional notification

Status:

- inspector and supervisor are deduplicated by UUID
- actor is excluded
- no-op status transitions (`from_status == to_status`) create no notification

Recipient eligibility:

- active users only
- tenant-bound users with `recipient.tenant_id == inspection.tenant_id`
- global and cross-tenant users are excluded
- assignment notes, reasons, and private workflow text are not included in messages or metadata

## Transaction and Rollback Behavior

`assign_inspection()` and `change_status()` already used `@transaction.atomic`; notification writes now occur at the end of those transactions.

Each workflow is all-or-nothing across inspection state, assignment records, status history, general history, SLA effects, and notifications.

No `transaction.on_commit`, Celery jobs, signals, or asynchronous delivery are used.

If a required notification write fails unexpectedly, the workflow transaction rolls back. Ineligible recipients may be skipped without failing the workflow.

## Intentionally Excluded Inspection Events

- inspection-created notifications
- finding notifications
- corrective-action notifications
- comment notifications
- attachment notifications
- escalation notifications
- AI-analysis notifications
- email, SMS, push, WebSocket, or SSE delivery
- notification templates and preferences

## Tests Added

`apps.inspection.tests.test_inspection.InspectionNotificationIntegrationTests`:

- initial assignment notifies eligible inspector and supervisor
- changed-principal assignment notifies inspector-only or supervisor-only updates
- unchanged inspector or supervisor suppression on reassignment
- actor exclusion for assignment and status workflows
- inactive principal exclusion; global and cross-tenant assignment rejection leaves no notifications
- assignment role metadata, target URL, and source fields
- status transition notifies inspector and supervisor
- status recipient deduplication and actor exclusion
- severity mapping for completed, verified, cancelled, and other transitions
- approved status metadata with raw `from_status` and `to_status`
- invalid transition creates no notification
- no-op status transition creates no additional notification
- assignment, reassignment, and status notification failures roll back workflow side effects

Existing Inspection workflow tests, notification isolation tests, and FM Ticket / Maintenance integration tests remain passing.

## Validation

Commands run from `backend/`:

- `python manage.py test apps.inspection.tests.test_inspection.InspectionNotificationIntegrationTests --noinput` -> passed (21 tests)
- `python manage.py test apps.inspection --noinput` -> passed (63 tests)
- `python manage.py test apps.notifications --noinput` -> passed (41 tests)
- `python manage.py test apps.fm_tickets --noinput` -> passed (43 tests)
- `python manage.py test apps.maintenance --noinput` -> passed (69 tests)
- `python manage.py test apps.accounts apps.access_control --noinput` -> passed (109 tests)
- `python manage.py test --parallel 4 --noinput` -> passed (353 tests)
- `python manage.py check` -> passed
- `python manage.py makemigrations --check --dry-run` -> no changes detected

Repository checks:

- no migration created
- no frontend files changed
- PR #34 remains open, draft, and unmerged

## Cumulative FO-058 Reconciliation

FO-058A (FM Ticket), FO-058B (Maintenance), and FO-058C (5S Inspection) are complete. Cumulative FO-058 business-module notification integration is complete.

Notifications remains `In Progress` because FO-059 and FO-060 remain pending.

## Deferred Scope

- FO-059 and FO-060
- additional Inspection events such as findings, corrective actions, comments, attachments, escalations, and AI analysis
- email, SMS, push, WebSocket/SSE delivery, templates, and preferences
