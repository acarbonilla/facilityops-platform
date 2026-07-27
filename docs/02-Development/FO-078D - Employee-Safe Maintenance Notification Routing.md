# FO-078D - Employee-Safe Maintenance Notification Routing

## Status

Manual acceptance **passed** on **2026-07-27**. Final automated validation
passed. Draft PR #44 marked Ready for Review; **not yet merged**. FO-079 is
not included in this delivery.

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
- Employee Maintenance permissions remain denied (permission model unmodified)

## Files changed

### Backend
- `backend/apps/maintenance/notification_service.py` — filter Employee-only
  users from internal recipients; add `_notify_requester_via_ticket` helper
- `backend/apps/maintenance/tests/test_notification_routing.py` — 12 focused
  tests

### Frontend
- None (backend-only routing fix)

## Manual acceptance evidence

| Field | Value |
| --- | --- |
| Result | **Passed** |
| Acceptance date | **2026-07-27** |
| Tested workflow | Employee requester receives Maintenance status update via My Requests |
| Correct requester-safe route | `/my-requests/{fm_ticket_id}` |
| Maintenance permissions | Unchanged; Employee still denied internal Maintenance access |
| Internal Maintenance target | Not delivered to Employee-only requesters |
| Operational users | Continue receiving internal Maintenance notifications |
| Evidence | Supplied acceptance evidence / documented Product Owner acceptance |
| Defects found | None |
| Permission model changes | None |

### Acceptance confirmations

1. Employee requester notification opens My Requests — **PASS**
2. Target URL uses `/my-requests/{fm_ticket_id}` — **PASS**
3. Employee does not receive inaccessible internal Maintenance target — **PASS**
4. No internal Maintenance information exposed — **PASS**
5. Employee Maintenance permissions remain denied — **PASS**
6. Operational users continue receiving internal Maintenance notifications — **PASS**

## Final validation (pre-merge)

| Gate | Result |
| --- | --- |
| Focused FO-078D (`test_notification_routing`) | **12 passed** |
| Related notifications / Employee Requester / permissions / tenant isolation | Passed (related regression suites) |
| Full backend `--parallel 4 --keepdb --noinput` | **691 passed** |
| Full frontend (`npm test -- --run`) | **268 passed** |
| ESLint | Passed |
| TypeScript (`tsc --noEmit`) | Passed |
| Production build | Passed |
| Django check | Passed (0 issues) |
| Migration drift (`makemigrations --check --dry-run`) | **No changes detected** |
| Dependencies | **None added** |
| `git diff --check` | Clean |

## Migration status

No migration required or created.

## Dependency status

No new dependencies.

## Deferred

- FO-079 Secure Attachment Backend and Storage Foundation (separate PR #45;
  not included here)
- Comments, AI, email/SMS/push, WebSocket/SSE
- Assignment-specific requester notifications (not in scope—only status changes
  create the problematic path today)

## Pull request

- Branch: `fix/employee-maintenance-notification-routing`
- PR: [#44](https://github.com/acarbonilla/facilityops-platform/pull/44)
- Title: FO-078D: Employee-Safe Maintenance Notification Routing
- Status: Ready for Review; **unmerged** until merge step completes
- FO-079: **not included**
