# FO-068 - Foundation Dashboard Tenant Isolation Backend Correction

## 1. Objective

Correct the confirmed High-severity Foundation Dashboard tenant-isolation defect while preserving the existing authenticated post-login Dashboard contract and response shape.

FO-068 is the backend security foundation of the complete Dashboard and Executive Operational Overview feature on `feature/dashboard-operational-overview`.

## 2. Preflight

- Starting branch: `main` at `dfd3a4457e54dd702171482217ef6f22194d7941`
- Working tree clean
- PR #38 merged; `feature/reporting` absent
- Feature branch created: `feature/dashboard-operational-overview`
- FO-068 was not previously implemented

## 3. Confirmed Security Defect and Severity

**Severity: High**

`GET /api/dashboard/foundation-summary/` counted all non-deleted Master Data rows globally for any authenticated user. `request.user` was unused. Tenant-bound and tenantless non-global users received platform-wide aggregate inventory volumes. Row-level records and PII were not exposed.

## 4. Root Cause

FO-017 implemented `get_active_count(model)` as an unscoped `model.objects.filter(is_deleted=False).count()` under `IsAuthenticated` only, with no tenant-scope helper and no isolation tests.

## 5. Final Access Contract

Preserved:

- `IsAuthenticated`
- Auth-only Dashboard route / post-login availability
- No `dashboard.view`
- No `reporting.view` requirement
- No client-supplied tenant selector

## 6. Tenant-Scope Matrix

| User type | Scope |
| --- | --- |
| Tenant-bound normal user | Same tenant only |
| Tenant-bound facility manager | Same tenant only |
| Tenant-bound viewer | Same tenant only |
| Tenantless non-global user | Zero numeric counts |
| Active `system_admin` | Approved global counts |
| Superuser | Approved global counts |

## 7. Global-User Contract

Global scope uses the established repository definition:

- `user.is_superuser`, or
- active assigned role with code `system_admin` via `get_user_roles` (active role + active assignment)

Ordinary `is_staff` does not grant global scope. Inactive roles or inactive assignments do not grant global scope.

## 8. Metric Contract

Response keys unchanged:

`tenants`, `organizations`, `departments`, `buildings`, `floors`, `areas`, `asset_types`, `assets`, `service`

Eligibility unchanged from FO-017: `is_deleted=False` only (no `is_active=True` in FO-068).

- Tenant-bound: `tenants` is own non-deleted tenant (normally 0/1); other metrics match `user.tenant_id`
- Tenantless non-global: all numeric metrics `0`; `service` unchanged
- Global actors: all non-deleted rows; `service` unchanged

## 9. Service Architecture

Dashboard-local helpers (independent of Reporting aggregation):

- `tenant_scope.py` — `has_global_dashboard_scope`, `scope_master_data_to_user`, `scope_tenants_to_user`
- `services.py` — `build_foundation_summary(user)`
- Thin `FoundationSummaryView` calls the service and returns the existing serializer contract

## 10. Tests Added

`FoundationSummaryApiTests` expanded to cover authentication, same-tenant isolation, cross-tenant exclusion, facility manager/viewer, tenantless zeros, superuser/system_admin global scope, inactive role/assignment denial, ordinary staff non-global, soft-delete exclusion, response-key compatibility, service string, bounded queries, and ignored tenant query params.

## 11. Validation Results

| Check | Result |
| --- | --- |
| Focused Dashboard suite | 17 OK |
| Accounts + Access Control | 109 OK |
| Master Data | 19 OK |
| Reporting | 86 OK |
| Full parallel suite | 528 OK |
| `manage.py check` | Clean |
| `makemigrations --check --dry-run` | No changes detected |

Baseline Dashboard 2 → 17 (+15). Full backend 513 → 528 (+15).

## 12. Migration / Dependency Confirmation

- No migration
- No model changes
- No permission seed changes
- No dependency additions

## 13. Deferred FO-069 Frontend Scope

FO-069 handles Dashboard scope copy, Reporting navigation, and frontend UX alignment. FO-068 intentionally left frontend production code unchanged. FO-069 is complete on the same cumulative branch; see `FO-069 - Dashboard Scope UX and Reporting Navigation Alignment.md`.

## 14. Feature / PR State

- Branch: `feature/dashboard-operational-overview`
- Cumulative draft PR #39 remains OPEN, draft, unmerged
- FO-069 and FO-069A complete on branch; FO-070 cumulative QA complete with no additional backend production corrections

## Commit SHA

`f591357d36c2397c48a5a0cfbd50d2f812f6ca35`