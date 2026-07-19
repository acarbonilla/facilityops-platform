# FO-074 - Master Data Management QA and Stabilization

## 1. Objective

Perform final cumulative QA for FO-071 through FO-073, correct only confirmed
security, lifecycle, hierarchy, API, frontend, cache, accessibility, and
concurrency defects, and prepare Master Data Management for Sol's independent
cumulative review.

## 2. Preflight

- Branch: `feature/master-data-management`.
- Starting local and remote HEAD:
  `b27cb7ded5934fc750badef24d2a03fe6b066014`.
- Working tree was clean and no commit followed the expected starting HEAD.
- FO-071 `6721ff0f`, FO-072 `a8ea8620`, FO-073 `cc32d75d`, and the
  FO-073 reconciliation `b27cb7de` were all ancestors.
- PR #40 was open, draft, mergeable, unmerged, based on `main`, and headed by
  `feature/master-data-management`.
- No generated Next.js drift, migration, dependency, lockfile, secret, or
  unrelated feature change was present.
- FO-074 had not started.

## 3. Cumulative review boundary

The review covered all eight Master Data resources, Accounts/User hierarchy
integration, tenant and global scope, ordinary and deleted APIs, lifecycle
transactions, frontend administration and aliases, forms, pagination, caches,
accessibility, FO-010 and FO-071 through FO-073 documentation, project
trackers, and PR #40.

## 4. Executive QA outcome

Security review found no exploitable cross-tenant or privilege-escalation path
in the established backend scope. Cumulative QA confirmed eight stabilization
defects. Each correction is minimal, preserves the approved domain contract,
and has focused regression coverage. No schema, endpoint, permission, or
dependency redesign was required. FO-074B and FO-074C corrected the follow-up
Boolean filter and Staff/RBAC defects. FO-074D records the passed manual
acceptance and final cumulative validation.

## 5. Confirmed defects and corrections

1. **High - cross-session frontend cache isolation.** The persistent Query
   Client retained fresh unscoped data after logout/account switching.
   Authentication transitions now cancel and clear all query caches.
2. **High - concurrent User mutation integrity.** User update and deactivation
   accepted stale model instances without locking the target row. Both services
   now re-fetch the User with `select_for_update`; metadata-only updates no
   longer lock unrelated Tenant/Organization rows.
3. **Medium - malformed restore identifiers.** Invalid UUIDs reached lifecycle
   row lookup and raised Django validation exceptions. Lifecycle lookup now
   converts malformed identifiers to generic 404.
4. **Medium - malformed collection filters.** Invalid UUID/Boolean filter values
   could raise server errors. Allow-listed filters now return field-scoped 400.
5. **Medium - incomplete Admin Organization hierarchy.** The screen loaded only
   the first 100 rows and derived counts from that page. It now follows backend
   pagination for every hierarchy resource.
6. **Medium - Tenant-create visibility.** Admin Organization exposed Tenant
   creation to any `settings.manage` actor. Shared fail-closed creation policy
   now withholds Tenant creation without reliable global-role evidence.
7. **Medium - incomplete dependent-cache invalidation.** Master Data mutations
   did not explicitly refresh FM Ticket caches. The FM Ticket prefix is now
   invalidated with existing dependent consumers.
8. **Medium/Low - form and lifecycle selector semantics.** Field descriptions
   and errors lacked control associations, and visual lifecycle tabs used
   incomplete ARIA tab semantics. Controls now receive `aria-describedby`,
   `aria-invalid`, and alert errors; lifecycle selectors use an accessible
   pressed-button group.

## 6. Exact files changed

### Production and tests

- `backend/apps/accounts/services.py`
- `backend/apps/accounts/tests.py`
- `backend/apps/master_data/lifecycle.py`
- `backend/apps/master_data/services.py`
- `backend/apps/master_data/tests.py`
- `frontend/components/common/form-field.tsx`
- `frontend/components/common/select-field.tsx`
- `frontend/components/master-data/master-data-lifecycle-screen.tsx`
- `frontend/components/providers/auth-provider.tsx`
- `frontend/features/admin/organization/components/organization-management-screen.tsx`
- `frontend/features/master-data/components/master-data-form-pages.tsx`
- `frontend/features/master-data/components/shared.tsx`
- `frontend/lib/auth/session-cache.test.ts`
- `frontend/lib/auth/session-cache.ts`
- `frontend/lib/master-data/lifecycle.test.ts`
- `frontend/lib/master-data/lifecycle.ts`
- `frontend/package.json`

