# FO-056 - Notification Center Frontend

## Status

Complete

## Purpose

FO-056 delivers the authenticated, read-only Notification Center frontend on top of the FO-055 backend contract. The scope covers header bell access, a compact preview panel, a protected full-page notification center, typed API integration, query hooks, safe internal navigation handling, and focused helper tests.

## Routes Implemented

- `/notifications`

The route is wrapped with `ProtectedRoute` only. No notification-specific permission code is required because FO-055 endpoints are recipient-scoped for every authenticated user.

## Frontend Architecture

The implementation follows the existing Next.js app-router structure and reuses the shared frontend layers already established in the repository:

- `frontend/services/api/notifications.ts` for typed API access through the shared API client
- `frontend/services/api/endpoints.ts` for `/v1/notifications/` catalog entries
- `frontend/services/api/query-keys.ts` for centralized React Query keys
- `frontend/hooks/use-notifications.ts` for list, detail, and unread-count hooks
- `frontend/lib/notifications/display.ts` for badge formatting, severity labels, timestamps, filter mapping, safe target URL validation, and error helpers
- `frontend/features/notifications/components/*` for bell, preview, list, filters, pagination, and center screen UI
- `frontend/components/layout/header.tsx` for authenticated bell placement before `UserMenu`

No second HTTP client was introduced, and page components do not call `fetch` or `axios` directly.

## API Integration

The frontend integrates with the FO-055 endpoints using paths relative to the existing API base URL, which already ends in `/api`:

- `GET /api/v1/notifications/`
- `GET /api/v1/notifications/{uuid}/`
- `GET /api/v1/notifications/unread-count/`

Frontend endpoint catalog entries use:

- `/v1/notifications/`
- `/v1/notifications/{uuid}/`
- `/v1/notifications/unread-count/`

List requests support the backend query parameters:

- `page`
- `page_size`
- `is_read`
- `severity`
- `source_module`
- `ordering` (`created_at`, `-created_at`)

Unread count returns `{ "unread_count": <int> }`.

## Query Key Contract

`notificationQueryKeys` in `frontend/services/api/query-keys.ts`:

- `all` -> `["notifications"]`
- `lists()` -> `["notifications", "list"]`
- `list(params)` -> `["notifications", "list", normalizedParams]`
- `detail(id)` -> `["notifications", "detail", id]`
- `unreadCount()` -> `["notifications", "unread-count"]`

List params are normalized with the shared `stripNilParams` helper before entering cache keys.

## Authenticated Access Behavior

- Notification queries use `enabled: !isLoading && isAuthenticated`.
- The header bell renders only for authenticated sessions after auth restoration completes.
- Logged-out users and auth-restoration states do not trigger notification API requests.
- The Notification Center page is available to every authenticated user and is not hidden behind an unrelated permission guard.

## Header Bell and Preview Behavior

`NotificationBell` is rendered immediately before `UserMenu` in the authenticated header.

Bell behavior:

- Accessible button label: `Notifications`
- Unread badge uses `formatUnreadBadgeCount`
- Zero unread count hides the badge
- Counts above 99 render as `99+`
- Badge positioning is absolute so loading does not shift the bell layout
- Unread-count API failure does not break the header or `UserMenu`
- Clicking the bell opens a compact read-only preview panel
- Preview loads the newest five notifications with `ordering: -created_at`
- Preview includes loading, error, and empty states
- Preview includes a `View all notifications` link to `/notifications`
- Escape and outside-click close the panel
- `aria-expanded`, `aria-haspopup="dialog"`, and `aria-controls` are set on the bell trigger
- Preview uses `role="dialog"`, a stable preview ID, and an accessible name
- Panel width is constrained for narrow screens

## Notification Center Page Behavior

`/notifications` provides:

- page heading and concise description
- unread-count summary
- paginated newest-first notification list
- filters for read state, severity, and source module
- clear/reset filters action
- loading state
- API error state with retry
- empty-state distinction between:
  1. no notifications exist
  2. no notifications match current filters
- responsive mobile and desktop layout

Each notification item displays:

- title
- message
- severity badge
- relative or formatted creation time
- source-module label when present
- unread visual indicator when `is_read` is false

Raw `metadata` JSON is not rendered in the list or preview panel.

## Safe Target URL Handling

`getSafeNotificationTargetUrl` in `frontend/lib/notifications/display.ts` treats `target_url` as untrusted backend-provided data and fails closed.

Accepted values:

- internal application paths beginning with one slash, such as `/dashboard`, `/notifications`, or `/maintenance/work-orders/123/`
- valid internal paths that include query strings or fragments

Rejected values:

- absolute `http://` and `https://` URLs
- protocol-relative URLs beginning with `//`, including percent-encoded forms such as `/%2Fevil.com`
- backslash-based navigation forms, including encoded forms such as `/%5Cevil.com`
- `javascript:` and other scheme-based values
- ASCII control characters such as newline, carriage return, tab, and null bytes
- malformed percent encoding
- malformed or empty values

When decoding fails or the decoded path resolves to an unsafe navigation form, the helper returns `null`. When `target_url` is unsafe or empty, the notification renders without a navigation link.

FO-056A hardened this helper with encoded-path regression coverage and fail-closed decoding behavior.

## Read-Only Interaction Contract

FO-056 intentionally excludes notification mutations.

- Opening the preview panel does not mark notifications as read
- Clicking a notification item does not mark it as read
- No mark-as-read, mark-all-as-read, bulk mutation, or delete UI was added

State mutation remains reserved for FO-057 and later tasks.

## Tests Added

Focused helper coverage was added in `frontend/lib/notifications/display.test.ts` for:

- unread badge formatting (`0`, normal count, `99+`)
- severity display mapping
- timestamp fallback and relative formatting
- safe internal target URL acceptance
- absolute URL rejection
- protocol-relative URL rejection
- scheme and malformed target rejection
- empty target URL behavior
- filter-to-query mapping
- notification query-key stability

`frontend/package.json` now includes `lib/notifications/display.test.ts` in `npm run test`.

## Validation

Commands run from `frontend/`:

- `npm test` -> passed (77 tests)
- `npm run lint` -> passed
- `npx tsc --noEmit` -> passed
- `npm run build` -> passed

Repository checks:

- No backend files or migrations changed
- Header and `UserMenu` remain usable together in the authenticated layout
- Unauthenticated users do not trigger notification API requests because query hooks remain disabled until auth restoration completes

## Known Limitations Reserved for FO-057 through FO-060

- Mark-as-read and mark-all-as-read mutations
- Bulk notification mutation and deletion
- Business-module event hooks that create notifications automatically
- Email, SMS, push, WebSocket, or SSE delivery
- Notification preferences and templates
- External provider integrations
- Sidebar navigation entry for notifications
- Component, integration, or browser test harness beyond helper-level coverage

## Deferred Module Status

Notifications remains `In Progress` at the module level because FO-057 through FO-060 are still pending after this frontend read surface lands on the existing FO-055 backend foundation.
