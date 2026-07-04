# FO-009 - Authorization and RBAC Foundation

## Task ID

FO-009

## Task Title

Authorization and RBAC Foundation

## Purpose

Implement the backend role-based access control foundation using reusable models, service helpers, API permission enforcement, and a seed command.

## Scope

- Create the `apps.access_control` Django app.
- Add RBAC data models and their relationships.
- Implement reusable permission lookup services.
- Add a DRF permission class for permission-code enforcement.
- Expose basic authenticated RBAC read endpoints.
- Register RBAC models in admin.
- Add an idempotent RBAC seed command.
- Add focused tests and documentation.

## RBAC Model Overview

- `Role`
- `Permission`
- `RolePermission`
- `UserRole`

All RBAC models inherit from `apps.core.models.BaseModel`.

## Permission Code Convention

Permission codes use the `module.action` convention.

Examples:

- `users.view`
- `users.create`
- `users.update`
- `users.delete`
- `settings.view`
- `settings.manage`
- `roles.view`
- `roles.manage`

Business-module permission codes are intentionally excluded from FO-009.

## Service Functions

- `user_has_permission(user, permission_code)`
- `get_user_permission_codes(user)`
- `get_user_roles(user)`

These helpers ignore anonymous users, inactive users, inactive roles, inactive permissions, and inactive role-permission assignments. Superusers bypass permission checks.

## DRF Permission Class Usage

`HasPermissionCode` expects the view to define a `required_permission` attribute.

Example:

```python
class SomeView(APIView):
    required_permission = "module.action"
    permission_classes = [IsAuthenticated, HasPermissionCode]
```

## Seed Command

Run:

```text
python manage.py seed_rbac
```

This seeds the foundation roles and permissions and assigns all seeded permissions to the `system_admin` role. The command is idempotent.

## Basic Endpoints

- `GET /api/access-control/roles/`
- `GET /api/access-control/permissions/`
- `GET /api/access-control/me/permissions/`

## Validation Commands

From `backend/`:

```text
pip install -r requirements/development.txt
python manage.py check
python manage.py makemigrations
python manage.py migrate
python manage.py seed_rbac
pytest
python manage.py runserver
```

## Testing Notes

Tests cover model creation, RBAC assignments, permission services, DRF permission enforcement, superuser bypass, inactive state handling, and `seed_rbac` idempotency.

## Known Limitations

- No tenant-scoped RBAC is implemented.
- No organization-scoped RBAC is implemented.
- No frontend route guards or frontend authorization UI are implemented.
- No business-module permissions are seeded in FO-009.
- Existing development databases created before FO-008 may still need to be recreated before current migrations can be applied cleanly.

## Next Task Recommendation

Proceed to `FO-010 - Master Data Foundation`.
