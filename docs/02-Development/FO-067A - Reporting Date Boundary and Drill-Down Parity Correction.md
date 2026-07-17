# FO-067A - Reporting Date Boundary and Drill-Down Parity Correction

## 1. Objective

Correct the confirmed Reporting/Work Order date-parity defect identified during Sol’s independent cumulative PR review of draft PR #38.

Establish one authoritative server-side calendar-day contract so Reporting aggregation and the Maintenance Work Order drill-down include the same records for every accepted range, including the exact 180-day boundary.

## 2. Preflight

- Branch: `feature/reporting`
- Starting HEAD: `fda8eacef4a36d36696817979b46f271ebed4314`
- Local matched `origin/feature/reporting`
- Working tree clean at start
- PR #38: OPEN, draft, unmerged, base `main`, head `feature/reporting`
- FO-067A was not previously implemented
- Confirmed residual defect surface still present:
  - frontend browser-local ISO day bounds via `toReportingApiDateBounds`
  - exact-180-day frontend clamp
  - Work Order drill-down date-only `requested_*`
- Main baseline: `ae3d208663cf31937bee5a326ce339b14b78e918`

## 3. Independent-Review Findings

Sol’s independent cumulative review of PR #38 identified that FO-067’s “no production defects” conclusion was incomplete. Two medium-severity date-parity defects remained:

1. **FO-067A-1 — Exact 180-day final-day mismatch**
2. **FO-067A-2 — Browser-timezone vs server-timezone mismatch**

These defects may not have been exercised during the 2026-07-17 manual acceptance pass.

## 4. Root Causes

1. Frontend converted selected `YYYY-MM-DD` dates to browser-local start/end-of-day ISO datetimes.
2. At an exact 180 calendar-day span, end-of-day exceeded an elapsed duration of `180 × 24h`, so the frontend clamped `date_to` to `date_from + 180 days` (typically the start of the final selected day).
3. Work Order drill-down sent the original selected calendar date as `requested_to=YYYY-MM-DD`, which Maintenance interprets as inclusive server-timezone end-of-day.
4. Late-final-day Work Orders could therefore appear in Maintenance but not in Reporting totals.
5. Browser-local day bounds could diverge from Django `TIME_ZONE` (default `Asia/Manila`) day bounds when the browser timezone differed.

## 5. Authoritative Timezone Decision

Django’s configured timezone (`timezone.get_current_timezone()`, default `Asia/Manila`) is authoritative for Reporting calendar-day boundaries.

Browser-local timezone conversion is not used for authoritative query bounds.

## 6. Date-Only API Contract

### Frontend request

- Filter controls remain local `YYYY-MM-DD` strings.
- Overview request sends:
  - `date_from=YYYY-MM-DD`
  - `date_to=YYYY-MM-DD`
- No browser-local ISO conversion.
- No exact-180-day clamp.
- Validation remains: both required, real calendar dates, `date_from <= date_to`, calendar span `<= 180`, exact 180 accepted.

### Backend resolution

- Date-only `date_from` → selected day at local `00:00:00.000000`
- Date-only `date_to` → selected day at local `23:59:59.999999`
- Aware ISO datetimes retain explicit instant semantics (compatibility preserved).
- Naive datetimes are made aware in the current timezone.
- No silent reinterpretation of aware datetimes.

### Response echo

- Date-only requests echo normalized `YYYY-MM-DD`.
- Datetime requests continue to echo ISO datetimes.
- Frontend empty-period display formats date-only echoes as calendar dates without UTC-midnight shift.

## 7. Exact 180-Day Behavior

Maximum range is the selected calendar-day span, not elapsed start-of-day to end-of-day duration.

| Selection | Expected |
| --- | --- |
| Same date | Accepted; full selected day |
| 179-day difference | Accepted |
| Exact 180-day difference | Accepted; full final day included |
| 181-day difference | Rejected |
| Reversed range | Rejected |
| Impossible date | Rejected |

## 8. Work Order Drill-Down Parity

Preserved:

- `requested_from=YYYY-MM-DD`
- `requested_to=YYYY-MM-DD`
- `from=reporting`

Reporting overview and Maintenance list now interpret the same selected calendar range with the same Django timezone and inclusive full-day semantics.

Never sent from Reporting:

