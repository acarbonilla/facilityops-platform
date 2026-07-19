# FO-073 - Master Data Frontend Lifecycle and Administrative UX Alignment

## 1. Objective

Align the existing Master Data administrative frontend with the FO-071 tenant
scope and FO-072 lifecycle contracts. The implementation gives all eight
resources consistent active, inactive, and deleted discovery; explicit
deactivate, reactivate, soft-delete, and restore actions; tenant-aware forms;
and safe, readable API feedback. A targeted backend extension adds
authenticated, scoped, paginated deleted-record discovery without changing
models, lifecycle mutation semantics, or the FO-072 approval boundary.

## 2. Preflight

- Branch: `feature/master-data-management`.
- FO-071 is complete and independently approved.
- FO-072 is complete and independently approved at final HEAD `a8ea862` per
  user governance.
- FO-073 implementation changes were inspected directly before this
  documentation reconciliation.
- FO-074 is pending.
- FO-063 remains reserved and deferred.
- Cumulative PR #40 remains open, draft, unmerged, and based on `main`.
- The pre-existing working tree was reviewed file by file. All retained changes
  belong to FO-073; generated Next.js changes were removed.

### Exact files changed

- `backend/apps/master_data/tests.py`
- `backend/apps/master_data/views.py`
- `docs/02-Development/FO-072 - Master Data Soft Delete Deactivation Lifecycle and Hierarchy Integrity.md`
- `docs/02-Development/FO-073 - Master Data Frontend Lifecycle and Administrative UX Alignment.md`
- `docs/development/progress-map.md`
- `docs/development/project-status.md`
- `docs/development/work-tree.md`
- `frontend/app/(app)/admin/assets/page.tsx`
- `frontend/components/master-data/master-data-lifecycle-screen.tsx`
- `frontend/components/master-data/master-data-screens.tsx`
- `frontend/features/master-data/components/area-form.tsx`
- `frontend/features/master-data/components/asset-form.tsx`
- `frontend/features/master-data/components/asset-type-form.tsx`
- `frontend/features/master-data/components/building-form.tsx`
- `frontend/features/master-data/components/department-form.tsx`
- `frontend/features/master-data/components/floor-form.tsx`
- `frontend/features/master-data/components/master-data-form-pages.tsx`
- `frontend/features/master-data/components/organization-form.tsx`
- `frontend/features/master-data/components/shared.tsx`
- `frontend/features/master-data/components/tenant-form.tsx`
- `frontend/lib/master-data/lifecycle.test.ts`
- `frontend/lib/master-data/lifecycle.ts`
- `frontend/package.json`
- `frontend/services/api/client.ts`
- `frontend/services/api/endpoints.ts`
- `frontend/services/api/master-data.ts`
- `frontend/services/api/query-keys.ts`
- `frontend/services/api/types.ts`
- `frontend/types/master-data.ts`

## 3. Reused architecture

FO-073 retains the Next.js App Router, shared authenticated app shell,
`ProtectedPermissionRoute`, TanStack Query, common table/loading/error/empty
components, the existing API client and Master Data service module, existing
resource routes, forms, payload fields, and backend pagination contract.
Lifecycle policy is centralized in `frontend/lib/master-data/lifecycle.ts`;
the canonical UI is centralized in
`frontend/components/master-data/master-data-lifecycle-screen.tsx`.

No parallel API client, state framework, route namespace, permission code,
model, or payload contract was introduced.

## 4. Final information architecture

- `/master-data` remains the administrative landing page.
- Existing list routes for Tenants, Organizations, Departments, Buildings,
  Floors, Areas, Asset Types, and Assets now render one shared lifecycle
  screen.
- Existing create and edit routes remain canonical.
- Each resource list exposes Active, Inactive, and Deleted lifecycle tabs.
- Active and inactive rows use the ordinary collection route with an
  `is_active` filter.
- Deleted rows use the dedicated authenticated deleted collection route.
- Organization Management and Asset Management remain consumers of the same
  Master Data APIs; no competing lifecycle administration surface was added.

## 5. Lifecycle UX

The lifecycle tabs distinguish active, inactive, and soft-deleted records with
visible status badges and lifecycle-specific empty, loading, and error states.
Every destructive or state-changing action opens a confirmation dialog that
names the record and explains dependency or hierarchy consequences.

Deactivation preserves the record, reactivation requires a valid active
hierarchy, deletion is explicitly described as soft deletion, and restoration
returns the record as inactive. Successful mutations identify the affected
record and final state. Create and edit forms no longer expose `is_active`;
lifecycle state changes occur only through the matrix actions and their
confirmation dialog.

## 6. Action matrix

