# FO-065 - Reporting Operational Overview Frontend

## Status

Complete (on `feature/reporting`)

## Objective

Implement the authenticated, permission-gated Reporting operational overview frontend against the approved FO-064 / FO-064A backend contract (`GET /api/reporting/overview/`).

The page provides management users with an operational summary of:

- FM Tickets
- Maintenance Work Orders
- 5S Inspections

## Preflight Findings

- Branch: `feature/reporting`
- Starting HEAD: `bd126ed064b1278aa6d9b98daa0c7b9471924323`
- Local HEAD matched `origin/feature/reporting`
- Working tree clean
- Draft PR #38: OPEN, DRAFT, unmerged, base `main`, head `feature/reporting`
- FO-065 was not previously implemented
- Backend contract matched FO-064A (`date_from`, `date_to`, `building`, `organization`; no `status` / `priority`)

## Existing Frontend Architecture Reused

- `ProtectedPermissionRoute` + `PermissionGuard` / `UnauthorizedState`
- `APP_NAVIGATION` + permission-filtered `Sidebar`
- Shared `apiClient`, `API_ENDPOINTS`, TanStack Query, query-key factories
- Master Data `getOrganizations` / `getBuildings` and `filterBuildingsByOrganization`
- Shared `PageHeader`, `EmptyState`, `ErrorState`, `LoadingState`, `SelectField`, `FormField`, `AppShell`
- Metric-card visual pattern (Reporting uses string-capable cards so average score can show a neutral empty label)
- Helper-level Node test harness (`node --import tsx --test`)

## Route

- Path: `/reporting`
- File: `frontend/app/(app)/reporting/page.tsx`
- Guard: authentication + advisory `reporting.view`

## Navigation Behavior

- Label: **Reporting**
- Href: `/reporting`
- Visible only when the user has `reporting.view`
- Uses the existing text-link sidebar pattern (no new icon dependency)
- Responsive horizontal scroll on mobile is preserved

## Permission Behavior

- Frontend checks are advisory
- Backend `reporting.view` remains authoritative
- Hook gating: no Reporting request while auth is restoring, while logged out, or without `reporting.view`
- Direct navigation without permission uses established `UnauthorizedState` behavior
- No tenant UUID is sent by the frontend

## API and Query-Key Contracts

Endpoint:

- `GET /api/reporting/overview/` via `API_ENDPOINTS.reporting.overview`

Service (`services/api/reporting.ts`):

- Accepts only `date_from`, `date_to`, `building`, `organization`
- Omits undefined / null / blank values
- Does not send `status`, `priority`, or `tenant`

Query keys:

- `reportingQueryKeys.all`
- `reportingQueryKeys.overviews()`
- `reportingQueryKeys.overview(params)` with trimmed/blank-normalized params

Hook:

- `useReportingOverview(params)`
- `enabled: !isLoading && isAuthenticated && !permissionsLoading && hasPermission("reporting.view")`
- No aggressive polling

## Date-Filter Conversion Contract

Frontend controls use local `YYYY-MM-DD` inputs.

Default period:

- Most recent 90 calendar days (`date_to = today`, `date_from = today - 90`)
- Matches the backend default closely (`now - 90 days` through now)

Conversion:

- Date From → local start of day → ISO-8601 via `Date.toISOString()` (instant, not naive `Z` append)
- Date To → local end of day → ISO-8601
- Exact 180-day calendar selections are accepted; if end-of-day would push the backend timedelta span above 180 days, `date_to` is clamped to `date_from + 180 days`

Validation:

- Blank / malformed dates rejected
- Date From after Date To rejected
- Calendar span over 180 days rejected
- Exact 180-day calendar span accepted

## Organization / Building Filter Behavior

- Organization and Building selectors reuse Master Data list APIs
- Buildings narrow to the selected Organization
- Changing Organization clears an incompatible Building
- Empty selection means all accessible records
- Only UUID values from loaded options are submitted
- Option load failures do not crash the page
- No tenant selector; no Floor / Area / Asset / status / priority filters

## Overview Sections

1. Page header with title, description, period, and active master-data filter indication
2. Filters with Apply / Reset
3. Executive summary metric cards
4. FM Ticket summary (totals, status / priority / category counts, SLA)
5. Maintenance Work Order summary (totals, status / priority counts, linked vs standalone)
6. 5S Inspection summary (totals, status counts, average score, scored count)

No drill-down links, charts, exports, or realtime updates.

## Loading / Error / Empty States

- Header and filters remain stable while the overview loads
- First load does not show zero metrics as real data
- 400 / 401 / 403 / 404 / network failures map to user-safe messages with Retry
- 404 / stale master-data filter failures also offer Reset filters
- Zero totals across modules show the empty-state message without treating the response as a failure

## Accessibility

- Heading hierarchy (`h1` page title, `h2` sections, `h3` SLA)
- Labels associated with filter controls
- Validation and errors use alert / status semantics
- Tables include captions and header cells
- Keyboard-accessible native controls and buttons

## Responsive Behavior

- Filter grid stacks from 1 → 2 → 4 columns
- Metric and summary grids stack cleanly
- Count tables allow horizontal scroll without clipping the page chrome

## Tests

Helper tests added:

- `lib/reporting/dates.test.ts`
- `lib/reporting/filters.test.ts`
- `lib/reporting/display.test.ts` (includes query-key, formatting, error, and navigation coverage)

## Validation

From `frontend/`:

- `npm test` — pass
- `npm run lint` — pass
- `npx tsc --noEmit` — pass
- `npm run build` — pass; `/reporting` present in production output

## Dependencies

- No new frontend or backend dependencies

## Backend / Migration Confirmation

- No backend file changes
- No migrations

## Deferred Scope

- FO-066 cross-module filters and drill-down
- Status / priority filters
- Exports, charts, scheduled reports
- Notification analytics, AI summaries, realtime updates
- Foundation Dashboard corrections
- FO-063 automatic Ticket closure

## Known Limitations

- Frontend date inputs are date-only; datetime precision beyond local day boundaries is not exposed
- Master-data option lists use `page_size: 100` (same pattern as Maintenance list filters)
- Average Inspection Score uses a Reporting-specific metric card so null can render as text rather than `0`

## Files Changed

- `frontend/app/(app)/reporting/page.tsx`
- `frontend/features/reporting/components/reporting-overview.tsx`
- `frontend/types/reporting.ts`
- `frontend/services/api/endpoints.ts`
- `frontend/services/api/reporting.ts`
- `frontend/services/api/query-keys.ts`
- `frontend/hooks/use-reporting-overview.ts`
- `frontend/lib/navigation.ts`
- `frontend/lib/reporting/*`
- `frontend/package.json` (test script)
- `docs/02-Development/FO-065 - Reporting Operational Overview Frontend.md`
- `docs/development/project-status.md`
- `docs/development/progress-map.md`
- `docs/development/work-tree.md`

## Commit SHA

- `f0ba1487371d988d4c0b6b2b80a405f32be16128` — `FO-065: add reporting operational overview frontend`

## Draft PR State

PR #38 remains open, draft, and unmerged on `feature/reporting`.
