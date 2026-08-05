# FO-099 — Smart Notifications and Workflow

**Status:** Complete on shared feature branch (unmerged)  
**Date:** 2026-08-05  
**Branch:** `feature/intelligent-employee-intake`  
**Previous checkpoint:** FO-098 (`0e4dd49…`)  
**AI Platform:** FO-084–095 unchanged  
**Next:** FO-100 — Reporting and Analytics Alignment  
**PR policy:** No standalone FO-099 PR; feature remains unmerged

## 1. Objective

Complete UX-001 notification strategy for Intelligent Employee Intake using the existing FO-055–060 notification platform and FO-078D requester-safe routing.

## 2. Event codes

| Event | Code | Recipients | Target |
| --- | --- | --- | --- |
| Employee concern created | `fm_ticket.employee_concern_created` | Tenant FM / system_admin (not employee-only) | `/fm-tickets/{id}` |
| Requester confirmation | `fm_ticket.employee_concern_submitted` | Employee-only requester | `/my-requests/{id}` |
| AI analysis ready | `fm_ticket.ai_analysis_ready` | FM operational users | `/fm-tickets/{id}` |
| AI analysis failed | `fm_ticket.ai_analysis_failed` | FM operational users (terminal only) | `/fm-tickets/{id}` |
| Classification completed | `fm_ticket.classification_completed` | Requester (safe) + FM ops | `/my-requests/{id}` or `/fm-tickets/{id}` |

## 3. Timing

1. Ticket created (employee intake) → immediate Facilities + requester confirmation  
2. AI queued/processing → no ready/fail notify  
3. AI COMPLETED → one AI-ready notify  
4. AI terminal FAILED → one failure notify (not on retries)  
5. Classification incomplete→complete → classification-completed notify  

## 4. Deduplication

Application-level: one notification per `(recipient, event_code, source_module=fm_tickets, source_object_id=ticket.id)`.

Dual-role users receive the internal event once and do not also receive the employee-only confirmation for the same create.

## 5. Preferences

Inherit FO-059 `fm_tickets` in_app module preference via `get_effective_notification_preference`. Disabled preference suppresses delivery.

## 6. Integration points

- `create_ticket` (employee creation path)  
- `process_ticket_ai_analysis` COMPLETED / terminal FAILED  
- `update_ticket` classification readiness flip  

## 7. Explicit non-goals

No FO-100/101, email/SMS/push, preference UI redesign, automatic classification, feature merge.

## 8. Confirmation

- Feature branch unmerged  
- FO-100 **not started**  
