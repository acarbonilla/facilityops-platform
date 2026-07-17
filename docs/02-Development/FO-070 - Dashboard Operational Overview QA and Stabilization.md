# FO-070 - Dashboard Operational Overview QA and Stabilization

## 1. Objective and scope

Perform cumulative QA and stabilization of the Dashboard Operational Overview feature implemented through FO-068, FO-069, and FO-069A. Correct only confirmed defects, reconcile documentation and draft PR #39, and prepare the feature for Sol’s independent cumulative final review.

## 2. Reviewed milestones

| Milestone | Scope |
| --- | --- |
| FO-068 | Foundation Dashboard tenant-isolation backend correction |
| FO-069 | Dashboard scope UX and Reporting navigation alignment |
| FO-069A | Dashboard connectivity Checking-state correction |

Starting HEAD for FO-070: `a0e5ff67783ececd74e96dc17f957710637b1da7` on `feature/dashboard-operational-overview`. Draft PR #39 OPEN, draft, unmerged; base `main`.

## 3. Confirmed defects and corrections

**None confirmed.**

FO-070 required **no production code correction**. Prior FO-069A already corrected the Medium-severity pending-health → “Unavailable” defect. Code inspection of backend isolation, RBAC, frontend auth/query gating, permission-aware navigation, and the health-state matrix found no additional defects against the approved cumulative contract.

## 4. Security and tenant-isolation findings

- `GET /api/dashboard/foundation-summary/` requires authentication (`IsAuthenticated`).
- Scope is determined from `request.user` via Dashboard-local `tenant_scope` helpers.
- Tenant-bound users receive same-tenant non-deleted master-data counts only.
- Tenantless non-global users fail closed with zero numeric counts.
- Superuser and active `system_admin` receive approved global counts; ordinary `is_staff` does not.
- Client `tenant` / `tenant_id` query parameters cannot broaden scope.
- Soft-deleted rows excluded via `is_deleted=False` (FO-068 contract; `is_active` not applied).
- No Reporting service or permission coupling.

## 5. RBAC findings

- No `dashboard.view` permission exists or is seeded.
- Dashboard API remains auth-only (post-login availability preserved).
- Frontend `ProtectedRoute` gates the page; Reporting/Master Data links use existing permission helpers.
- Accounts / Access Control / Master Data / Reporting modules remain unaffected by Dashboard changes.

## 6. Aggregation findings

- Response keys unchanged: `tenants`, `organizations`, `departments`, `buildings`, `floors`, `areas`, `asset_types`, `assets`, `service`.
- Eight bounded `COUNT` queries; FO-068 tests assert query budget `<= 20`.
- No N+1 row iteration; no models or migrations in `apps.dashboard`.

## 7. Frontend auth/query findings

- Summary and health queries use `enabled = !isLoading && isAuthenticated`.
- Logged-out / auth-restoring users do not fire Dashboard requests.
- Backend remains authoritative for counts and access.

## 8. Navigation permission findings

- “View Operational Reporting” → `/reporting` only with `reporting.view` when permissions are ready.
- Master Data quick links require `settings.view`.
- Permission loading/error fail closed (links hidden; no disabled stubs).

## 9. Health-state findings

Validated matrix:

| Data | Pending/Fetching | Error | Expected |
| --- | --- | --- | --- |
| none | true | false | Checking |
| none | true | true | Checking (retry) |
| none | false | true | Unavailable |
| ok | any | any | Connected |
| non-ok | any | any | Degraded |
| none | false | false (not started) | Checking |

Checking uses neutral styling and polite `role="status"`; Unavailable uses alert semantics; Connected/Degraded preserve confirmed data during background refetch.

## 10. Accessibility and responsive findings

- Single page-level `h1`; logical `h2` sections; metric list semantics.
- Loading/status/error announcements appropriate; Retry keyboard-focusable.
- Links have descriptive accessible names; connectivity text is not color-only.
- Cards stack on narrow screens; long values wrap; no confirmed primary horizontal overflow.

## 11. Performance/query findings

- Stable query keys; no tenant UUID in keys or requests.
- Independent summary and health caches; health `retry: 1`.
- No speculative caching or optimization introduced during FO-070.

## 12. Tests added or updated

None. No production correction was required, so no new regression tests were added in FO-070. Existing FO-068 backend (17) and FO-069/FO-069A frontend helper coverage (22 Dashboard helpers within 202 suite) remain the regression baseline.

## 13. Full validation results

### Backend focused

| Suite | Count | Result | Exit |
| --- | --- | --- | --- |
| `apps.dashboard` | 17 | OK | 0 |
| `apps.accounts` + `apps.access_control` | 109 | OK | 0 |
| `apps.master_data` | 19 | OK | 0 |
| `apps.reporting` | 86 | OK | 0 |
| `apps.fm_tickets` + `apps.maintenance` + `apps.inspection` | 212 | OK | 0 |
| `apps.notifications` | 78 | OK | 0 |
| Full suite `--parallel 4` | 528 | OK | 0 |
| `manage.py check` | — | Clean | 0 |
| `makemigrations --check --dry-run` | — | No changes detected | 0 |
| `showmigrations dashboard` | — | `(no migrations)` | 0 |

Parallel suite succeeded on first run (no test-database clone lock failure).

### Frontend

| Check | Result | Exit |
| --- | --- | --- |
| `npm test` | 202 pass | 0 |
| `npm run lint` | Clean | 0 |
| `npx tsc --noEmit` | Clean | 0 |
| `npm run build` | Clean; routes include `/dashboard` and `/reporting` | 0 |

Build-touched `next-env.d.ts` / `tsconfig.json` restored (no intentional source change).

## 14. Manual acceptance status

**Pending user-executed smoke test after FO-069A.**

Automated FO-069A health-state correction is complete. Codex did not run a browser session. Recommended user checklist:

1. Open Dashboard during initial load → Backend status shows **Checking**.
2. With backend reachable → status becomes **Connected**.
3. Force a real health failure → **Unavailable** only after failure.
4. Successful foundation counts remain visible if only health fails.
5. Tenant user sees only their tenant’s foundation counts.
6. System administrator sees intended global counts.
7. Reporting link follows `reporting.view`.
8. Master Data links follow `settings.view`.
9. Confirm narrow-screen layout.

Automated QA is not blocked pending this checklist.

## 15. Known limitations and deferred scope

- No component/browser/integration frontend harness (helper-level only).
- Charts, exports, and operational Reporting analytics remain out of Dashboard scope.
- FO-063 automatic Ticket closure remains reserved/deferred.
- Soft-delete exclusion is the approved eligibility rule; inactive (`is_active=False`) rows still count by FO-068 design.
- Sol’s independent cumulative final review of PR #39 is still pending.

## 16. Migration / dependency confirmation

- No migration
- No model changes
- No permission/seed changes
- No dependency additions
- No production source changes in FO-070

## 17. Final module status

- Dashboard Operational Overview: **Complete on the feature branch** after cumulative QA.
- PR #39 remains **open, draft, and unmerged**, awaiting Sol’s independent cumulative final review.
- FO-068, FO-069, FO-069A, and FO-070 are complete on `feature/dashboard-operational-overview`.

## 18. Review gate

Ready for Sol’s independent cumulative final review. Do not mark PR ready or merge until that review completes and the user decides.
