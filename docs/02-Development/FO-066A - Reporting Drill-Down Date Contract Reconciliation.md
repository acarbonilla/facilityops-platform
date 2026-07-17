# FO-066A - Reporting Drill-Down Date Contract Reconciliation

## Objective

Correct the FO-066 Work Order drill-down date contract so the destination list uses the same `requested_at` basis as Reporting, and reject impossible calendar dates during URL construction and hydration.

## Preflight

- Branch: `feature/reporting`
- Starting HEAD: `dbf9bb4f2675a37ff227ff5693eb557bcab51415`
- PR #38 remained open, draft, and unmerged
- FO-066 was not rerun

## Confirmed Defects

1. Reporting aggregated Work Orders by `requested_at`, but the drill-down sent `created_from` / `created_to`, allowing the destination list to disagree with the Reporting total.
2. URL hydration accepted any string shaped as `YYYY-MM-DD`, including impossible dates.
3. Focused boundary testing exposed that Maintenance date-only upper bounds were parsed as midnight before end-of-day handling, excluding later records on the selected final day.

## Corrected Contract

- Work Order drill-down sends `requested_from` and `requested_to`.
- Maintenance list state hydrates these values into `requestedFrom` and `requestedTo` and sends them to the existing backend list filters.
- The Maintenance backend applies inclusive local start/end-of-day bounds to `requested_at`.
- Ticket and Inspection drill-downs continue omitting Reporting dates because no equivalent destination date contract is approved.
- `created_from` / `created_to` remain supported for ordinary Maintenance list filtering but are not used by Reporting drill-downs.

## Date Validation

The Reporting date helper is now the shared calendar-aware validator for drill-down construction and list hydration. It accepts real `YYYY-MM-DD` dates, including valid leap days, and rejects malformed or impossible dates such as `2026-02-30` and `2026-99-99`.

## Security and Scope

Tenant and permission behavior is unchanged. No tenant identifier is accepted from the Reporting frontend, and destination APIs remain backend-authoritative. No model, migration, dependency, or permission change was introduced.

## Tests

- Backend regression verifies inclusive `requested_from` / `requested_to` boundaries and exclusion beyond the upper bound.
- Frontend regressions verify requested-date URL mapping, absence of created-date mapping, impossible-date rejection, and leap-day hydration.

## Validation

| Check | Result |
| --- | --- |
| Focused requested-date backend regression | 1 OK |
| `apps.maintenance` | 85 OK |
| `apps.reporting` | 72 OK |
| Full backend suite `--parallel 4` | 499 OK |
| `manage.py check` | Clean |
| `makemigrations --check --dry-run` | No changes detected |
| Frontend `npm test` | 179 pass |
| `npm run lint` | Pass |
| `npx tsc --noEmit` | Pass |
| `npm run build` | Pass; Reporting and Maintenance routes included |

## Deferred Scope

Exports, charts, scheduled reports, Notification analytics, AI/realtime, Foundation Dashboard changes, FO-063, Inspection priority, and browser-test automation remain deferred.

## Status

FO-066A is complete on `feature/reporting`. User manual acceptance passed on 2026-07-17. FO-067 cumulative QA initially recorded no production-code corrections, but Sol’s independent review later confirmed remaining exact-180-day and timezone boundary parity defects. Those defects are corrected in FO-067A. Sol’s renewed independent cumulative review is APPROVED in FO-067B. PR #38 remains draft and unmerged, ready for the user’s merge decision.
