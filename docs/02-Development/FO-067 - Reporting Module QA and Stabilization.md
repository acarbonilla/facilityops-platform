# FO-067 - Reporting Module QA and Stabilization

## Objective

Perform cumulative final QA for Reporting and Operational Analytics delivered through FO-064–FO-066A. Confirm security, aggregation accuracy, filtering, drill-down behavior, frontend UX, documentation, repository hygiene, and regression safety. Correct only confirmed defects.

## Preflight

- Branch: `feature/reporting`
- Starting HEAD: `14131f80a5cee86313fd390c4ba0d6f3f590bac1`
- Local matched `origin/feature/reporting` after fast-forward from `dbf9bb4`
- Working tree clean at start
- PR #38: OPEN, draft, unmerged, base `main`, head `feature/reporting`
- FO-067 was not previously implemented
- Main baseline: `ae3d208663cf31937bee5a326ce339b14b78e918`

## Executive QA Outcome

**Pass with later qualification.** At FO-067 close, no production-code defects requiring correction were confirmed against the then-approved FO-064–FO-066A contracts, and FO-067 remained documentation-and-validation only.

Sol’s subsequent independent cumulative review of PR #38 confirmed two medium-severity date-parity defects that FO-067 had recorded only as residual known limitations. Those defects are corrected in **FO-067A**. Do not retain an unqualified “no production defects” reading of FO-067 without that follow-up.

Known residual limitations recorded at FO-067 close (later corrected by FO-067A):

## Reviewed Milestones

- FO-064 — Reporting Backend Aggregation Foundation
- FO-064A — Reporting API Contract Validation and Backend Reconciliation
- FO-065 — Reporting Operational Overview Frontend
- FO-065A — Reporting Filter Options Access and UX Reconciliation
- FO-066 — Reporting Cross-Module Filters and Drill-Down Workflows
- FO-066A — Reporting Drill-Down Date Contract Reconciliation

## Confirmed Defects and Corrections

No confirmed production defects. No production code, tests, migrations, or dependencies were changed for FO-067.

Residual known limitations (documented, not patched):

1. **Exact 180-day calendar span clamp (FO-065 intentional at the time; corrected by FO-067A).** Frontend `toReportingApiDateBounds` previously clamped `date_to` to `date_from + 180 days` when end-of-day would exceed the backend timedelta limit. Work Order drill-down still passed the selected calendar `requested_to` date (inclusive end-of-day). At the exact max span, overview totals and Work Order list counts could differ for records late on the final day.
2. **Browser-local vs Django `TIME_ZONE` day bounds (corrected by FO-067A).** Reporting overview ISO bounds previously used the browser local calendar; Maintenance `requested_*` date-only filters use Django `TIME_ZONE` (default `Asia/Manila`). When those timezones differed, same calendar dates could diverge.

## Security and Tenant-Isolation Findings

- `GET /api/reporting/overview/` and `GET /api/reporting/filter-options/` require authentication and `reporting.view`.
- Frontend `reporting.view` checks are advisory; backend remains authoritative.
- Reporting access does not grant Master Data administration, FM Ticket, Maintenance, or Inspection module access.
- Tenant-bound users see only same-tenant aggregates and filter options.
- Cross-tenant rows are excluded; soft-deleted rows are excluded.
- Tenantless non-global users receive empty scoped results / empty options.
- Global `system_admin` / superuser scope remains approved.
- No client-supplied tenant UUID can broaden Reporting scope.

## Aggregation and Filter Findings

- Common filters: `date_from`, `date_to`, `organization`, `building`.
- Module filters: `ticket_status`, `ticket_priority`, `work_order_status`, `work_order_priority`, `inspection_status`.
- Generic `status` / `priority` remain HTTP 400.
- Authoritative date fields: Tickets `reported_at`, Work Orders `requested_at`, Inspections `scheduled_date`.
- Module filters are isolated; common filters apply to all modules.
- Default 90 days; max 180 days; inclusive bounds; equal bounds valid.
- Inspection average score remains null when no scored Inspections match.
- Foundation Dashboard global-count logic is not reused.

## Filter-Options Findings

- Endpoint requires `reporting.view` only (not `settings.view`).
- Tenant / global / empty-option behaviors match approved FO-065A contract.
- Inactive and soft-deleted master-data rows excluded; deterministic ordering retained.
- Response exposes only approved ID, name, and organization relationship fields.

## Drill-Down and Date-Parity Findings

