# FO-064 - Reporting Backend Aggregation Foundation

## Status

Complete (backend foundation; reconciled by FO-064A)

## Scope Implemented

FO-064 introduces the backend aggregation foundation for Reporting and Operational Analytics.

Implemented scope:

- Dedicated Django app: `apps.reporting`
- Service-layer aggregation over FM Tickets, Maintenance Work Orders, and 5S Inspections
- Tenant-scoped queryset helpers (superuser / `system_admin` retain global scope)
- RBAC permission `reporting.view` seeded for `system_admin`, `facility_manager`, and `viewer`
- Authenticated overview API: `GET /api/reporting/overview/`
- Date-range validation (default 90 days, max 180 days; both bounds inclusive)
- Optional filters: `building`, `organization` (UUID + accessible master-data validation after FO-064A)
- Soft-deleted operational rows excluded from aggregates
- Focused backend permission, tenant-isolation, filter, and aggregate tests

Deferred (intentionally out of scope for FO-064):

- Reporting frontend overview / nav (FO-065)
- Cross-module status / priority filter UX (FO-066)
- Export workflows and `reporting.export` (deferred from MVP)
- Chart libraries / visualization dependencies
- Notification analytics
- Scheduled / cached report materialization
- Foundation Dashboard tenant-scoping correction (separate task)
- FO-063 automatic FM Ticket closure (reserved / deferred)

## FO-064A Reconciliation Note

FO-064A corrected the public overview contract before FO-065:

- Explicit UUID validation for `building` / `organization`
- Accessible Building / Organization validation (`is_active`, not deleted, tenant/global scope)
- Building/Organization mismatch returns HTTP 400
- Premature `status` / `priority` query filters removed and rejected with HTTP 400
- Expanded regression coverage and cumulative backend validation completed

See `docs/02-Development/FO-064A - Reporting API Contract Validation and Backend Reconciliation.md`.

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
- Validates Building / Organization UUID and accessibility
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

Supported query parameters:

- `date_from` / `date_to` (ISO-8601 datetime; optional; inclusive bounds)
- `building` (UUID; optional; accessible active Building)
- `organization` (UUID; optional; accessible active Organization)

Unsupported query parameters (HTTP 400):

- `status`
- `priority`

Response shape:

- `filters` echo: `date_from`, `date_to`, `building`, `organization`
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

`apps.reporting.tests.test_reporting` covers authentication, tenant isolation, master-data filter validation, date bounds, unsupported filters, metrics, read-only behavior, and seed RBAC assignment. Expanded coverage is recorded in FO-064A.

## Outcome

FO-064 delivers the tenant-scoped Reporting backend aggregation foundation on `feature/reporting`. FO-064A reconciles the public API contract. Frontend overview, export, charts, and later milestones remain deferred. PR #38 remains draft and unmerged. FO-065 has not started.
