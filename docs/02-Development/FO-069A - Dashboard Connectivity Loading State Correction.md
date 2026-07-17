# FO-069A - Dashboard Connectivity Loading State Correction

## 1. Objective

Correct the FO-069 frontend defect where the Dashboard System Status card showed “Unavailable” while the backend health request was still pending. Represent connectivity loading honestly as “Checking” without changing Foundation summary behavior.

## 2. Preflight

- Branch: `feature/dashboard-operational-overview`
- Starting HEAD: `c490d5557dc02bd867e410c69e2106346832e462`
- Local matched origin; working tree clean
- Draft PR #39 OPEN, draft, unmerged; base `main`
- FO-069 present; FO-069A not previously implemented
- Confirmed helper mapped pending/no-data to `unknown` → “Unavailable”

## 3. Confirmed defect and severity

**Severity: Medium**

During initial health query pending (`data` undefined, `isError` false), `buildDashboardSystemStatus()` returned `status: "unknown"` / `connected: false`, and `formatDashboardHealthLabel()` mapped that to “Unavailable”, showing a misleading failure before the request completed.

## 4. Root cause

The status builder treated absence of health data as failure/unknown unless `healthFailed` was set. It did not accept pending/fetching query state, so the normal loading path looked like an outage.

## 5. Final connectivity-state matrix

| Health-query state | Visible label | Meaning |
| --- | --- | --- |
| Auth restoration / query disabled | Checking | Connectivity has not been tested yet |
| Query pending/fetching with no data | Checking | Connectivity check is in progress |
| Response status `ok` | Connected | Backend health confirmed |
| Successful non-OK status | Degraded | Backend responded but health is not normal |
| Request failed | Unavailable | Connectivity could not be confirmed |
| Retry in progress after failure | Checking | A new connectivity check is running |

## 6. Query-state precedence

1. Pending/fetching without confirmed data → Checking
2. Successful `status === "ok"` → Connected (preserves confirmed data during background refetch)
3. Successful non-OK response → Degraded (same preservation rule)
4. Failed request with no data and not pending/fetching → Unavailable
5. Initial disabled/not-yet-run → Checking

`SystemStatus` now includes explicit `checking: boolean` plus `status: "checking"` when applicable.

## 7. Card behavior

- Checking: neutral slate badge, message “Checking backend connectivity.”, polite `role="status"`
- Connected: success styling + text
- Degraded: amber/warning styling + unexpected-status message
- Unavailable: failure styling + alert semantics; footnote only when status is unavailable
- Color is never the only indicator

## 8. Authentication gating confirmation

Preserved: `enabled = !isLoading && isAuthenticated` via `isDashboardQueryEnabled`. Disabled/auth-restoring health state renders Checking, not Unavailable, and does not fire a request.

## 9. Accessibility behavior

- Checking announced politely via `role="status"`
- Unavailable message uses `role="alert"`
- Connected/Degraded/Checking all have text labels
- No aggressive alert during normal refetch
- Card remains keyboard-neutral (no new actions)

## 10. Tests added

Extended `frontend/lib/dashboard/dashboard.test.ts` (+9 helper cases) for Checking/Connected/Degraded/Unavailable/retry/background-refetch/neutral messaging. Existing summary-error and auth-enablement tests retained.

## 11. Frontend validation

| Check | Result |
| --- | --- |
| `npm test` | 202 pass (193 baseline + 9) |
| `npm run lint` | Clean |
| `npx tsc --noEmit` | Clean |
| `npm run build` | Clean; includes `/dashboard` and `/reporting` |

## 12. Backend regression validation

| Check | Result |
| --- | --- |
| `apps.dashboard` | 17 OK |
| `manage.py check` | Clean |
| `makemigrations --check --dry-run` | No changes detected |

No backend production files changed.

## 13. Migration / dependency confirmation

- No migration
- No model / permission / dependency changes
- No `package.json` version or test-script registration change required

## 14. Deferred FO-070 scope

FO-070 cumulative Dashboard QA is complete on the same branch with no additional production correction required. See `FO-070 - Dashboard Operational Overview QA and Stabilization.md`.

## 15. PR state

- Branch: `feature/dashboard-operational-overview`
- Draft PR #39 remains OPEN, draft, unmerged
- Base: `main`
- Head: `feature/dashboard-operational-overview`

## Reconciliation Note — FO-070A

FO-069A is complete and independently approved within Sol’s cumulative FO-068–FO-070 review (**APPROVED** at `0c812e635d051a42bf98141a62cbccf699f3a962`). User manual acceptance passed 2026-07-18. See `FO-070A - Final Dashboard Review and Repository Reconciliation.md`.

## Commit SHA

`2bb1d34685182a464d4cc1154c891298004ff4e2`
