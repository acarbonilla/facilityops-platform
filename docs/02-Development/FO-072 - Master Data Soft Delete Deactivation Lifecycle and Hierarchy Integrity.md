# FO-072 - Master Data Soft Delete, Deactivation Lifecycle, and Hierarchy Integrity

## 1. Objective

Replace the remaining public Master Data hard-delete behavior with protected
soft deletion and explicit restoration, distinguish inactive records from
deleted records, and enforce lifecycle-aware hierarchy integrity while
preserving FO-071 tenant isolation.

## 2. Preflight state

- Branch: `feature/master-data-management`.
- FO-071 approved HEAD
  `6721ff0ff84d55ae5aaa0bb875b0cdc03ebbc9ec` is in branch history.
- FO-072 implementation commit:
  `f13ff0998df289231237cffcab16ff4bd858d1ea`.
- The branch was synchronized with
  `origin/feature/master-data-management` before reconciliation.
- The continuation working tree contained no unexplained or unrelated changes.
- PR #40 was open, draft, unmerged, based on `main`, and headed by
  `feature/master-data-management`.
- No FO-073 or FO-074 implementation was present.

## 3. Investigation findings matrix

The API, model, test, and implementation audits confirmed the public
hard-delete defect and validated the existing soft-delete fields, unconditional
uniqueness constraints, FO-071 scope helpers, serializer hierarchy contract,
and established endpoint shapes. The implementation audit then verified target
and parent locking and identified one remaining boundary defect: User
create/reassignment/reactivation did not participate in Master Data lifecycle
parent locking even though Users are declared Tenant/Organization dependencies.
That defect was corrected in the Accounts service and covered by sequential and
transaction-aware regressions.

Broader all-resource assertion matrices were evaluated as test-depth
enhancements rather than evidence of additional production defects. Existing
route matrices, focused contract assertions, and cumulative module suites cover
the current API contract. Expanded frontend lifecycle UX remains FO-073 scope.

| Finding | Severity | Resolution | Test |
| --- | --- | --- | --- |
| Public Master Data DELETE physically removed rows | High | Replaced with protected soft deletion | `test_delete_soft_deletes_leaf_and_hides_it`; all-eight route matrix |
| Stale target state could overwrite lifecycle mutation | High | Update and lifecycle paths lock the target row in one transaction | repeated DELETE/detail 404 and lifecycle transition regressions |
| Restore could race a parent lifecycle mutation | High | Restore locks target and persisted parents before hierarchy validation | restore hierarchy conflict and unchanged-state regressions |
| Master Data child create/reactivation could race parent deletion/deactivation | High | Create/update lock and revalidate every applicable parent before save | active-parent create/reactivation regressions |
| User dependency writes did not lock or lifecycle-validate Tenant/Organization | High | Accounts user create, reassignment, and reactivation now lock and validate Master Data parents | `test_user_writes_require_valid_master_data_hierarchy`; `test_concurrent_user_create_cannot_outlive_parent_deactivation` |
| Failed dependency validation needed complete lifecycle rollback evidence | Medium | Conflict assertions cover active/deleted and every supported audit field | `test_parent_deactivation_and_delete_report_dependencies` |
| Contended lock ordering may produce a PostgreSQL deadlock victim | Medium | Intentionally retained database deadlock resolution; failed transaction rolls back and caller may retry | cumulative PostgreSQL suites; documented limitation |

## 4. Confirmed defects and severities

All eight Master Data ViewSets inherited `ModelViewSet` hard deletion. The
models already carried soft-delete and audit fields, but same-tenant DELETE
physically removed rows or invoked database cascade/protection behavior. This
High-severity defect put hierarchy continuity and historical foreign-key
references at risk.

The race audit confirmed High-severity stale-target, parent-lifecycle, and User
dependency boundary risks. Target/parent locking already corrected the first
two; reconciliation corrected the User write boundary. The remaining
Medium-severity findings concern rollback evidence and a documented PostgreSQL
deadlock/retry limitation, not an uncorrected data-integrity path.

## 5. Lifecycle architecture

