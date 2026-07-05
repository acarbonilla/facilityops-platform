# FO-014 - User Profile and Current User UI

## Purpose

FO-014 adds the current-user presentation layer for authenticated sessions. It introduces a profile route, current-user summary components, and a header user menu while preserving the existing authentication and logout flow.

## Scope

- Current-user display in the authenticated header
- Initials-based avatar component
- Header user menu with profile and logout actions
- Protected profile route at `/profile`
- Current-user summary card and profile summary wrapper
- Safe loading and unavailable states
- README and task documentation updates

User management CRUD, profile editing, password management, avatar uploads, role management UI, permission management UI, and business-module screens remain outside this task.

## Components Created

- `frontend/components/auth/user-avatar.tsx`
- `frontend/components/auth/user-menu.tsx`
- `frontend/components/auth/current-user-card.tsx`
- `frontend/components/profile/profile-summary.tsx`

Shared display helpers are centralized in `frontend/lib/auth/user-display.ts`.

## Profile Route

`frontend/app/(app)/profile/page.tsx` is protected by the existing `ProtectedRoute` foundation. The page renders `ProfileSummary`, which shows:

- a loading state while the current user is still being restored
- a safe fallback if the authenticated user object is unavailable
- a read-only account summary when the current user is present

The route intentionally excludes profile editing, password forms, avatar uploads, and permission internals.

## Header Integration

`frontend/components/layout/header.tsx` now handles three safe states:

- authentication loading: shows a compact account placeholder
- authenticated: shows `UserMenu`
- anonymous: retains the existing foundation badge

The menu displays the current-user name when available, falls back to email or a generic account label, links to `/profile`, and supports logout through the existing auth provider.

## Logout Behavior

Logout remains delegated to `AuthProvider.logout()`. The user menu only triggers the existing flow:

- best-effort backend logout
- guaranteed local token cleanup
- state reset
- redirect to `/login`

## Validation Commands

Backend:

```text
cd backend
.venv\Scripts\activate
python manage.py runserver
```

On Linux or macOS:

```text
source .venv/bin/activate
python manage.py runserver
```

Frontend:

```text
cd frontend
npm install
npm run lint
npm run build
npm run dev
```

Validate:

- login succeeds
- header shows the user menu after authentication
- the menu displays current-user identity safely
- `/profile` opens and shows current-user information
- logout from the menu redirects to `/login`
- anonymous `/profile` access redirects to `/login`

## Known Limitations

- The profile route is read-only and surfaces only the safe current-user summary returned by `/api/auth/me/`.
- There is no profile editing, password management, avatar upload, or account-preferences UI.
- The current-user card does not expose roles or permissions; those concerns remain separate from this task.
- The header menu is client-side only and does not use a server-rendered session model.

## Next Task Recommendation

FO-015 - Master Data Frontend Read Screens should consume the authenticated shell and RBAC foundation without expanding this current-user UI into administrative account management.