### Documentation

- `docs/02-Development/FO-010-Master-Data-Foundation.md`
- `docs/02-Development/FO-071 - Master Data Tenant Isolation and Write-Path Hardening.md`
- `docs/02-Development/FO-072 - Master Data Soft Delete Deactivation Lifecycle and Hierarchy Integrity.md`
- `docs/02-Development/FO-073 - Master Data Frontend Lifecycle and Administrative UX Alignment.md`
- `docs/02-Development/FO-074 - Master Data Management QA and Stabilization.md`
- `docs/development/project-status.md`
- `docs/development/progress-map.md`
- `docs/development/work-tree.md`

## 7. Security and tenant-isolation findings

- Tenant users remain scoped by authoritative backend querysets.
- Tenantless non-global users fail closed.
- Only active superusers and active `system_admin` assignments receive global
  scope; `is_staff` alone remains tenant-scoped.
- Submitted Tenant UUIDs cannot broaden write scope.
- Cross-tenant detail, update, delete, restore, and lifecycle access remains
  generic 404.
- Deleted discovery reuses the same tenant/global lifecycle scope.
- `settings.view` protects reads and `settings.manage` protects mutations.
- Tenant create/delete/restore/reactivate remain backend global-only.
- Frontend permission state remains advisory and fails closed during loading or
  errors.

## 8. Lifecycle findings

Active rows expose Edit, Deactivate, and Soft delete; inactive rows expose Edit,
Reactivate, and Soft delete; deleted rows expose Restore only. DELETE remains
non-cascading soft deletion, clears ordinary visibility, sets inactive/deletion
audit state, and reserves identifiers. Restore clears deletion metadata but
returns inactive. Dependency and hierarchy failures return readable conflicts
without partial mutation.

## 9. Hierarchy findings

All child serializers enforce same-Tenant and compatible Organization,
Building, Floor, Area, and Asset relationships. Active records and Users
require active, non-deleted parents. Parent locks protect create, reassignment,
reactivation, restoration, and lifecycle races.

## 10. Accounts/User integration findings

User tenant/organization assignment remains backend-scoped and hierarchy
validated. Active User creation, reassignment, and reactivation lock and
revalidate their Master Data parents. FO-074 adds target User locking so
concurrent metadata/lifecycle updates cannot overwrite committed fields.

## 11. API and pagination findings

Ordinary CRUD, UUIDs, fields, permissions, filtering, pagination, deleted
discovery, restore, and HTTP 204 DELETE compatibility remain intact. Unsafe
`include_deleted` remains ignored. Malformed path/filter values now fail with
404/400 rather than server errors. Deleted discovery remains paginated and
Admin Organization follows all API pages.

## 12. Performance and query findings

Querysets scope before evaluation and retain existing `select_related`
coverage. No confirmed N+1, unbounded backend response, unnecessary global
query, or over-broad lifecycle lock remains. Metadata-only User updates no
longer lock Master Data parents.

## 13. Frontend UX findings

All eight lifecycle screens continue using API pagination, separate states,
last-row page recovery, contained 400/409 errors, retry and distinct empty
states, deterministic success announcements, and the shared Admin Assets
screen. Admin Organization now hydrates complete paginated hierarchy data and
withholds Tenant create without reliable global-role evidence.

## 14. Cache-invalidation findings

Mutations refresh Master Data lists/details/options, Dashboard, Reporting,
Users, FM Tickets, Maintenance, and Inspection. Query keys remain stable and
Master Data option/lifecycle caches remain session-scoped. Authentication
transitions cancel and clear all cached tenant data.

## 15. Accessibility and responsive findings

The feature retains one page heading, labelled controls, textual lifecycle
state, keyboard actions, modal naming, focus trap/restore, safe Escape handling,
status/alert semantics, responsive wrapping, scroll-contained tables, and
viewport-constrained dialogs. FO-074 adds explicit field-description/error
associations and removes incomplete tab-role semantics.

## 16. Tests added or updated

- One Master Data regression covers malformed detail/restore UUIDs and invalid
  UUID/Boolean collection filters.
- One Accounts concurrency regression proves a concurrent User update preserves
  independently committed fields.
- One frontend regression proves authenticated-session cache clearing.
- Master Data helpers now cover complete page hydration, Tenant create policy,
  FM Ticket invalidation, and field accessibility properties.

Focused correction tests passed before the final gate.

## 17. Final backend validation