- `created_from` / `created_to`
- browser-generated ISO day boundaries
- tenant UUID

Maintenance production code required no further change; its date-only `requested_*` semantics already use Django timezone inclusive end-of-day.

## 9. Security and Tenant-Isolation Confirmation

Unchanged:

- authentication requirements
- `reporting.view`
- tenant isolation
- global administrator scope
- Master Data access rules
- module drill-down permissions
- soft-delete exclusion
- no client-supplied tenant selector

## 10. Tests Added

### Backend (`ReportingDateBoundaryFO067ATests`)

1. Date-only bounds use server-timezone start/end-of-day
2. Work Order at start of `date_from` included
3. Work Order late on `date_to` included
4. Work Order immediately before `date_from` excluded
5. Work Order immediately after `date_to` excluded
6. Exact 180-day selection includes late-final-day Work Orders
7. 181-day selection rejected
8. Same-day selection includes full day
9. Impossible dates → HTTP 400
10. Reversed dates → HTTP 400
11. Browser timezone cannot influence date-only interpretation
12. Reporting Work Order total matches Maintenance list count for equivalent filters
13. Tenant isolation intact
14. Valid aware ISO datetime behavior retained

### Frontend

- Date-only API serialization; no ISO conversion; no 180-day clamp
- Exact 180 accepted; 181 rejected; impossible dates fail
- Leap-day handling retained
- Work Order drill-down date-only `requested_*`; omits `created_*`
- Ticket/Inspection drill-downs continue omitting dates
- Query-key / reset/default behavior retained

Obsolete frontend helpers removed: `toLocalStartOfDayIso`, `toLocalEndOfDayIso`.

## 11. Backend Validation

| Check | Result |
| --- | --- |
| Focused FO-067A regression | 14 OK |
| `apps.reporting` | 86 OK |
| `apps.maintenance` | 85 OK |
| `apps.fm_tickets` | 63 OK |
| `apps.inspection` | 64 OK |
| `apps.accounts` + `apps.access_control` | 109 OK |
| `apps.dashboard` + `apps.notifications` | 80 OK |
| Focused cumulative modules | 487 OK |
| Full suite `--parallel 4` | 513 OK |
| `manage.py check` | Clean |
| `makemigrations --check --dry-run` | No changes detected |
| `showmigrations reporting maintenance` | Reporting: no migrations; Maintenance unchanged |

Starting baseline Reporting 72 → 86 (+14 FO-067A). Full backend 499 → 513 (+14).

## 12. Frontend Validation

| Check | Result |
| --- | --- |
| `npm test` | 180 pass (baseline 179) |
| `npm run lint` | Pass |
| `npx tsc --noEmit` | Pass |
| `npm run build` | Pass; routes include `/reporting`, `/fm-tickets`, `/maintenance/work-orders`, `/inspection/inspections` |

Build-touched `next-env.d.ts` / `tsconfig.json` restored; not committed.

## 13. Migration / Dependency Confirmation

- No migration expected or created.
- No Reporting fact model.
- No dependency addition.
- No package version changes.
- No timezone libraries added.
- Uses existing JavaScript, Django, and Python date/time facilities.

## 14. Manual Acceptance Impact

Preserve the user’s 2026-07-17 manual acceptance record (“All goods.”).

Clarify: the exact-180-day and timezone-boundary defect was found through independent code review and may not have been exercised during that manual acceptance.

Do not require repeating all manual tests. Optional focused smoke after FO-067A:

1. Select an exact 180-day Reporting range.
2. Confirm a Work Order late on the final date is included.
3. Open Work Order drill-down.
4. Confirm the Reporting total matches the destination list count for equivalent filters.

## 15. Deferred Scope

- Ticket and Inspection Reporting date drill-downs (destination-list contracts still pending)
- Exports / charts / scheduled reports
- Notification analytics
- AI / realtime
- Foundation Dashboard correction
- FO-063 automatic Ticket closure
- Automated browser testing
- Sol’s renewed independent cumulative final review of PR #38

## 16. Final Review Status

FO-067A corrects the confirmed date-parity defects. Reporting is complete on `feature/reporting` only after FO-067A validation passes. Another final independent cumulative review remains required before merge.

## 17. PR State

PR #38 remains OPEN, draft, unmerged, base `main`, head `feature/reporting`.
