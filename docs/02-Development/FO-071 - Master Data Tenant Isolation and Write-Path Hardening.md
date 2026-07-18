# FO-071 - Master Data Tenant Isolation and Write-Path Hardening

## 1. Objective

Correct the confirmed Critical multi-tenant isolation defects in the existing
Master Data APIs. FO-071 adds backend-authoritative read scope, write-path
tenant binding, cross-tenant relationship rejection, and focused regression
coverage without changing endpoint paths or frontend payload contracts.

## 2. Confirmed defects and severity

- **MD-1 — Critical:** all Master Data ViewSets used global querysets.
- **MD-2 — Critical:** writable client tenant and relationship UUIDs were not
  bound to the authenticated actor's scope.
- **MD-3 — High (FO-071 portion):** hierarchy relationships could cross tenant
  or disagree with their selected parent.
- **MD-4 — High (deferred):** hard DELETE conflicts with existing soft-delete
  fields; complete lifecycle work belongs to FO-072.

## 3. Previous unsafe behavior

`MasterDataPermissionMixin.get_queryset()` applied optional client filters to
unscoped model querysets. A tenant-bound account with `settings.view` or
`settings.manage` could read or mutate another tenant's rows, and serializers
accepted arbitrary tenant and relationship UUIDs.

## 4. Global-scope contract

Global Master Data scope is limited to:

- active authenticated superusers; or
- active authenticated users with an active `system_admin` role assignment.

`is_staff`, `settings.view`, and `settings.manage` alone do not grant global
scope. Global administrators can read across tenants, explicitly select a
tenant for child records, and use related rows only when all relationships are
internally tenant-consistent.

## 5. Tenant-bound contract

- Tenant endpoints expose only the actor's own Tenant row.
- Child endpoints expose only rows matching `request.user.tenant_id`.
- Cross-tenant detail, update, and delete resolve as generic 404.
- Child creates are bound to the actor tenant.
- An omitted tenant is filled from the actor; the existing same-tenant UUID
  payload remains accepted; a different tenant UUID is rejected.
- Partial updates cannot reassign a row to another tenant.
- Tenant-bound users may update their own Tenant, but cannot create or delete
  Tenant records.

Inactive records remain visible as before. Rows already marked
`is_deleted=True` are excluded from all Master Data API querysets and related
field choices.

## 6. Tenantless fail-closed contract

Non-global tenantless accounts receive empty lists and generic 404 detail
responses. Mutation attempts are rejected by object scope or serializer field
validation; no global records or relationship choices are exposed.

## 7. Queryset-scoping architecture

`apps.master_data.tenant_scope` provides:

- `has_global_master_data_scope`
- `scope_master_data_queryset`
- `scope_tenant_queryset`
- `require_global_master_data_scope`

The ViewSet mixin applies authoritative scope before optional query filters.
This keeps filters from broadening scope and avoids reverse dependencies on
Dashboard or Reporting helpers.

## 8. Write-path binding

`TenantBoundMasterDataSerializer`:

- scopes all writable relationship querysets to eligible non-deleted rows;
- injects the actor tenant on tenant-bound creates when omitted;
- preserves same-tenant frontend payload compatibility;
- prevents tenant reassignment on update;
- requires explicit tenant selection for global child creates.

## 9. Entity relationship validation

- Organization: authoritative tenant.
- Department: organization must match tenant.
- Building: organization must match tenant.
- Floor: building must match tenant.
- Area: building and floor match tenant; floor belongs to building.
- AssetType: authoritative tenant.
- Asset: organization, building, floor, area, and asset type match tenant;
  building belongs to organization; floor belongs to building; area belongs to
  building and selected floor.

The same checks apply to global administrators, preventing internally
inconsistent cross-tenant hierarchies.

## 10. Permission behavior

- Read: `IsAuthenticated` + `settings.view`.
- Mutation: `IsAuthenticated` + `settings.manage`.
- Unauthenticated requests return 401.
- Missing permissions return 403.
- Permission success does not bypass tenant object scope.
- No new permission codes or seed changes.

