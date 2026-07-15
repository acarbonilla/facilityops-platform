# FO-064 - Reporting Backend Aggregation Foundation

## Status

Complete (backend foundation)

## Scope Implemented

FO-064 introduces the backend aggregation foundation for Reporting and Operational Analytics.

Implemented scope:

- Dedicated Django app: `apps.reporting`
- Service-layer aggregation over FM Tickets, Maintenance Work Orders, and 5S Inspections
- Tenant-scoped queryset helpers (superuser / `system_admin` retain global scope)
- RBAC permission `reporting.view` seeded for `system_admin`, `facility_manager`, and `viewer`
- Authenticated overview API: `GET /api/reporting/overview/`
- Date-range validation (default 90 days, max 180 days)
- Optional filters: `building`, `organization`, `status`, `priority`
- Soft-deleted rows excluded from aggregates
- Focused backend permission, tenant-isolation, filter, and aggregate tests

Deferred (intentionally out of scope for FO-064):

- Reporting frontend overview / nav (FO-065)
- Cross-module drill-down UX (FO-066)
- Export workflows and `reporting.export` (deferred from MVP)
- Chart libraries / visualization dependencies
- Notification analytics
- Scheduled / cached report materialization
- Foundation Dashboard tenant-scoping correction (separate task)
- FO-063 automatic FM Ticket closure (reserved / deferred)

## Tenant Isolation Rules

- Aggregations are backend-authoritative; frontend filters are never trusted for isolation
- Tenant users only aggregate rows matching `request.user.tenant_id`
- Users without a tenant receive empty aggregates
- Superusers and `system_admin` retain global read scope consistent with Maintenance / Inspection
- Soft-deleted operational rows (`is_deleted=True`) are excluded

## Security Note

The Foundation Dashboard continues to use globally scoped master-data counts. That pattern is **not** reused by Reporting. Any Foundation Dashboard tenant correction remains a separate confirmed task.

## Service Foundation

Service: `apps.reporting.services.build_operational_overview`

Behavior:

- Resolves and validates filter bounds
- Scopes Ticket, Work Order, and Inspection querysets independently
- Aggregates volume, status, priority, overdue, Ticket SLA met/missed flags, Work Order linked/standalone split, and Inspection average score
- Uses consolidated `Count` / `Avg` annotations where practical

Date fields:

- Tickets: `reported_at`
- Work Orders: `requested_at`
- Inspections: `scheduled_date`

## API Contract

Base path: `/api/reporting/`

Endpoints:

- `GET /api/reporting/overview/`

Security:

- `IsAuthenticated`
- `HasPermissionCode` requiring `reporting.view`

Query parameters:

- `date_from` / `date_to` (ISO-8601 datetime; optional)
- `building` (UUID; optional)
- `organization` (UUID; optional)
- `status` / `priority` (optional; applied to each module queryset)

Response shape:

- `filters` (echo of applied filter bounds)
- `tickets` (total, open, overdue, by_status, by_priority, by_category, sla)
- `work_orders` (total, overdue, by_status, by_priority, linked_to_ticket, standalone)
- `inspections` (total, by_status, average_score, scored_count)

## RBAC Decision

New permission code: `reporting.view`

Seeded roles:

- `system_admin`
- `facility_manager`
- `viewer`

Rationale:

- Reporting is a dedicated management analytics surface and must not rely on authentication alone (FO-017 Dashboard pattern)
- Module `.view` permissions continue to gate drill-down into Ticket / Work Order / Inspection detail routes in later milestones

## Migration

No new Reporting models or migrations were required. Aggregations use existing operational tables.

## Tests Added

`apps.reporting.tests.test_reporting` covers:

- Authentication and `reporting.view` enforcement
- Tenant-scoped overview counts (no cross-tenant leakage)
- Empty aggregates for users without a tenant
- Building filter narrowing
- Max date-range enforcement
- Soft-deleted row exclusion
- Default 90-day filter window

## Validation Executed

- `python -m pytest apps/reporting/tests/test_reporting.py -q`
- `python manage.py test apps.access_control.tests.SeedRbacCommandTests apps.reporting.tests.test_reporting -v1`

## Outcome

FO-064 delivers the tenant-scoped Reporting backend aggregation foundation on `feature/reporting`. Frontend overview, export, charts, and later milestones remain deferred.
