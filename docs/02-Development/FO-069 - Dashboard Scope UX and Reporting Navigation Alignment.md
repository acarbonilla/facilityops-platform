# FO-069 - Dashboard Scope UX and Reporting Navigation Alignment

## 1. Objective

Align the Foundation Dashboard frontend with FO-068’s authoritative tenant-scoped backend behavior. Communicate account-scoped foundation counts clearly, add permission-aware navigation to Operational Reporting, and stabilize authentication gating, loading, error, empty, accessibility, and responsive behavior — without copying Reporting analytics into the Dashboard.

## 2. Preflight

- Branch: `feature/dashboard-operational-overview`
- Starting HEAD: `f1f996a29f19df235e95b023719a4c66acc728c8`
- Local matched `origin/feature/dashboard-operational-overview`
- Working tree clean
- Draft PR #39 OPEN, draft, unmerged; base `main`; head `feature/dashboard-operational-overview`
- FO-068 present (tenant-scoped backend); FO-069 not previously implemented

## 3. Reused frontend architecture

- Route: `frontend/app/(app)/dashboard/page.tsx`
- Feature components: `features/dashboard/components/*`
- API: `services/api/dashboard.ts` + `dashboardQueryKeys.foundationSummary()`
- Auth: `useAuth` / `ProtectedRoute`
- Permissions: `usePermissions` (same pattern as sidebar)
- Reporting contract: `REPORTING_PERMISSION` / `/reporting`
- Shared UI: `PageHeader`, `LoadingState`, `ErrorState`, `UnauthorizedState`
- Helper harness: Node `node:test` via `frontend/package.json` test script

## 4. Scope communication

Neutral primary copy:

> Counts reflect the foundation data available to your account.

Supporting copy:

> Tenant users see their organization's tenant scope. Approved global administrators may see platform-wide totals.

No tenant UUID, role codes, permission codes, or internal API paths are exposed. Scope is not inferred client-side from response fields.

## 5. Reporting navigation contract

- Label: **View Operational Reporting**
- Target: `/reporting`
- Visible only when `hasPermission("reporting.view")` and permissions are ready
- Hidden while permissions load, on permission lookup failure, or when permission is absent
- No disabled placeholder link
- Reporting route remains independently backend-authoritative

## 6. Existing quick-link behavior

Master Data quick links previously rendered unconditionally while destinations require `settings.view`. FO-069 applies the smallest safe correction:

- Master Data links require `settings.view`
- Hidden while permissions load / fail / absent
- Existing useful destinations preserved (Master Data, Tenants, Organizations, Buildings, Assets)

## 7. Authentication / query gating

```text
enabled = !isLoading && isAuthenticated
```

Foundation summary and health queries use `isDashboardQueryEnabled`. Requests do not fire during auth restoration, for logged-out users, or after auth failure. Backend authentication remains authoritative.

## 8. Loading behavior

- Page heading / shell remain stable
- `LoadingState` shown for summary while pending
- Zero counts are not shown before data arrives
- Empty/zero context is not shown while pending

## 9. Error / retry behavior

- 401/403 → `UnauthorizedState`
- Recoverable failures → `ErrorState` with Retry (refetch summary)
- User-facing messages via `formatDashboardSummaryError`
- No raw payloads/stack traces
- Failed summary does not invent successful zero metrics

## 10. Empty / zero behavior

- All-zero summaries remain valid metrics (cards still render)
- Concise zero context: “No foundation records are currently available for your account.”
- Not treated as API failure; no cross-tenant or missing-permission speculation

## 11. Connectivity behavior

- Health/status card uses plain language and text + color indicators
- Health failure is isolated from foundation counts
- Summary failure is independent of health success messaging

## 12. Accessibility

- One primary `h1` via `PageHeader`
- Metric cards have readable labels/values
- Loading uses `role="status"`; errors use `role="alert"`
- Retry is a keyboard-focusable button
- Quick links use descriptive `aria-label`s and are real internal `Link`s
- Connectivity label includes visible text (not color alone)
- Metrics use a semantic list

## 13. Responsive behavior

- Metric cards stack (`sm:grid-cols-2`, `xl:grid-cols-4`)
- Quick links wrap; long labels/`break-words` on values
- Page padding follows existing `AppShell`
- No sidebar redesign

## 14. Tests added

`frontend/lib/dashboard/dashboard.test.ts` (13 helper tests) covering:

1. Query key stability / no tenant UUID
2. Auth restoration disablement
3. Logged-out suppression
4. Authenticated enablement
5. Scope-copy neutrality
6. All-zero detection
7. Metric mapping/order
8. Connectivity formatting
9. Summary error formatting
10–12. Reporting link visibility / hide without permission / hide while loading
13. Master-data quick-link permission gating

Registered in `frontend/package.json` test script.

## 15. Frontend validation

| Check | Result |
| --- | --- |
| `npm test` | 193 pass (180 baseline + 13) |
| `npm run lint` | Clean |
| `npx tsc --noEmit` | Clean |
| `npm run build` | Clean; includes `/dashboard` and `/reporting` |

Build-touched `next-env.d.ts` / `tsconfig.json` restored.

## 16. Backend regression validation

| Check | Result |
| --- | --- |
| `apps.dashboard` | 17 OK |
| `apps.reporting` | 86 OK |
| `manage.py check` | Clean |
| `makemigrations --check --dry-run` | No changes detected |

No backend production files changed.

## 17. Migration / dependency confirmation

- No migration
- No model changes
- No backend permission / seed changes
- No new dependencies or package version changes
- `frontend/package.json` changed only to register the helper test file

## 18. Deferred FO-070 scope

FO-070 covers cumulative Dashboard QA and stabilization across FO-068/FO-069/FO-069A. FO-070 is complete on the same branch with **no production correction** required; see `FO-070 - Dashboard Operational Overview QA and Stabilization.md`.

## 19. Follow-up correction

FO-069A corrects the Medium-severity defect where pending health checks displayed “Unavailable”. Connectivity now shows “Checking” during load/retry and “Unavailable” only after failure. See `FO-069A - Dashboard Connectivity Loading State Correction.md`.

## 20. PR state

- Branch: `feature/dashboard-operational-overview`
- Draft PR #39 remains OPEN, draft, unmerged
- Base: `main`
- Head: `feature/dashboard-operational-overview`

## Commit SHA

`d0075732365d251fe45407d20c94d8311f6276a4`