## 11. API compatibility

Endpoint paths, serializers' public fields, pagination, filtering, and primary
response shapes are unchanged. Existing tenant-bound create forms may continue
submitting their own tenant UUID. Business-module selectors now receive the
correct same-tenant option set.

## 12. Delete behavior and FO-072 boundary

FO-071 scopes all deletes. Cross-tenant delete returns 404. Tenant deletion is
global-administrator-only. Existing same-tenant child hard DELETE remains
available under `settings.manage`; it was not expanded.

The full soft-delete / restore contract, dependency protection, audit metadata,
and replacement of same-tenant hard DELETE are explicitly deferred to FO-072.

## 13. Tests added

Master Data tests increased from 19 to 48 (+29), covering:

- authentication and read/write permission separation;
- all eight entity list scopes;
- tenantless fail-closed behavior;
- staff, superuser, active/inactive `system_admin` scope;
- cross-tenant detail/update/delete;
- tenant create/update/delete rules;
- authoritative create/update tenant binding;
- query-filter non-broadening and soft-deleted exclusion;
- cross-tenant and internally inconsistent relationships;
- valid same-tenant and global-admin creates;
- rejected-write non-mutation;
- bounded list query behavior.

## 14. Validation results

| Check | Result |
| --- | --- |
| Master Data | 48 OK |
| Accounts + Access Control | 109 OK |
| Dashboard | 17 OK |
| Reporting | 86 OK |
| FM Tickets + Maintenance + Inspection | 212 OK |
| Notifications | 78 OK |
| Full backend `--parallel 4` | 557 OK, exit 0 |
| `manage.py check` | Clean |
| `makemigrations --check --dry-run` | No changes detected |
| `showmigrations master_data` | `[X] 0001_initial` |
| Frontend helper tests | 202 OK |
| ESLint / TypeScript / production build | Passed |

The first two parallel full-suite attempts encountered stale PostgreSQL test
database infrastructure state (locked clone, then template recreation race).
No product test failed. A subsequent clean canonical run passed all 557 tests.

## 15. Migration / dependency confirmation

- No migration or model change.
- No dependency addition or package version change.
- Existing Master Data migration history remains `0001_initial`.

## 16. Known limitations

- Same-tenant child DELETE still performs the historical hard delete.
- Audit UUID fields are not populated and no history endpoint exists.
- Existing broad `settings.*` permissions are preserved.
- Frontend Master Data screens still have no dedicated helper test file.

## 17. Deferred scope

- FO-072: soft-delete, deactivation lifecycle, dependency protection, and
  remaining hierarchy lifecycle behavior.
- FO-073: frontend alignment.
- FO-074: cumulative QA and stabilization.
- Import/export, bulk actions, charts, AI, and FO-063 remain deferred.

## 18. Branch and PR status

- Branch: `feature/master-data-management`
- Cumulative PR #40: `feature/master-data-management` → `main`
- FO-071 is complete and independently approved.
- FO-072 is complete after required validation and awaits independent review.
- FO-073 and FO-074 are pending and have not started.
- PR #40 remains open, draft, and unmerged.

## Implementation commit

`f968756a5a6e2465398115be4448a1d64d088c4e`

## Independent approval

FO-071 was independently reviewed and approved by Sol on 2026-07-18 at commit `6721ff0ff84d55ae5aaa0bb875b0cdc03ebbc9ec`. The approval was recorded in the external project collaboration session rather than as a GitHub review.

## FO-072 reconciliation note

FO-072 completes the lifecycle work deferred above. Public Master Data DELETE
now performs protected soft deletion; scoped restore actions, dependency
conflicts, audit updates, and active-hierarchy validation are implemented
without changing FO-071 tenant scope or `settings.view` / `settings.manage`.
FO-071 remains complete and independently approved; FO-072 does not widen
global access or alter its backend-authoritative write-path contract. This
approval applies only to FO-071 and does not constitute approval of FO-072.