- `python manage.py test apps.master_data --noinput`: 78 passed, exit 0.
- `python manage.py test apps.accounts apps.access_control --noinput`: 112
  passed, exit 0.
- `python manage.py test apps.dashboard --noinput`: 17 passed, exit 0.
- `python manage.py test apps.reporting --noinput`: 86 passed, exit 0.
- `python manage.py test apps.fm_tickets apps.maintenance apps.inspection
  --noinput`: 212 passed, exit 0.
- `python manage.py test apps.notifications --noinput`: 78 passed, exit 0.
- `python manage.py test --parallel 4 --noinput`: 590 passed, exit 0.
- `python manage.py check`: no issues, exit 0.
- `python manage.py makemigrations --check --dry-run`: no changes, exit 0.
- `python manage.py showmigrations master_data`: `[X] 0001_initial`, exit 0.

No stale PostgreSQL test-database incident occurred during the final gate.

FO-074D subsequently ran the required cumulative backend gate once:

- `python manage.py test --parallel 4 --noinput`: 593 passed, exit 0.
- `python manage.py check`: no issues, exit 0.
- `python manage.py makemigrations --check --dry-run`: no changes, exit 0.
- `python manage.py showmigrations master_data`: `[X] 0001_initial`, exit 0.

No stale test-database incident or product failure occurred, and no focused
backend rerun was required.

## 18. Final frontend validation

- `npm test`: 225 passed, exit 0.
- `npm run lint`: passed, exit 0.
- `npx tsc --noEmit`: passed, exit 0.
- `npm run build`: passed, exit 0; all 52 application routes compiled.
- Mechanical `next-env.d.ts` and `tsconfig.json` build drift was inspected and
  restored; no generated build artifact is included.

## 19. Migration and dependency confirmation

No model or schema change is present. No migration, Python package, frontend
dependency, or lockfile change is required. `frontend/package.json` changes
only register the new helper test.

## 20. Manual acceptance status and checklist

User manual acceptance passed on 2026-07-19 using `doejane@gmail.com`, an
active, non-Staff, non-superuser Facility Manager account. User-supplied
screenshot evidence was provided.

The user confirmed Dashboard, FM Ticketing, Maintenance, read-only 5S
Inspection, Reporting, and tenant-scoped Master Data visibility. Master Data
mutation controls and administrative Users/Roles/Permissions were absent.
Active, Inactive, and Deleted filters and tenant isolation worked;
unauthorized mutation was rejected; the Staff flag was not required; and no
runtime overlay appeared.

## 21. Deferred scope

Server search, import/export, bulk lifecycle actions, lifecycle history,
cross-tab realtime synchronization, component/browser automation, and
identifier reuse remain deferred. FO-063 remains reserved for automatic FM
Ticket closure and is not implemented here.

## 22. Documentation reconciliation

FO-010 and milestone limitations/statuses are labelled as delivery snapshots.
FO-071 and FO-072 remain independently approved. FO-073 remains complete and
is included in Sol's approved cumulative state. FO-074 through FO-074E are
complete, including the FO-074B Boolean correction and FO-074C Staff/RBAC
correction. User manual acceptance passed on 2026-07-19. Master Data Management
is complete on the branch, and FO-075 has not started.

## 23. Commit and PR state

The validated implementation, tests, and documentation were committed at
`7bd06a396f668df4cff76c0eb326e065a2619d41`. PR #40 remains open, draft,
unmerged, and based on `main`. FO-074B is implemented at `195686c`. FO-074C
implementation, seed reconciliation, and affected-suite validation are
complete; its delivery SHA is recorded in the FO-074C document and PR update.
FO-074D records the final 593-test backend gate and passed user manual
acceptance. FO-074E records Sol's independent cumulative **APPROVED** review at
approved production HEAD `b5532d4c0d4c29be18f6a5aa2e90d363edad5750`
and final reviewed feature HEAD
`0173ccca3ab810659fee94a8ee7b4cf9e4a5d56f`. PR #40 remains open, draft,
and unmerged for the user's ready-for-review and normal merge-commit action.

## 24. Final review gate

FO-074E records Sol's independent cumulative **APPROVED** review. The approved
state includes FO-071 through FO-074E, including FO-074B and FO-074C. The
backend baseline is 593 tests and the frontend baseline is 227 tests plus
passed ESLint, TypeScript, and production build. Manual acceptance passed on
2026-07-19. FO-063 remains reserved/deferred. FO-075 has not started, and
Employee Requester Experience remains next.
