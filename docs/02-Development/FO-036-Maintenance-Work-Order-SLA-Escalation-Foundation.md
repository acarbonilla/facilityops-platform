# FO-036 - Maintenance Work Order SLA and Escalation Foundation

## Status

Complete

## SLA Rules

| Priority | Response Target | Completion Target |
| --- | ---: | ---: |
| Critical | 30 minutes | 240 minutes |
| High | 60 minutes | 480 minutes |
| Medium | 240 minutes | 1,440 minutes |
| Low | 480 minutes | 2,880 minutes |

The SLA service calculates targets from `requested_at`. A work-order `due_at` value is honored when it is earlier than the rule-based completion target.

## Backend

- `work_order_sla_service.py` recalculates targets, response/completion breach flags, overdue state, and SLA status.
- `work_order_escalation_service.py` creates warning/breach escalations, prevents duplicate active records by escalation type, and handles acknowledgement/resolution.
- Existing SLA and escalation models were extended with tenant, priority, target, breach, status, acknowledgement, ownership, notes, and audit fields.
- List filtering supports `sla_status`, `is_overdue`, and `has_active_escalation`.
- Completed, cancelled, and closed work orders do not create new escalations.

## Endpoints

- `GET /api/maintenance/work-orders/{id}/sla/`
- `POST /api/maintenance/work-orders/{id}/sla/recalculate/`
- `GET /api/maintenance/work-orders/{id}/escalations/`
- `POST /api/maintenance/work-orders/{id}/escalations/{escalation_id}/acknowledge/`
- `POST /api/maintenance/work-orders/{id}/escalations/{escalation_id}/resolve/`

## Permissions

- `maintenance.work_order.view_sla`
- `maintenance.work_order.recalculate_sla`
- `maintenance.work_order.view_escalation`
- `maintenance.work_order.acknowledge_escalation`
- `maintenance.work_order.resolve_escalation`

Legacy `maintenance.<action>` equivalents and `maintenance.manage` remain accepted for compatibility.

## Scheduled Check

`maintenance.check_maintenance_sla_breaches` is implemented as a Celery task. Celery autodiscovery is configured, but no Celery Beat schedule exists in the repository, so periodic scheduling remains a deployment/configuration step rather than being silently assumed.

## Frontend

- Work-order list displays SLA, overdue, and escalation badges and exposes matching filters.
- Detail screen includes permission-aware SLA and escalation cards.
- Authorized users can recalculate SLA, acknowledge escalations, and resolve escalations with required resolution notes.
- Query invalidation refreshes detail, list, dashboard, history, SLA, and escalation data after mutations.

## Notifications

No notification service exists in the repository. Escalation history and audit records are created, but delivery integration is intentionally deferred.

