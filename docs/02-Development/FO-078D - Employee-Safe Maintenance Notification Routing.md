# FO-078D - Employee-Safe Maintenance Notification Routing

## Status

Implementation complete. Draft PR open and unmerged. Manual acceptance pending.
FO-079 has not started.

## Business objective

Fix the defect where an Employee requester receives an internal Maintenance Work
Order notification with a link to `/maintenance/work-orders/{id}` that they
cannot access. Correct the notification recipient and target URL logic without
granting Employees Maintenance access.

## Root cause

`apps.maintenance.notification_service.notify_maintenance_status_changed` (line
184) included `work_order.requester` in the list of internal notification
recipients without checking whether the requester has Maintenance permissions.

When the Work Order was generated from an FM Ticket, the `requester` field
carries the original Employee who raised the ticket. That Employee received the
internal Maintenance notification with target URL
`/maintenance/work-orders/{id}`, which the frontend correctly denies with
"Access Denied."

The `_is_eligible_recipient` helper validated only tenant match and active
status—not whether the user could actually view the Maintenance module.

## Corrected recipient rules

1. `_is_eligible_recipient` now rejects Employee-only users (those for whom
   `uses_employee_requester_scope()` returns True).
2. Internal Maintenance notifications (assignment, reassignment, status change)
   are restricted to users with operational Maintenance access.
3. When the Work Order has a linked `source_ticket` and the requester is
   Employee-only, a separate **requester-safe notification** is created:
   - Title: "Your request has been updated"
   - Target URL: `/my-requests/{fm_ticket_id}`
   - Event code: `maintenance.requester_status_update`
   - References the FM Ticket number, not the WO number
   - Exposes no Maintenance internals

## Dual-role behavior

Users with both Employee and operational roles (e.g., `employee` +
`facility_manager`) have `uses_employee_requester_scope()` return False because
they hold broader FM Ticket permissions. They continue receiving internal
Maintenance notifications at `/maintenance/work-orders/{id}`.

No duplicate notification is generated because the requester-safe path only
fires for Employee-only users who were excluded from the internal list.

## Tenant isolation

- `_is_eligible_recipient` enforces `recipient.tenant_id == work_order.tenant_id`
- `_notify_requester_via_ticket` re-checks tenant match
- Cross-tenant requesters receive no notification of any kind
- Tests confirm cross-tenant isolation

## Security considerations

- Maintenance route guards remain unchanged
- Employees still receive "Access Denied" on `/maintenance/` pages
- No Maintenance navigation exposed to Employees
- Server-side recipient determination; client cannot override
- Internal workflow details (assignments, labor, materials, notes) are not
  exposed in requester notifications

## Files changed

### Backend
- `backend/apps/maintenance/notification_service.py` — filter Employee-only
  users from internal recipients; add `_notify_requester_via_ticket` helper
- `backend/apps/maintenance/tests/test_notification_routing.py` — 12 focused
  tests

### Frontend
- None (backend-only routing fix)

## Tests

| Suite | Result |
| --- | --- |
| Focused FO-078D (`test_notification_routing`) | 12 passed |
| Full backend `--parallel 4 --noinput` | See validation |
| Full frontend (`npm test -- --run`) | See validation |
| ESLint | See validation |
| TypeScript | See validation |
| Production build | See validation |
| Django check | Passed |
| Migration drift | None |
| Dependencies | None added |

## Migration status

No migration required or created.

## Dependency status

No new dependencies.

## Manual acceptance checklist

1. Sign in as an Employee requester.
2. Create an FM Ticket.
3. As an authorized user, create/update a linked Maintenance Work Order.
4. Confirm the Employee does NOT receive an internal Maintenance notification.
5. Confirm the Employee does NOT receive a Maintenance page link.
6. Confirm the Employee receives a requester-safe notification (when applicable).
7. Open the notification → confirm it opens `/my-requests/{fm_ticket_id}`.
8. Confirm only requester-safe information is shown.
9. Directly open a Maintenance URL as the Employee → confirm Access Denied.
10. Sign in as the assigned Maintenance technician.
11. Confirm the internal notification is received with Maintenance link.
12. Test a dual-role user → confirm operational notification with Maintenance link.
13. Confirm no duplicate notifications.
14. Confirm another tenant receives no notification or data.

## Deferred

- FO-079 Secure Attachment Backend and Storage Foundation (not started)
- Comments, AI, email/SMS/push, WebSocket/SSE
- Assignment-specific requester notifications (not in scope—only status changes
  create the problematic path today)

## Pull request

- Branch: `fix/employee-maintenance-notification-routing`
- PR: Draft targeting `main`
- Title: FO-078D: Employee-Safe Maintenance Notification Routing
- Merge status: unmerged; pending manual acceptance