- Active: `is_active=True`, `is_deleted=False`; eligible for active hierarchy
  relationships and established operational selectors.
- Inactive: `is_active=False`, `is_deleted=False`; visible in authorized
  administrative APIs, unavailable as a parent of a newly active or
  reactivated record, and editable for repair.
- Deleted: `is_deleted=True` and forced `is_active=False`; hidden from normal
  Master Data reads and relationship choices, retained in the database, and
  accessible only to the scoped restore workflow.

Lifecycle mutations are centralized in `apps.master_data.lifecycle`. ViewSets
provide permission and tenant-scoped querysets; serializers bind tenant
ownership and lock hierarchy parents for Master Data writes. The Accounts user
service applies the same parent lock and lifecycle validation when writing User
dependencies.

## 6. Race-condition findings and correction

Target-only locking was insufficient because a new dependent could otherwise
be inserted after a parent dependency query. Master Data create, reparent, and
reactivation already lock their relevant parents inside atomic request
transactions. FO-072 reconciliation extends that invariant to User writes,
which closes the confirmed Tenant/Organization dependency gap.

PostgreSQL foreign-key checks alone are not treated as lifecycle validation:
soft-deleted rows still exist, and an FK can remain valid while its parent is
inactive. Explicit locked lifecycle checks therefore run before every affected
save. Opposing child/parent lock order can cause PostgreSQL to abort one
transaction as a deadlock victim under high contention; the aborted transaction
leaves no partial mutation and may be retried by the caller.

## 7. Atomicity and locking behavior

- Soft delete, restore, create, update, deactivation, reactivation, and affected
  User writes execute inside `transaction.atomic`.
- Lifecycle mutation re-fetches the target with `select_for_update(of=("self",))`.
- Update locks the scoped target before serializer validation.
- Dependency checks execute after the target lock and before lifecycle fields
  are mutated.
- Restore locks the target and all persisted parents, then validates refreshed
  parent lifecycle and hierarchy state.
- Master Data child and User dependency writes lock Tenant/Organization and
  other applicable parents before save, preventing a committed active child
  beneath an inactive/deleted parent.
- Validation failures roll back the transaction; no active/deleted or
  deletion/update audit-field mutation survives.
- Repeated delete and restore requests serialize to deterministic ordinary 404
  or structured 409 outcomes after the first successful mutation.

## 8. Soft-delete contract

Existing detail DELETE routes retain HTTP 204 success behavior. The
authoritative lifecycle service atomically locks the row, checks explicit
dependencies, sets `is_deleted=True`, sets `is_active=False`, and records
`deleted_at`, `deleted_by`, and `updated_by`. It never calls model deletion.

Normal list/detail querysets continue filtering `is_deleted=False`. Repeated
DELETE and ordinary detail access for a deleted UUID return generic 404.
There is no `include_deleted` list option and no cascade delete.

## 9. Restore contract

Each resource exposes:

`POST /api/master-data/{resource}/{uuid}/restore/`

The endpoint requires `settings.manage`, returns HTTP 200 with the existing
resource serializer, uses an FO-071-scoped lifecycle queryset, and atomically
locks the row. It clears deletion-specific fields and keeps
`is_active=False`. Restoring a non-deleted row returns structured HTTP 409.
No parent, child, identifier, or active state is changed automatically.

## 10. Deactivation/reactivation contract

PATCH/PUT with `is_active` remains the only activation workflow.
Deactivation does not set deletion metadata and is rejected with HTTP 409
when active, non-deleted dependents exist. Reactivation requires every
applicable parent to be active, non-deleted, same-tenant, and internally
consistent. Parent records are never changed automatically.

Inactive metadata edits remain available when a retained parent is inactive.
An inactive record may be created or repaired against an inactive parent, but
it cannot become active until the hierarchy is valid.

Create/update transactions lock applicable parents before persistence, and
update locks the target row. This prevents concurrent parent lifecycle changes
from admitting a new invalid child and prevents a stale PATCH from reviving a
soft-deleted row.

## 11. Dependency graph

The explicit Master Data dependency definitions are:

