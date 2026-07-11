# FO-045 - User Management Backend Foundation

## Status

Complete

## Architecture

FO-045 adds a DRF `UserViewSet` around the existing `accounts.User` model without changing the authentication-facing `UserSerializer` contract. Dedicated read, write, and directory serializers keep administrative fields separate from authentication responses and ensure passwords are write-only.

Domain operations live in `apps.accounts.services`: tenant scoping, user creation, profile and password updates, staff-status authorization, and account deactivation. Creation and update validate tenant/organization consistency before saving, and passwords are always processed with `set_password()`.

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
- An organization must belong to the user's selected tenant.
- Only globally scoped superusers and system administrators can change `is_staff`.
- `DELETE` never removes a row; it sets `is_active` to false and returns `204`.
- An authenticated user cannot deactivate their own account with either `DELETE` or `PATCH`.
- Passwords are accepted only on writes, stored as hashes, and never serialized.

The implementation reuses the existing `users.view`, `users.create`, `users.update`, and `users.delete` permission definitions and `HasPermissionCode` checks. No new permission seed or migration is required.

## Tests

The account test module covers authentication protection, permission-backed same-tenant reads, cross-tenant list/detail isolation, tenantless users, superuser and system-administrator global scope, same-tenant creation, tenant and organization validation, password hashing and replacement, password response exclusion, updates, staff authorization, soft deactivation, self-deactivation protection, directory safety, search, filters, and ordering.

Validation results:

- `python manage.py check` - passed.
- `python manage.py makemigrations --check --dry-run` - no changes detected.
- `python manage.py test apps.accounts` - 26 tests passed after the FO-045A directory contract correction.
- `python manage.py test --parallel 4` - 184 tests passed.
- `git diff --check` - passed.

## Limitations

- This task does not add frontend user-management screens.
- Role assignment remains part of the existing access-control domain and is not exposed through these user endpoints.
- The directory is a generic active-user feed; assignment workflows remain responsible for any role-specific eligibility checks.
- Deactivated accounts remain in the database by design and can be reactivated by an authorized update.

## Result

Tenant-scoped user administration and an assignment-safe directory are now available while existing login and current-user APIs remain compatible. Cross-tenant records are not disclosed, account deletion is non-destructive, passwords remain write-only, all backend tests pass, and no database migration is generated.
