# FO-072 - Master Data Soft Delete, Deactivation Lifecycle, and Hierarchy Integrity

## 1. Objective

Replace the remaining public Master Data hard-delete behavior with protected
soft deletion and explicit restoration, distinguish inactive records from
deleted records, and enforce lifecycle-aware hierarchy integrity while
preserving FO-071 tenant isolation.

## 2. Previous hard-delete risk

All eight Master Data ViewSets inherited `ModelViewSet` hard deletion. The
models already carried soft-delete and audit fields, but same-tenant DELETE
physically removed rows or invoked database cascade/protection behavior. This
put hierarchy continuity and historical foreign-key references at risk.

## 3. Lifecycle state definitions

- Active: `is_active=True`, `is_deleted=False`; eligible for active hierarchy
  relationships and established operational selectors.
- Inactive: `is_active=False`, `is_deleted=False`; visible in authorized
  administrative APIs, unavailable as a parent of a newly active or
  reactivated record, and editable for repair.
- Deleted: `is_deleted=True` and forced `is_active=False`; hidden from normal
  Master Data reads and relationship choices, retained in the database, and
  accessible only to the scoped restore workflow.

## 4. Soft-delete contract

Existing detail DELETE routes retain HTTP 204 success behavior. The
authoritative lifecycle service atomically locks the row, checks explicit
dependencies, sets `is_deleted=True`, sets `is_active=False`, and records
`deleted_at`, `deleted_by`, and `updated_by`. It never calls model deletion.

Normal list/detail querysets continue filtering `is_deleted=False`. Repeated
DELETE and ordinary detail access for a deleted UUID return generic 404.
There is no `include_deleted` list option and no cascade delete.

## 5. Restore endpoint contract

Each resource exposes:

`POST /api/master-data/{resource}/{uuid}/restore/`

The endpoint requires `settings.manage`, returns HTTP 200 with the existing
resource serializer, uses an FO-071-scoped lifecycle queryset, and atomically
locks the row. It clears deletion-specific fields and keeps
`is_active=False`. Restoring a non-deleted row returns structured HTTP 409.
No parent, child, identifier, or active state is changed automatically.

## 6. Deactivation and reactivation contract

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

## 7. Dependency graph

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

## 8. Restore hierarchy validation

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

## 9. Tenant-isolation behavior

FO-071 remains authoritative. Active superusers and users with an active
`system_admin` assignment have global scope. Other actors are restricted to
their own tenant; tenantless non-global actors fail closed; `is_staff` alone
does not widen scope. Restore lookup uses dedicated lifecycle scope helpers
rather than an unscoped model lookup.

## 10. Permission behavior

- List/detail: authenticated actor with `settings.view`.
- Create/update/delete/restore: authenticated actor with `settings.manage`.
- Permission success never bypasses tenant scope.
- Tenant create, delete, restore, and reactivation remain global-only.
- Tenant-bound administrators retain FO-071 permission to update harmless
  metadata and deactivate their own Tenant when dependency rules permit.

## 11. Audit-field behavior

The existing UUID audit fields are used without schema changes. Create records
receive `created_by` and `updated_by`; updates receive `updated_by`; soft
deletion records `deleted_at`, `deleted_by`, and `updated_by`; restoration
clears `deleted_at`/`deleted_by` and refreshes `updated_by`. Creation history
is retained. No audit-history table or lifecycle notification event was added.

## 12. Uniqueness policy

Existing unconditional database uniqueness remains authoritative. Deleted
rows retain and reserve their codes and identifiers. Create cannot reuse a
unique tenant/parent code combination, and restore never renames or
regenerates an identifier. No partial unique index or migration was added.

## 13. API compatibility

Existing list/detail/create/update/delete paths, pagination, filtering,
serializer response fields, permissions, and frontend DELETE success
expectations are unchanged. The only new public path is the restore action.
DELETE still returns HTTP 204 but now retains the row.

## 14. Tests added

Master Data lifecycle regressions cover all eight soft-delete and restore
routes; audit metadata; hidden deleted rows; repeated DELETE; permissions and
tenant scope; Tenant global restrictions; lifecycle conflicts; hierarchy
restore failures; active/inactive transitions; dependency graphs; no cascade;
deleted-child handling; active-parent validation; inactive repair; identifier
reservation; and bounded Tenant dependency queries.

## 15. Validation results

- Master Data: 68 tests passed, exit 0.
- Accounts + Access Control: 109 tests passed, exit 0.
- Dashboard: 17 tests passed, exit 0.
- Reporting: 86 tests passed, exit 0.
- FM Tickets + Maintenance + Inspection: 212 tests passed, exit 0.
- Notifications: 78 tests passed, exit 0.
- Full backend parallel suite: 577 tests passed, exit 0.
- Django system check: no issues.
- Migration drift: no changes detected.
- Master Data migration history: `[X] 0001_initial`.
- Frontend: 202 tests passed; ESLint, TypeScript, and production build passed.

The first focused lifecycle run exposed PostgreSQL rejecting `FOR UPDATE`
across Asset's nullable `floor`/`area` outer joins. The lock was narrowed to
the authoritative Master Data row (`FOR UPDATE OF self`); the canonical
68-test Master Data rerun and 577-test full suite then passed. This was an
implementation correction, not stale test-database infrastructure.

## 16. Migration and dependency confirmation

The existing `BaseModel` already provides all required lifecycle/audit fields.
No model change, migration, dependency, package, or lockfile change is
required.

## 17. Frontend limitations

No frontend production file changes are part of FO-072. Existing delete
consumers remain compatible with HTTP 204, but no restore control, lifecycle
state explanation, or dependency-conflict UX is added until FO-073.
Highly contended concurrent hierarchy writes may be transactionally rolled
back by PostgreSQL deadlock resolution and should be retried by the caller;
the rollback does not leave a partial lifecycle mutation.

## 18. Deferred scope

- FO-073: Master Data frontend lifecycle alignment.
- FO-074: cumulative Master Data QA and stabilization.
- Import/export, bulk lifecycle actions, lifecycle notifications, and partial
  unique indexes remain out of scope.
- FO-063 remains reserved and deferred.

## 19. PR status

FO-072 continues on `feature/master-data-management` in cumulative draft PR
#40. The PR remains open, draft, unmerged, and based on `main`.
