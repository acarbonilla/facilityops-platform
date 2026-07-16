# FO-065A - Reporting Filter Options Access and UX Reconciliation

## Status

Complete (on `feature/reporting`)

## Manual Acceptance Evidence

During FO-065 manual browser acceptance, `/reporting` loaded operational metrics for a user with `reporting.view`, but Organization and Building selectors showed:

> Organization or Building options could not be fully loaded.

FO-065 is only partially accepted pending this correction.

## Confirmed Defect

FO-065 reused administrative Master Data list endpoints:

- `GET /api/master-data/organizations/`
- `GET /api/master-data/buildings/`

Those endpoints require `settings.view`. Reporting users (for example Viewer / Facility Manager with `reporting.view`) are not granted Master Data administration permission, so filter options failed even though Reporting itself was authorized.

## Root Cause

Permission mismatch:

- Reporting overview: `reporting.view`
- Filter option lists: administrative Master Data `settings.view`

Frontend advisory permission checks could not compensate because the Master Data API itself rejected the requests.

## Security Decision

Do **not** grant `settings.view` to Reporting users merely to populate filters.

Do **not** weaken Master Data endpoint permissions.

Instead, expose a dedicated read-only Reporting filter-options endpoint protected by `reporting.view`.

## Final Filter-Options Endpoint

`GET /api/reporting/filter-options/`

- Auth: `IsAuthenticated`
- Permission: `reporting.view`
- Does not require `settings.view`
- Read-only
- Accepts no tenant UUID from the client
- No optional Organization query parameter in this milestone (frontend filters Buildings locally via `organization_id`)

## Permission Contract

| Actor | Result |
| ----- | ------ |
| Unauthenticated | 401 |
| Authenticated without `reporting.view` | 403 |
| `reporting.view` without `settings.view` | 200 |
| `settings.view` alone | 403 |

Backend permission remains authoritative.

## Tenant / Global Scope

Reuses Reporting helpers:

- `_eligible_master_data_queryset`
- `has_global_reporting_scope`

Behavior:

- Active, non-deleted Organizations and Buildings only
- Buildings also require an eligible (active, non-deleted) Organization
- Tenant-bound users see their tenant only
- Tenantless non-global users receive empty arrays
- `system_admin` and superuser see eligible global options

## Response Contract

```json
{
  "organizations": [{ "id": "uuid", "name": "Organization name" }],
  "buildings": [
    {
      "id": "uuid",
      "name": "Building name",
      "organization_id": "uuid"
    }
  ]
}
```

Ordered by `name`, then `id`. No tenant UUID, codes, addresses, or administrative audit fields.

## Frontend API / Hook Changes

- Endpoint constant: `API_ENDPOINTS.reporting.filterOptions`
- Service: `getReportingFilterOptions()`
- Query key: `reportingQueryKeys.filterOptions()`
- Hook: `useReportingFilterOptions()` with the same auth/permission gating as the overview hook
- Reporting page no longer calls Master Data administrative list APIs for these selectors

## Organization / Building Behavior

- Selectors load from Reporting filter options
- Buildings narrow by selected Organization via `organization_id`
- Changing Organization clears an incompatible Building
- Empty selection means all accessible records
- Apply disabled for stale UUIDs or when options are unavailable with selections present
- Date-only Apply remains possible when Organization/Building are cleared
- Filter-options failure shows Retry + Reset without collapsing the overview independently

## Copy Correction

Corrected duplicated wording:

- Before: `Current period: Period 2026-04-17 to 2026-07-16`
- After: `Current period: 2026-04-17 to 2026-07-16`

Helpers:

- `formatReportingActivePeriod()` / `formatActiveReportingFilterSummary()` omit a leading `Period` token
- `formatCurrentReportingPeriodLabel()` produces the final header phrase

## Navigation-Overflow Review Result

Sidebar uses intentional `overflow-x-auto` for narrow/mobile horizontal nav scrolling and `md:flex-col` for desktop.

No reproducible desktop/tablet overflow defect was confirmed beyond print/PDF viewport artifacts. No navigation redesign was performed.

## Tests

Backend `ReportingFilterOptionsTests` cover authentication, permissions, tenant isolation, inactive/deleted exclusion, global scope, response shape, ordering, read-only behavior, overview regression, and seed-RBAC settings.view non-expansion.

Frontend helper tests cover endpoint constant, query key, `organization_id` narrowing/clearing, apply gating, copy regression, and no Master Data fallback path.

## Validation Results

Backend:

- `apps.reporting` — 56 OK
- `apps.accounts` + `apps.access_control` — 109 OK
- `apps.fm_tickets` + `apps.maintenance` + `apps.inspection` — 211 OK
- `apps.dashboard` + `apps.notifications` — 80 OK
- Full parallel suite — 482 OK
- `manage.py check` clean
- `makemigrations --check --dry-run` — No changes detected

Frontend:

- `npm test` — 160 pass
- `npm run lint` — pass
- `npx tsc --noEmit` — pass
- `npm run build` — pass; `/reporting` present

## Migration Status

No migration. No Reporting model. No schema change.

## Dependency Status

No dependencies added.

## Deferred Scope

- FO-066 cross-module filters and drill-down
- Exports, charts, scheduled reports
- Status / priority filters
- Foundation Dashboard corrections
- FO-063 automatic Ticket closure

## Files Changed

Backend Reporting views/services/serializers/urls/tests; frontend Reporting types/API/hooks/filters/UI/tests; FO-065A and FO-065 docs; project trackers.

## Commit SHA

- `1712628d8ed779cd4827b9610b0ed24a98bcb399` — `FO-065A: reconcile reporting filter option access`

## PR #38 State

Remains open, draft, and unmerged on `feature/reporting`.
