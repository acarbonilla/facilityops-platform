# FO-012 - Frontend Authentication Integration

## Purpose

FO-012 connects the Next.js frontend to the JWT authentication endpoints established by FO-008. It provides a local-development session lifecycle, current-user state, login and logout flows, and a protected-route foundation for later application pages.

## Scope

- Typed authentication API service
- Centralized local token storage
- Bearer-token injection and normalized unauthorized errors
- Application-wide authentication provider and hook
- React Hook Form and Zod login form
- Protected dashboard placeholder
- Best-effort backend logout with guaranteed local cleanup

Dashboard metrics, business screens, user administration, RBAC permission guards, SSO, social login, and production identity-provider integration are outside this task.

## Backend Auth Endpoints

The frontend uses these endpoints relative to `NEXT_PUBLIC_API_URL`:

- `POST /auth/login/`
- `POST /auth/refresh/`
- `POST /auth/logout/`
- `GET /auth/me/`

## Auth Service Structure

`frontend/services/api/auth.ts` exposes `login`, `refreshToken`, `logout`, and `getCurrentUser`. All requests use the shared Fetch API client. Authentication endpoint constants remain in `frontend/services/api/endpoints.ts`, and frontend contracts are defined in `frontend/types/auth.ts`.

The login response contains tokens and a reduced user object. After storing the tokens, the provider calls `/auth/me/` to load the complete `AuthUser`, including `is_staff`.

## Local Session Utility

`frontend/lib/auth/token-storage.ts` is the only module that reads or writes access and refresh tokens. It uses browser `localStorage` for the approved local-development foundation and safely returns no storage during server rendering. Passwords and debug data are never stored.

This is not the final production storage strategy. A production security review should consider an HTTP-only, secure, same-site cookie architecture and its CSRF requirements.

## Auth Provider Behavior

`AuthProvider` is nested inside `QueryProvider` by `AppProviders`. On startup it checks for an access token and loads the current user when one exists. It exposes the user, authentication/loading/error state, login, logout, and manual current-user refresh through `useAuth`.

The API client attaches a bearer header only when an access token exists. HTTP 401 responses become a consistent `ApiError`. Token refresh is exposed through the service but no automatic retry loop is implemented.

## Login Page Behavior

`/login` uses React Hook Form for form state and Zod for email and password validation. Successful submission stores the returned tokens, loads the complete current user, and redirects to `/dashboard`. Failed submissions display a safe generic message without backend diagnostics. Registration, password recovery, SSO, and social-login controls are intentionally absent.

## Protected Route Foundation

`ProtectedRoute` displays a loading state while authentication initializes, redirects anonymous users to `/login`, and renders authenticated children. `/dashboard` uses this component and contains only an authentication success placeholder and current-user email. Permission checks belong to FO-013.

## Logout Flow

The app-shell header displays a sign-out action for authenticated users. Logout attempts `POST /auth/logout/` when a refresh token exists. Local tokens and user state are cleared in all cases, including backend or network failures, before redirecting to `/login`.

## Validation Commands

Backend:

```text
cd backend
.venv\Scripts\activate
python manage.py runserver
```

On Linux or macOS, activate with `source .venv/bin/activate`.

Frontend:

```text
cd frontend
npm install
npm run lint
npm run build
npm run dev
```

Open `http://localhost:3000/login`. Validate safe invalid-login behavior, successful redirection and current-user loading, anonymous dashboard redirection, and logout cleanup/redirection.

## Known Limitations

- Browser local storage is approved only as the current local-development session mechanism.
- Tokens are not refreshed automatically; the service method is prepared for a later controlled strategy.
- Client-side protected routes improve application flow but are not a replacement for backend authorization.
- There are no permission-based navigation or component guards.
- There is no password reset, registration, SSO, OAuth, or production identity-provider integration.

## Next Task Recommendation

FO-013 - Frontend RBAC and Navigation Guard Foundation should load the existing backend permission model and introduce permission-aware navigation and UI guards while preserving backend enforcement as the security boundary.
