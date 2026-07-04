# FO-008 - Authentication Foundation

## Task ID

FO-008

## Task Title

Authentication Foundation

## Purpose

Implement the backend authentication foundation using Django REST Framework, Simple JWT, and a custom email-based user model.

## Scope

- Add Simple JWT to backend dependencies.
- Create the `apps.accounts` Django app.
- Implement a custom UUID-based user model.
- Expose login, refresh, logout, and current-user endpoints.
- Register the custom user model in Django admin.
- Add focused authentication tests and documentation.

## Authentication Strategy

FacilityOps uses stateless JWT authentication for API requests. Clients authenticate with email and password, receive access and refresh tokens, and send the access token using the `Authorization: Bearer <token>` header.

## Custom User Model Notes

- The user model lives in `apps.accounts.models.User`.
- Email is the login identity.
- `USERNAME_FIELD` is set to `email`.
- The primary key is UUID-based.
- `username` is removed.
- Tenant, organization, role, and department fields are intentionally excluded from FO-008.

## JWT Endpoint List

- `POST /api/auth/login/`
- `POST /api/auth/refresh/`
- `POST /api/auth/logout/`
- `GET /api/auth/me/`

## Login Request and Response Example

Request:

```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

Response:

```json
{
  "access": "<access-token>",
  "refresh": "<refresh-token>",
  "user": {
    "id": "<uuid>",
    "email": "admin@example.com",
    "first_name": "Admin",
    "last_name": "User"
  }
}
```

## Refresh Behavior

Refresh tokens are rotated. A valid refresh request returns a new access token and a rotated refresh token.

## Logout Behavior

FO-008 does not enable token blacklisting. Logout returns a safe success response and requires the client to discard its local access and refresh tokens.

## Current-User Endpoint

`GET /api/auth/me/` requires a valid access token and returns a safe authenticated user payload without password, groups, or permission details.

## Security Notes

- Invalid login attempts return a generic credential error.
- Inactive users are rejected.
- JWT access tokens are short-lived.
- RBAC, permissions design, tenant scoping, and organization scoping are intentionally deferred to later tasks.

## Validation Commands

From `backend/`:

```text
pip install -r requirements/development.txt
python manage.py check
python manage.py makemigrations
python manage.py migrate
pytest
python manage.py createsuperuser
python manage.py runserver
```

## Testing Notes

Tests cover user creation, superuser creation, login success and failure, token refresh, current-user authentication, and logout response behavior.

## Known Limitations

- Token blacklisting is not enabled in FO-008.
- Logout is token discard behavior only.
- RBAC is not implemented.
- Tenant and organization ownership are not implemented.
- No frontend authentication UI is included.
- Existing development databases created before FO-008 may need to be recreated because `AUTH_USER_MODEL` is being introduced after earlier built-in auth migrations were already applied.

## Next Task Recommendation

Proceed to `FO-009 - Authorization and RBAC Foundation`.
