# FO-019 - Login Remember Email UX

## Task ID

FO-019

## Task Title

Login Remember Email UX

## Purpose

FO-019 improves login usability by allowing a user to remember only their email address on the login page for later visits on the same device.

## Scope

- Browser-only remembered-email utility for the login page
- `Remember Me` checkbox on `/login`
- Prefill of the saved email when the checkbox was previously enabled
- Frontend-only behavior that preserves the existing authentication API contract

Persistent login, auto-login, password storage, JWT lifetime changes, backend authentication changes, RBAC changes, dashboard changes, and business-module changes are out of scope.

## Behavior

`frontend/lib/auth/remembered-email.ts` stores a single email string in browser `localStorage` under a dedicated key. The utility is safe during server rendering because it returns empty results when `window` is unavailable.

`frontend/app/(auth)/login/page.tsx` now:

- Loads the remembered email on page mount
- Prefills the email field when a remembered email exists
- Checks `Remember Me` automatically when a remembered email exists
- Sends only `email` and `password` to the backend login request
- Saves the trimmed email after a successful login when `Remember Me` is checked
- Clears the saved email when `Remember Me` is unchecked or when login succeeds with the checkbox cleared

## Storage Key

`facilityops.rememberedEmail`

## Security Boundary

- This feature remembers email only.
- It does not remember password.
- It does not keep the user logged in.
- It does not change backend authentication.

## Validation Steps

Frontend:

```text
cd frontend
npm run lint
npm run dev
```

Open `http://localhost:3000/login` and validate:

1. Login page loads.
2. Remember Me checkbox appears.
3. Enter email.
4. Check Remember Me.
5. Login successfully.
6. Logout.
7. Return to login page.
8. Email is prefilled.
9. Uncheck Remember Me.
10. Reload or log in again.
11. Return to login page.
12. Email is no longer prefilled.
13. Password is never prefilled.
14. Existing login still works.
15. Existing logout still works.

## Known Limitations

- The remembered email is stored in browser `localStorage`, so it is device- and browser-specific.
- The feature does not sync between browsers, profiles, or devices.
- Email is cleared only from the current browser storage, not from any external identity system.
- This feature intentionally does not implement persistent login or automatic sign-in.
