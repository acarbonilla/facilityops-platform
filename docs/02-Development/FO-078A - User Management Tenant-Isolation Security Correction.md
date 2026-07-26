# FO-078A - User Management Tenant-Isolation Security Correction

## Status

Repository correction and automated validation complete on
`feature/employee-requester`. User manual browser retest **Passed** on
**2026-07-26** for `doejane@gmail.com` (XYZ Company System Administrator;
Staff No; Superuser No; steps 1–21; skipped none; failures none). FO-078
manual acceptance also Passed on 2026-07-26. Final reconciliation is FO-078B.
Pull request #42 is Ready for review and remains unmerged pending explicit
merge authorization.

## Confirmed defect

| Field | Detail |
| --- | --- |
| Severity | **High** |
| Surface | User Management (`/admin/users` and `/api/users/`) |
| Account | Jane Doe (`doejane@gmail.com`) |
| Tenant | XYZ Company |
| Role | System Administrator |
| Staff | No |
| Superuser | No |
| Observed | Jane could list and reach users belonging to another Tenant |
| Expected | Jane may view and manage only users belonging to XYZ Company |

FO-078 manual acceptance: **Failed/paused** because of this confirmed
cross-Tenant personal and account data exposure.

## Root cause

`apps.accounts.services.has_global_user_scope()` treated any active
`system_admin` role assignment as platform-global User Management scope,
including Tenant-bound System Administrators.

`scope_users_to_actor()` therefore returned an unscoped `User` queryset for
Jane. Search, filters, sorting, pagination, detail UUID access, mutations, and
role assignment all operated on that global queryset.

`is_staff` alone was never the bypass. The defect was role-based global-user
scope for Tenant-bound System Administrators.

## Correction

### Backend User data scope

`has_global_user_scope()` now grants platform-global user visibility only to:

- active Django superusers
- active **tenantless** `system_admin` assignments (existing tested platform
  contract)

Tenant-bound System Administrators are tenant-scoped:

`target_user.tenant_id == request.user.tenant_id`

Scope is applied in `scope_users_to_actor()` before search, filtering, sorting,
pagination, and serialization. `UserViewSet.get_queryset()` continues to use
that helper for list, detail, directory, deactivate, and roles actions, so
cross-Tenant UUIDs return the standard generic `404`.

### Mutation hardening

- Create binds Tenant from the authenticated actor for non-global actors and
  ignores conflicting client Tenant values.
- Update rejects Tenant reassignment for non-global actors.
- `_lock_user()` reloads the target through the actor-scoped queryset; cross-
  Tenant service reloads fail closed.
- Cross-Tenant role assignment/removal continues to fail at scoped object
  resolution (`404`) with no partial assignment state.

### System-role assignment authority

User-data scope is separated from system-role assignment authority:

- `can_manage_system_roles()` allows active `system_admin` (Tenant-bound or
  tenantless) and superusers to assign system roles such as Employee **within
  their visible user scope**
- Non-`system_admin` tenant administrators still cannot assign system roles
- Role catalog mutations continue to require `has_global_user_scope()` and are
  therefore unavailable to Tenant-bound System Administrators

### Staff / Superuser

- `is_staff` alone grants neither User Management permissions nor global scope
- Superuser retains platform-global user visibility
- No new Platform Administrator role was introduced

## Affected endpoints and operations

| Method | Endpoint | Correction |
| --- | --- | --- |
| GET | `/api/users/` | Tenant-bound system_admin scoped |
| GET | `/api/users/directory/` | Same scoped queryset |
| GET | `/api/users/{id}/` | Cross-Tenant UUID → generic 404 |
| POST | `/api/users/` | Tenant forced from actor for non-global |
| PUT/PATCH | `/api/users/{id}/` | Scoped lookup; Tenant immutable for non-global |
| DELETE | `/api/users/{id}/` | Scoped deactivate |
| GET/PUT | `/api/users/{id}/roles/` | Scoped target; system roles allowed for system_admin within Tenant |

## Frontend reconciliation

