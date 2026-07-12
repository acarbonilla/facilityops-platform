# FO-049 - User Management Module QA & Stabilization

## Final decision

`READY_FOR_FINAL_REVIEW`

FO-045 through FO-048 were reviewed cumulatively against `main`. No critical, high, or medium implementation defect remains. One low-severity documentation defect was confirmed and corrected: repository trackers still described the pre-FO-045 placeholder, obsolete Inspection raw-UUID limitations, old branches/PRs, and stale test totals.

## Cumulative scope reviewed

- Tenant-scoped user CRUD, search, filters, ordering, pagination, activation, and non-destructive deactivation.
- Password validation, hashing, write-only handling, and response-field safety.
- Role-assignment reads and atomic replacement, inactive-assignment reuse, escalation controls, and current-session permission refresh.
- Least-privilege `users.directory`, seeded role grants, active/tenant scope, and safe response contract.
- Protected User Management routes, form scope preservation, action visibility, error handling, and query invalidation.
- Shared Inspection assignment pickers and preserved Maintenance role-aware candidates.
- Cumulative architecture, migrations, generated artifacts, debug code, stale comments, and documentation.

## Endpoint and permission matrix

| Method | Endpoint | Permission contract |
| ------ | -------- | ------------------- |
| GET | `/api/users/` | `users.view` |
| POST | `/api/users/` | `users.create` |
| GET | `/api/users/{id}/` | `users.view` |
| PUT/PATCH | `/api/users/{id}/` | `users.update` |
| DELETE | `/api/users/{id}/` | `users.delete` |
| GET | `/api/users/directory/` | `users.directory` |
| GET | `/api/users/{id}/roles/` | `users.view` and `roles.view` |
| PUT | `/api/users/{id}/roles/` | `roles.manage` |

Every route requires authentication. Permission codes remain independent: `users.directory` cannot administer users or roles, `users.view` cannot read the directory, and `roles.manage` does not inherit role-read, user-list, or directory access.

## Security and tenant isolation

Regular actors are scoped to their tenant in both view querysets and service operations. Cross-tenant detail, update, deactivation, role read, and role replacement are hidden or rejected without disclosure. Tenantless regular actors receive empty discovery results and cannot manage accounts. Global scope remains limited to superusers and active `system_admin` role holders; inactive administrators do not retain it.

Create/update validation preserves the effective tenant, rejects cross-tenant moves, and requires organization membership in that tenant. Direct update, deactivation, and role-replacement services independently enforce target scope.

## Passwords, responses, and deactivation

Create and replacement passwords pass Django's configured validators and `set_password()`. Blank create passwords return controlled validation errors; blank edit passwords are omitted by the frontend. Password hashes, `is_superuser`, groups, and Django `user_permissions` are absent from user, directory, role, login, and current-user response contracts.

DELETE deactivates without removing the row. DELETE and PATCH both reject self-deactivation. Inactive users are excluded from the directory and rejected by authentication, while existing foreign-key relationships remain valid because the user row persists.

## Role assignment

Only active, valid, unique role IDs are accepted. Replacement is transactional, reactivates inactive `UserRole` rows, deactivates removed rows, and does not duplicate unchanged assignments. Tenant actors cannot view, assign, or remove system roles. Global administrators retain the established system-role contract, and a non-superuser system administrator cannot remove their own final active `system_admin` role. Role changes do not modify account scope, staff/superuser state, password, or activation state.

## Directory and assignment pickers

The directory remains active-only, tenant-scoped, paginated, searchable, filterable, ordered, and limited to its eight safe fields. `display_name` uses trimmed names with email fallback. Repeated RBAC seeding is idempotent and grants `users.directory` exactly to `system_admin` and `facility_manager`; module assignment permissions provide no bypass.

`UserDirectoryPicker` reuses the shared API client, `getUserDirectory`, hook, and centralized query keys. Search is debounced and backend-driven. Scoped keys include search, tenant, organization, page, page size, and ordering. Queries remain disabled without `users.directory`. Safe selected-user fallbacks persist across search/pagination, deduplicate by ID, clear only on known scope conflicts, and never trigger unrestricted lookup.

Inspection payload keys and nullable rules remain unchanged for create/edit inspector/supervisor, workflow assignment, and corrective-action `assigned_to`. At least one workflow assignee remains required. Maintenance retains its role-aware candidate endpoint, selectors, payloads, permissions, and invalidation; removed planning-only controls never affected persisted payloads.

## Frontend and manual contract review

The list/detail routes require `users.view`, create requires `users.create`, and edit requires `users.update`. Navigation and actions use matching advisory guards; backend enforcement remains authoritative. Tenant-bound submissions overwrite manipulated tenant values with the authenticated tenant, filter organizations, and clear known incompatible organization selections. Deactivation wording is non-destructive, self-controls are hidden, server field/non-field errors remain visible, and failed submissions retain form state.

Manual validation was code-level rather than interactive browser automation. List/search/filter/pagination, create/edit mappings, deactivation, role dialog behavior, picker scope/fallback/null handling, and Maintenance compatibility were traced through components, hooks, API contracts, helpers, and backend tests. The production build validates every route. No dedicated browser/component harness exists for interactive automation.

## Automated validation

- `manage.py check` - passed.
- `manage.py makemigrations --check --dry-run` - passed; no changes detected.
- `manage.py test apps.accounts apps.access_control --keepdb --noinput` - 63 passed.
- `manage.py test apps.maintenance apps.inspection --parallel 4 --keepdb --noinput` - 90 passed.
- `manage.py test --parallel 4 --keepdb --noinput` - 204 passed.
- `npm run test` - 43 passed.
- `npm run lint` - passed.
- `npx tsc --noEmit` - passed.
- `npm run build` - passed; 48 routes generated.
- `git diff --check main...HEAD` - passed.

The test environment emits a low-priority warning that the development JWT HMAC key is shorter than the production recommendation. This is configuration-only and did not affect validation.

## Architecture and residual risks

No second HTTP client, directory API, role-assignment model, unrestricted user lookup, hard delete, unsupported migration, or frontend-only business mutation was introduced. Maintenance and Inspection remain module-authoritative.

Residual low-priority limitations:

- Frontend automation is helper-level; no component, browser, or integration harness is installed.
- The development JWT secret triggers a key-length warning and must not be used as a production secret.
- Invitations, password-reset email, SSO, bulk import, audit-log expansion, and role-definition editing remain intentionally out of scope.

## Merge readiness

The feature branch is ready for Sol's separate final cumulative review. PR #32 must remain open, draft, and unmerged until that review is complete.