| Lifecycle | Non-Tenant resources with `settings.manage` | Tenant resource |
| --- | --- | --- |
| Active | Edit, Deactivate, Soft delete | Edit and Deactivate; Soft delete only with reliable global-role evidence |
| Inactive | Edit, Reactivate, Soft delete | Edit; Reactivate and Soft delete only with reliable global-role evidence |
| Deleted | Restore | Restore only with reliable global-role evidence |

Actors without a reliable, loaded `settings.manage` decision receive no
mutation controls. Tenant creation is also withheld because the current
frontend session does not expose reliable global-role evidence. Backend
authorization and object scope remain authoritative.

## 7. Deleted discovery contract

Deleted records are discovered through:

`GET /api/master-data/{resource}/deleted/`

Restoration continues through:

`POST /api/master-data/{resource}/{uuid}/restore/`

The deleted collection is an authenticated Master Data route introduced by
FO-073, not an internal lookup and not an `include_deleted` option on the
ordinary list.
The frontend uses the same resource key mapping and paginated response shape
for all eight resources. Deleted rows expose restoration only and are not
offered as relationship choices.

## 8. Tenant UX

Tenant-bound sessions are limited to their authenticated Tenant by the backend
and by form payload binding. Tenant ownership controls are locked with
explanatory copy when the authenticated user has a Tenant. Staff status is not
treated as global authority.

The frontend intentionally withholds Tenant create, delete, restore, and
reactivate controls unless reliable global-role evidence exists. The current
session contract supplies no such evidence, so those global-only operations
remain available through the API administration workflow. Same-tenant Tenant
metadata editing and permitted deactivation remain visible.

## 9. Permissions

- List discovery requires authenticated access and remains backend-protected by
  `settings.view`.
- Create, edit, deactivate, reactivate, soft-delete, and restore require
  `settings.manage`.
- Permission-dependent mutation controls fail closed while permissions are
  loading or when permission retrieval fails.
- Frontend visibility is advisory; backend permissions, tenant scope, and
  lifecycle rules remain authoritative.
- No new permission code or role inference was added.

## 10. Tenant-aware forms

Create and edit forms reuse existing payloads and bind any tenant-bearing
payload to `user.tenant` for tenant-bound actors. Related-option loaders follow
backend pagination to collect the scoped option set. Selectors exclude
unrelated inactive records while preserving the current inactive relationship
when editing, so retained records remain repairable without making inactive
parents generally selectable.

Hierarchy selectors reset dependent values after Tenant, Organization,
Building, or Floor changes. Existing nullable Asset Floor and Area payload
handling is preserved. No client-selected Tenant can override the authenticated
Tenant.

Master Data lifecycle and form-option query keys include the authenticated
user and Tenant scope, preventing a cached result from one session scope from
being reused in another.

## 11. Pagination

Canonical lifecycle lists use backend pagination with a fixed page size of 25.
The query key includes resource, lifecycle, and normalized pagination params.
Changing lifecycle resets the page to 1; remaining on the same lifecycle
preserves the page. Previous and Next controls use backend links, and the UI
shows current page, total pages, and total record count. A lifecycle mutation
that removes the sole row from a later page moves the view to the previous
valid page.

Related form options are fetched page-by-page at up to 100 records per request
until the backend reports no next page. No response is assumed to be
unpaginated.

## 12. Search decision

Client-side search is intentionally disabled. Searching only the current
server page would produce incomplete and misleading results, while the current
Master Data collection contract has no confirmed search parameter. FO-073
therefore adds no search field and invents no endpoint or query parameter.

## 13. API and error handling

The shared Master Data service now maps typed resource keys to ordinary,
deleted, detail, delete, patch, and restore routes. Lifecycle mutations use the
existing HTTP contracts: PATCH `is_active`, DELETE for protected soft deletion,
and POST restore.

User-facing normalization handles validation errors, expired sessions,
permission failures, stale/not-found records, network failures, dependency
conflicts, and hierarchy conflicts. Structured dependency names and hierarchy
fields are rendered as readable text; unknown response payloads are not dumped
into the UI. Retry is available for list-load failure, and mutation failures
remain in the confirmation dialog or form error state. Form submissions absorb
the rejected mutation promise after React Query records the error, preventing
the Next.js runtime overlay. HTTP 400 field errors are rendered with field
labels or a clear form-level message, and HTTP 409 dependency and hierarchy
context is retained.

## 14. Cache invalidation

Successful create, edit, or lifecycle mutations invalidate the affected Master
Data resource and, when applicable, record detail. They also invalidate known
dependent caches for Foundation Dashboard, Reporting overview and filter
options, User form options, Maintenance form options, and Inspection form
options. This refreshes consumers whose counts or selectors depend on active
Master Data without introducing cross-tab realtime synchronization.

## 15. Accessibility and responsive behavior