- Tenant: Organizations, Departments, Buildings, Floors, Areas, AssetTypes,
  Assets, and tenant-bound Users.
- Organization: Departments, Buildings, Assets, and organization-bound Users.
- Department: no confirmed Master Data child.
- Building: Floors, Areas, and Assets.
- Floor: Areas and Assets.
- Area: Assets.
- AssetType: Assets.
- Asset: hierarchy leaf.

Active/non-deleted dependents block deactivation. All non-deleted dependents
block soft deletion. Deleted dependents are ignored. Checks use exact reverse
relationships plus tenant filters and have a fixed query bound.

Ticket, Work Order, Inspection, Reporting, and Notification references are
historical/operational references rather than Master Data hierarchy children;
they do not broadly block soft deletion, and their foreign keys remain intact.

## 12. Restore hierarchy validation

Restore validates the persisted hierarchy without trusting request tenant
input:

- Organization and AssetType require an active, non-deleted Tenant.
- Department and Building additionally require a valid Organization.
- Floor requires a valid Building.
- Area requires valid Building and Floor records, with Floor belonging to
  Building.
- Asset requires valid Tenant, Organization, Building, and AssetType records;
  optional persisted Floor/Area records are validated when present. Building,
  Floor, and Area nesting must remain internally consistent.
- Tenant has no parent.

Failures return structured HTTP 409 errors and leave deletion state unchanged.
No inaccessible cross-tenant object is enumerated.
Restore refreshes and locks each persisted parent before validation.

## 13. Tenant-isolation behavior

FO-071 remains authoritative. Active superusers and users with an active
`system_admin` assignment have global scope. Other actors are restricted to
their own tenant; tenantless non-global actors fail closed; `is_staff` alone
does not widen scope. Restore lookup uses dedicated lifecycle scope helpers
rather than an unscoped model lookup.

## 14. Permission behavior

- List/detail: authenticated actor with `settings.view`.
- Create/update/delete/restore: authenticated actor with `settings.manage`.
- Permission success never bypasses tenant scope.
- Tenant create, delete, restore, and reactivation remain global-only.
- Tenant-bound administrators retain FO-071 permission to update harmless
  metadata and deactivate their own Tenant when dependency rules permit.

## 15. Audit-field behavior

The existing UUID audit fields are used without schema changes. Create records
receive `created_by` and `updated_by`; updates receive `updated_by`; soft
deletion records `deleted_at`, `deleted_by`, and `updated_by`; restoration
clears `deleted_at`/`deleted_by` and refreshes `updated_by`. Creation history
is retained. No audit-history table or lifecycle notification event was added.

## 16. Uniqueness policy

Existing unconditional database uniqueness remains authoritative. Deleted
rows retain and reserve their codes and identifiers. Create cannot reuse a
unique tenant/parent code combination, and restore never renames or
regenerates an identifier. No partial unique index or migration was added.

## 17. API compatibility

Existing list/detail/create/update/delete paths, pagination, filtering,
serializer response fields, permissions, and frontend DELETE success
expectations are unchanged. The only new public path is the restore action.
DELETE still returns HTTP 204 but now retains the row.

## 18. Tests added

Master Data lifecycle regressions cover all eight soft-delete and restore
routes; audit metadata; hidden deleted rows; repeated DELETE; permissions and
tenant scope; Tenant global restrictions; lifecycle conflicts; hierarchy
restore failures; active/inactive transitions; dependency graphs; no cascade;
deleted-child handling; active-parent validation; inactive repair; identifier
reservation; and bounded Tenant dependency queries.

Reconciliation adds Accounts coverage proving active users cannot be created or
reactivated under inactive parents, deleted parents cannot receive even
inactive users, and a concurrent user create cannot commit after its
Organization is deactivated. Dependency-conflict regressions also assert that
all lifecycle and audit fields remain unchanged.

## 19. Validation results and exit codes

- `python manage.py test apps.master_data --noinput`: 68 tests, OK, exit 0.
- `python manage.py test apps.accounts apps.access_control --noinput`: 111
  tests, OK, exit 0.