- Tenant filter hidden for Tenant-bound administrators
- Organization filter options limited to the authenticated Tenant
- Role-assignment UI preserves system roles for active `system_admin` session
  roles so same-Tenant Employee assignment remains available
- Create/edit already forced Tenant from authenticated context for Tenant-bound
  users
- Session query-cache clearing on logout/account switch remains unchanged
- Backend remains authoritative; frontend is defense in depth only

## Regression coverage

Backend `TenantBoundSystemAdminUserIsolationTests`:

- Tenant-bound system_admin lists only same-Tenant users
- Search/filter/sort/pagination cannot expose other-Tenant users
- Same-Tenant detail succeeds; cross-Tenant and nonexistent UUID share generic
  404 shape
- Same-Tenant update succeeds; cross-Tenant update/deactivate/role assignment
  fail safely with unchanged database state
- Create binds authenticated Tenant and rejects cross-Tenant Organization
- Same-Tenant Employee assignment succeeds; cross-Tenant role assignment 404s
- Staff alone has no User Management or global scope

Frontend helper tests:

- Tenant-bound system_admin keeps system roles visible
- Tenant filter visibility and organization option scoping

## Validation

### Focused during correction

- Tenant-bound System Admin isolation + related accounts tests: **13 passed**
- `apps.accounts` + `apps.access_control`: **120 passed**
- Frontend focused user helper tests: passed
- ESLint: passed
- TypeScript (`tsc --noEmit`): passed

### Final gate

| Gate | Result |
| --- | --- |
| Full backend `--parallel 4 --noinput` | **661 passed** (exit 0) |
| Frontend complete tests | **267 passed** |
| ESLint | Passed |
| `tsc --noEmit` | Passed |
| Production build | Passed (exit 0) |
| Django check | Passed |
| `makemigrations --check --dry-run` | No changes |

### Test infrastructure note

The first full parallel run stalled after seeding with clone databases held in
`idle in transaction`. Confirmed stale backends were cleared and the suite was
retried once. The retry passed all 661 tests. This was test infrastructure, not
a product failure.

## Manual retest checklist (FO-078A)

**Result: Passed — 2026-07-26 (User-performed).** Codex did not perform browser
acceptance.

| Field | Value |
| --- | --- |
| Result | Passed |
| Acceptance date | 2026-07-26 |
| Account | `doejane@gmail.com` |
| Tenant | XYZ Company |
| Role | System Administrator |
| Staff | No |
| Superuser | No |
| Steps completed | 1–21 |
| Skipped items | None |
| Failures | None |
| Performed by | User |

1. Sign in as `doejane@gmail.com`.
2. Open Administration → User Management.
3. Confirm only XYZ Company users appear.
4. Search for the known other-Tenant user.
5. Confirm no result appears.
6. Apply every available user filter.
7. Confirm no other-Tenant user appears.
8. Open a known other-Tenant user UUID directly.
9. Confirm the normal safe not-found response.
10. Attempt any applicable cross-Tenant edit using a crafted/direct request.
11. Confirm the request fails and no data changes.
12. Create a user and confirm Tenant is derived as XYZ Company.
13. Confirm Organization choices belong only to XYZ Company.
14. Assign Employee to a same-Tenant test user.
15. Confirm the assignment succeeds.
16. Confirm Jane cannot assign a role to an other-Tenant user.
17. Sign in with a Staff-only account, if available.
18. Confirm Staff alone has no User Management or cross-Tenant bypass.
19. Switch between Tenant accounts.
20. Confirm cached users from the previous account do not remain visible.
21. Resume the remaining FO-078 Employee Requester checklist after FO-078A
    passes.

## Migration and dependency confirmation

No migrations and no new dependencies.

## Deferred / unchanged

- Attachments, comments, AI, broader requester self-service
- FO-079 and later tasks not started
- FO-063 remains reserved/deferred
- Master Data / Reporting / Dashboard global `system_admin` contracts outside
  User Management were not broadened or redesigned in this task

## Pull request

PR #42 Ready for review; remains unmerged. Final reconciliation: FO-078B.