| Destination | Mapped params |
| --- | --- |
| `/fm-tickets` | `status`, `priority`, `organization`, `building`, `from=reporting` |
| `/maintenance/work-orders` | `status`, `priority`, `organization`, `building`, `requested_from`, `requested_to`, `from=reporting` |
| `/inspection/inspections` | `status`, `organization`, `building`, `from=reporting` |

- Work Order drill-down does not send `created_from` / `created_to` (FO-066A).
- Ticket and Inspection Reporting dates remain omitted.
- Impossible calendar dates fail closed; valid leap days accepted.
- Invalid enums/UUIDs fail closed during hydration.
- URLs remain internal relative paths; no tenant UUID emitted.
- “Back to Reporting” appears only for `from=reporting`.
- Destination backend permissions remain authoritative.

## Frontend Permission Findings

- Drill-down visibility: `fm_tickets.view`; `maintenance.view` or `maintenance.work_order.view`; `inspection.view` or `inspection.manage`.
- Reporting nav and route require `reporting.view`.
- Overview and filter-options hooks are disabled until auth and `reporting.view` resolve (fail closed while loading).
- Users with only `reporting.view` can open Reporting without unauthorized module drill-down actions.

## Accessibility and Responsive Findings

- Module filter fieldsets/legends and labeled controls present.
- Active-filter summary uses module-qualified text labels.
- “Current period” copy is not duplicated.
- Drill-down links are descriptive and keyboard accessible.
- Tables do not rely on click-only rows.
- Filter groups and actions stack cleanly at narrow widths.
- No speculative sidebar redesign.

## Performance / Query Findings

- Aggregations use bounded, tenant-scoped querysets (no confirmed N+1 defect).
- Filter-options queries remain intentionally complete eligible lists under tenant/global scope.
- Query keys normalize approved parameters stably.
- Reporting API calls do not fire before authentication and permission resolution.
- No speculative optimization applied.

## Migration and Dependency Confirmation

- Reporting has no fact-table model and no migrations (`showmigrations reporting` → no migrations).
- FO-067 introduces no migration.
- No dependency addition.
- Build-touched `next-env.d.ts` / `tsconfig.json` restored; not committed.

## Automated Validation

| Check | Result |
| --- | --- |
| `apps.reporting` | 72 OK, exit 0 |
| `apps.fm_tickets` | 63 OK, exit 0 |
| `apps.maintenance` | 85 OK, exit 0 |
| `apps.inspection` | 64 OK, exit 0 |
| `apps.accounts` + `apps.access_control` | 109 OK, exit 0 |
| `apps.dashboard` + `apps.notifications` | 80 OK, exit 0 |
| Full suite `--parallel 4` | 499 OK, exit 0 |
| `manage.py check` | clean, exit 0 |
| `makemigrations --check --dry-run` | No changes detected, exit 0 |
| `showmigrations reporting` | (no migrations) |
| Frontend `npm test` | 179 pass, exit 0 |
| `npm run lint` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0; routes include `/reporting`, `/fm-tickets`, `/maintenance/work-orders`, `/inspection/inspections` |

## Manual Acceptance Record

- Date: 2026-07-17
- Executor: user
- Result: passed
- User statement: “All goods.”
- Codex did not execute a live browser session.
- Automated browser / component testing remains deferred.

## Deferred Scope

- Exports / charts / scheduled reports
- Notification analytics
- AI summaries / realtime
- Foundation Dashboard correction
- FO-063 automatic FM Ticket closure
- Inspection priority Reporting filter
- Exact Ticket/Inspection date drill-down parity
- Automated browser testing
- Independent Sol cumulative PR review for PR #38

## Final Module Status

FO-067 QA and the 2026-07-17 manual acceptance record remain valid for the scope exercised at that time. Reporting is **not** marked complete solely on FO-067 after Sol’s independent review finding; completion on `feature/reporting` requires FO-067A validation. PR #38 remains open, draft, and unmerged pending Sol’s renewed independent cumulative final review.

## PR State

PR #38 remains OPEN, draft, unmerged, base `main`, head `feature/reporting`.

## Files Changed

Documentation and tracker updates only:

- `docs/02-Development/FO-067 - Reporting Module QA and Stabilization.md` (created)
- `docs/02-Development/FO-066 - Reporting Cross-Module Filters and Drill-Down Workflows.md`
- `docs/02-Development/FO-066A - Reporting Drill-Down Date Contract Reconciliation.md`
- `docs/development/project-status.md`
- `docs/development/progress-map.md`
- `docs/development/work-tree.md`
- Draft PR #38 description

## Commit SHA

`5b198918bd1425153b231f9b2d4d9ca4983bcaf5`