Lifecycle navigation uses an accessible labelled tab list with selected state.
Tables include captions; pagination uses labelled navigation; success feedback
uses a polite live region; errors use alert semantics. Confirmation dialogs
provide dialog labelling, descriptions, modal semantics, Escape handling, and
initial focus on the safe Cancel action. Keyboard focus is trapped while the
dialog is open and returns to the invoking control when the dialog closes.

Actions wrap on narrow screens, dialogs constrain viewport height and scroll
internally, and controls stack before widening at responsive breakpoints.
Lifecycle state is conveyed by text as well as color.

## 16. Tests

Focused helper tests cover lifecycle-state mapping, list parameters,
pagination, route and query-key stability, action visibility, fail-closed
permissions, inactive option preservation, tenant payload binding, Tenant
global-action withholding, structured error formatting, success and empty
messages, search deferral, cross-feature invalidation, and hierarchy selector
resets. Nine focused backend tests cover deleted endpoint authentication,
permissions, all eight resources, tenant and global scope, fail-closed
tenantless behavior, pagination, safe filters, read-only behavior, and ordinary
list exclusion.

Confirmed focused result at reconciliation time:

- Master Data backend: 77 tests passed.
- Frontend: 222 tests passed, including 20 FO-073 lifecycle helper tests.

## 17. Backend validation

- Master Data: 77 passed.
- Accounts + Access Control: 111 passed.
- Dashboard: 17 passed.
- Reporting: 86 passed.
- FM Tickets + Maintenance + Inspection: 212 passed.
- Notifications: 78 passed.
- Full backend was not cleanly rerun after FO-073 added nine tests. The 579
  result belongs to the FO-072 historical baseline; FO-074 owns the corrected
  cumulative total.
- Django system check: no issues.
- Migration drift check: no changes detected.
- Master Data migration state: `[X] 0001_initial`.

An overlapping duplicate backend attempt collided with the same PostgreSQL test
database while another validation was active. That infrastructure-only attempt
was stopped and is not a product-test failure.

## 18. Frontend validation

- `npm test`: 222 passed, exit 0.
- `npm run lint`: passed, exit 0.
- `npx tsc --noEmit`: passed, exit 0.
- `npm run build`: passed, exit 0; 52 static pages generated.
- Generated `next-env.d.ts` and `tsconfig.json` changes are excluded from the
  delivery.

## 19. Migration and dependency confirmation

FO-073 adds no backend model or schema change, migration, Python dependency,
frontend dependency, or lockfile change. `frontend/package.json` changes only
register its helper test. Existing lifecycle fields, routes, shared components,
and installed frontend libraries are reused.

## 20. Manual acceptance status

User manual/browser acceptance was not performed and is not claimed. Automated
tests, static analysis, production build, backend integration tests, and
repository inspection are complete. Browser verification of all role variants,
responsive layouts, announcements, and cross-surface cache refresh remains a
FO-074 acceptance activity.

## 21. Known limitations

- The frontend lacks reliable explicit `system_admin` role evidence, so
  global-only Tenant controls fail closed and use the API administration
  workflow.
- Search is deferred because no confirmed server search contract exists;
  client-only paginated search is intentionally not implemented.
- Automated frontend coverage remains helper-level; no component, integration,
  or browser harness exists.
- No cross-tab realtime refresh is implemented.
- Import/export, bulk lifecycle actions, lifecycle history, notifications, and
  identifier reuse remain out of scope.
- PostgreSQL may abort one highly contended hierarchy transaction as a
  deadlock victim; the backend rolls it back and callers may retry.

## 22. FO-074 boundary

FO-074 is the cumulative Master Data QA and stabilization task. It owns
final cross-module regression assessment, unresolved defect correction if
validation finds a product issue, browser/manual acceptance completion, and
the cumulative release recommendation. FO-073 does not absorb FO-074.

FO-071 and FO-072 are complete and independently approved per user governance.
FO-073 is complete; it is not independently approved and no user manual
acceptance is claimed. FO-074 is in progress. FO-063 remains reserved and
deferred.

## 23. PR status

FO-073 continues on `feature/master-data-management` in cumulative PR #40.
PR #40 remains open, draft, unmerged, and based on `main`. No merge readiness
or approval is claimed by this reconciliation. The validated implementation,
tests, and documentation were committed at `cc32d75`. This minimal follow-up
records that delivery reference. FO-074 final QA follows in the same draft PR.

## 24. FO-074 cumulative QA status

FO-074 completed cumulative QA and corrected confirmed cache isolation,
pagination, Tenant-create visibility, malformed-input, User concurrency,
dependent invalidation, and accessibility defects without redesigning the
FO-073 lifecycle contract. Final cumulative validation passes at Master Data
78, Accounts + Access Control 112, full backend 590, and frontend 225 plus
lint, TypeScript, production build, system check, and migration drift gates.
Manual browser acceptance and Sol's independent cumulative final review remain
pending. PR #40 remains open, draft, and unmerged.