- `python manage.py test apps.dashboard --noinput`: 17 tests, OK, exit 0.
- `python manage.py test apps.reporting --noinput`: 86 tests, OK, exit 0.
- `python manage.py test apps.fm_tickets apps.maintenance apps.inspection --noinput`:
  212 tests, OK, exit 0.
- `python manage.py test apps.notifications --noinput`: 78 tests, OK, exit 0.
- `python manage.py test --parallel 4 --noinput`: 579 tests, OK, exit 0.
- `python manage.py check`: no issues, exit 0.
- `python manage.py makemigrations --check --dry-run`: no changes detected,
  exit 0.
- `python manage.py showmigrations master_data`: `[X] 0001_initial`, exit 0.

The first focused lifecycle run exposed PostgreSQL rejecting `FOR UPDATE`
across Asset's nullable `floor`/`area` outer joins. The lock was narrowed to
the authoritative Master Data row (`FOR UPDATE OF self`); the canonical
68-test Master Data rerun then passed. This was an implementation correction,
not stale test-database infrastructure.

The final Master Data command initially found the stale local
`test_facilityops_db`, removed only that test database, and then completed its
clean 68-test run with exit 0. The final 579-test canonical suite also completed
with exit 0. The initial database-creation message is recorded as local test
infrastructure state, not as a product-test failure.

## 20. Frontend validation

- `npm test`: 202 tests passed, exit 0.
- `npm run lint`: passed, exit 0.
- `npx tsc --noEmit`: passed, exit 0.
- `npm run build`: passed, exit 0.
- Build-generated `next-env.d.ts` and `tsconfig.json` changes were restored.
- No frontend production diff remains.

## 21. Migration and dependency confirmation

The existing `BaseModel` already provides all required lifecycle/audit fields.
No model change, migration, dependency, package, or lockfile change is
required.

## 22. Known limitations at FO-072 delivery

No frontend production file changes are part of FO-072. Existing delete
consumers remain compatible with HTTP 204, but no restore control, lifecycle
state explanation, or dependency-conflict UX is added until FO-073.
Highly contended concurrent hierarchy writes may be transactionally rolled
back by PostgreSQL deadlock resolution and should be retried by the caller;
the rollback does not leave a partial lifecycle mutation.

## 23. FO-073 boundary and deferred scope at FO-072 delivery

- FO-073: Master Data frontend lifecycle alignment — pending / not started.
- FO-074: cumulative Master Data QA and stabilization — pending / not started.
- Import/export, bulk lifecycle actions, lifecycle notifications, and partial
  unique indexes remain out of scope.
- FO-063 remains reserved and deferred.

## 24. Review status at FO-072 delivery

FO-072 is complete after all required validation passed and awaits Sol’s
independent review. No independent approval of FO-072 is claimed.

FO-071 was independently reviewed and approved by Sol on 2026-07-18 at commit
`6721ff0ff84d55ae5aaa0bb875b0cdc03ebbc9ec`. The approval was recorded in the
external project collaboration session rather than as a GitHub review. That
approval applies only to FO-071.

## 25. PR status at FO-072 delivery

FO-072 continues on `feature/master-data-management` in cumulative draft PR
#40. The PR remains open, draft, unmerged, and based on `main`.

## FO-073 reconciliation note

FO-073 adds authenticated, tenant-scoped, paginated deleted collection
discovery through `GET /api/master-data/{resource}/deleted/` so the frontend
can administer the FO-072 lifecycle. FO-072 added the restore action and
deleted-row lifecycle support, but its approved HEAD did not expose this
collection route or add an `include_deleted` option to ordinary collections.

Per user governance, FO-072 is complete and independently approved at final
HEAD `a8ea862`. FO-073 does not alter FO-072 backend lifecycle behavior or that
approval.

## FO-074 cumulative QA note

FO-074 revalidates soft deletion, restoration, deactivation/reactivation,
dependency protection, audit updates, hierarchy revalidation, transaction
locking, and identifier reservation across all eight resources. FO-072 remains
complete and independently approved at `a8ea862`; the final QA corrections do
not change its lifecycle contract.
