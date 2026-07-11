# FO-045 - User Management Backend Foundation

## Status

Complete

## Architecture

FO-045 adds a DRF `UserViewSet` around the existing `accounts.User` model without changing the authentication-facing `UserSerializer` contract. Dedicated read, write, and directory serializers keep administrative fields separate from authentication responses and ensure passwords are write-only.

Domain operations live in `apps.accounts.services`: tenant scoping, user creation, profile and password updates, staff-status authorization, and account deactivation. Creation, update, and deactivation enforce actor-to-target tenant access inside the service boundary. Creation and update validate tenant/organization consistency before saving, and passwords must pass Django's configured password policy before being processed with `set_password()`.

## Endpoints

| Method | Endpoint | Purpose | Permission |
| ------ | -------- | ------- | ---------- |
| GET | `/api/users/` | Paginated user list | `users.view` |
| POST | `/api/users/` | Create a user | `users.create` |
| GET | `/api/users/{id}/` | Retrieve a user | `users.view` |
| PATCH | `/api/users/{id}/` | Partially update a user | `users.update` |
| PUT | `/api/users/{id}/` | Replace writable user fields | `users.update` |
| DELETE | `/api/users/{id}/` | Deactivate a user | `users.delete` |
| GET | `/api/users/directory/` | List active assignment-safe users | `users.view` |

List and detail responses contain `id`, `email`, `first_name`, `last_name`, `tenant`, `organization`, `is_active`, `is_staff`, `created_at`, and `updated_at`. The active-user-only directory response is intentionally limited to `id`, `email`, `first_name`, `last_name`, `display_name`, `tenant`, `organization`, and `is_active`. `display_name` uses the trimmed full name and falls back to email when both name fields are blank.

## Query Support

- Exact filters: `tenant`, `organization`, `is_active`, and `is_staff`.
- Search: `email`, `first_name`, and `last_name` through the `search` parameter.
- Ordering: all list response fields through the `ordering` parameter; default ordering is email ascending.
- Standard page-number pagination applies to both the administrative list and directory.

## Tenant and Authorization Rules

- Regular authenticated users can query and manage only users in their own tenant.
- A tenantless regular user receives an empty queryset.
- Cross-tenant object lookup is hidden with `404` because detail lookup occurs inside the scoped queryset.
- Superusers and active users assigned the existing `system_admin` role have global scope.
- Regular tenant administrators cannot create or move a user into another tenant.
- Direct service calls cannot update, move, or deactivate a cross-tenant target; tenant isolation does not depend only on viewset queryset scoping.
- An organization must belong to the user's selected tenant.
- Only globally scoped superusers and system administrators can change `is_staff`.
- The `users.update` contract intentionally permits activation and deactivation through `PATCH is_active`; `users.delete` is independently required for `DELETE` deactivation.
- `DELETE` never removes a row; it sets `is_active` to false and returns `204`.
- An authenticated user cannot deactivate their own account with either `DELETE` or `PATCH`.
- Passwords are accepted only on writes, validated with Django's configured password validators, stored as hashes through `set_password()`, and never serialized.

The implementation reuses the existing `users.view`, `users.create`, `users.update`, and `users.delete` permission definitions and `HasPermissionCode` checks. Each action requires its specific code even for globally scoped system administrators. The repository does not define `users.manage`, so no aggregate permission is implied. No new permission seed or migration is required.

## FO-045B Security Review

The final security review confirmed and corrected two service-boundary defects: update and deactivation relied on viewset scoping to establish the target user's current tenant, and password writes did not invoke Django's configured password validators. Service-layer update and deactivation now reject a target outside the actor's current tenant before applying any requested tenant change, while superusers and active `system_admin` users retain documented global scope. All password creation and replacement paths now validate policy centrally before calling `set_password()`.

The review also confirms that authentication and action-specific RBAC protect every user-management route, cross-tenant API lookups return `404`, tenantless regular users cannot create or discover users, inactive system administrators do not retain global scope, response serializers exclude authentication internals, and deactivation remains non-destructive. Organization is nullable by model contract; clearing it does not change tenant or RBAC scope, while removing or changing tenant remains prohibited for regular administrators.

## Tests

The account test module covers authentication on every action, the view/create/update/delete permission matrix, same-tenant reads, hidden cross-tenant detail/update/delete behavior, direct service isolation, tenantless users, inactive and active system-administrator scope, same-tenant and global creation, tenant and organization validation, configured password policy, duplicate email handling, password response exclusion, staff authorization, soft deactivation, self-deactivation protection, directory safety, search, filters, and ordering.

Validation results:

- `python manage.py check` - passed.
- `python manage.py makemigrations --check --dry-run` - no changes detected.
- `python manage.py test apps.accounts` - 26 tests passed after the FO-045A directory contract correction.
- `python manage.py test --parallel 4` - 186 tests passed after the FO-045B security review.
- `git diff --check` - passed.

## Limitations

- This task does not add frontend user-management screens.
- Role assignment remains part of the existing access-control domain and is not exposed through these user endpoints.
- The directory is a generic active-user feed; assignment workflows remain responsible for any role-specific eligibility checks.
- Deactivated accounts remain in the database by design and can be reactivated by an authorized update.

## Result

Tenant-scoped user administration and an assignment-safe directory are now available while existing login and current-user APIs remain compatible. Cross-tenant records are not disclosed, account deletion is non-destructive, passwords remain write-only, all backend tests pass, and no database migration is generated.
