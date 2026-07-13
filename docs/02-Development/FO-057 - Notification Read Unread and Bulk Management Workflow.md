# FO-057 - Notification Read, Unread, and Bulk Management Workflow

## Status

Complete (FO-057A boundary correction applied)

## Purpose

FO-057 adds secure, recipient-scoped notification state management on top of the FO-055 backend foundation and FO-056 Notification Center frontend. Users can now mark individual notifications read or unread, mark all unread notifications as read, and bulk-update up to 100 selected notifications from the Notification Center page.

FO-057A corrects the frontend bulk-selection boundary so exactly 100 selected notifications remain submittable while additional selection is blocked at the UI layer. Bulk read and bulk unread now share identical enablement rules.

No schema changes or migrations were introduced.

## Mutation Endpoint Contracts

Base path: `/api/v1/notifications/`

| Method | Path | Request | Response |
| ------ | ---- | ------- | -------- |
| `POST` | `/{uuid}/mark-read/` | none | updated `NotificationSerializer` payload |
| `POST` | `/{uuid}/mark-unread/` | none | updated `NotificationSerializer` payload |
| `POST` | `/mark-all-read/` | none | `{ "updated_count": <int> }` |
| `POST` | `/bulk-state/` | `{ "notification_ids": ["uuid", ...], "is_read": true \| false }` | `{ "updated_count": <int>, "is_read": true \| false }` |

Frontend endpoint catalog entries use `/v1/notifications/...` because the shared API base URL already ends in `/api`.

## Idempotency Behavior

Individual read:

- sets `is_read=true`
- sets `read_at` to the current timezone-aware timestamp only on the first transition to read
- repeated mark-read calls preserve the original `read_at`

Individual unread:

- sets `is_read=false`
- clears `read_at`
- repeated mark-unread calls remain safe

Mark-all-read:

- updates only unread notifications in the authenticated recipient-scoped queryset
- repeated calls return `updated_count=0`

Bulk read:

- sets `is_read=true`
- sets `read_at` only for notifications currently unread
- preserves existing `read_at` for already-read notifications

Bulk unread:

- sets `is_read=false`
- clears `read_at` for affected notifications

## Atomic Bulk Behavior and Limits

Bulk-state requirements:

- `notification_ids` is required
- empty lists are rejected with `400`
- duplicate IDs are normalized deterministically before processing
- maximum `100` IDs per request
- every value must be a valid UUID
- the operation is atomic inside a database transaction

Fail-closed ownership checks:

- every requested ID must exist in the authenticated recipient-scoped queryset
- if any ID is missing, belongs to another recipient, or is outside tenant scope, the API returns one generic `404`
- no partial updates occur
- the response does not identify which ID failed

## Recipient and Tenant Isolation

All mutation endpoints reuse FO-055 `get_queryset()` recipient scoping:

- tenant users only mutate notifications where `recipient=request.user` and `tenant_id` matches
- global users only mutate notifications where `recipient=request.user` and `tenant is null`
- superusers and global accounts cannot bypass recipient isolation

## Frontend State and Cache Behavior

Added API methods and TanStack Query mutation hooks for:

- mark read
- mark unread
- mark all read
- bulk state

After successful mutations, hooks invalidate:

- `notificationQueryKeys.lists()`
- `notificationQueryKeys.unreadCount()`
- the affected `notificationQueryKeys.detail(id)` when applicable

This keeps the header bell badge, preview panel, and Notification Center list in sync.

Notification Center UX:

- individual Mark as read / Mark as unread actions on each item
- preview panel supports Mark as read for unread items only
- page-local checkbox selection with select-all-visible and clear-selection controls
- bulk Mark as read / Mark as unread for up to 100 selected IDs
- selection boundary: 0 selected disables bulk actions; 1 through 100 selected enables both bulk read and bulk unread; additional selection is blocked at exactly 100; deselect and clear-selection remain available at the maximum
- neutral maximum-selection status: "Maximum selection reached. You can apply a bulk action or deselect notifications."
- Mark all as read in the unread summary with explicit confirmation
- selection clears when page, filters, or page size changes
- navigation links and state buttons are separate controls; no nested interactive elements inside `Link`

Opening the bell, opening the Notification Center, or rendering an item does not automatically change read state.

## Tests Added

Backend (`apps.notifications.tests.NotificationMutationTests`):

- anonymous mutation rejection
- recipient read/unread success paths
- timezone-aware `read_at`
- idempotent individual read/unread behavior
- cross-recipient and cross-tenant `404` responses
- superuser/global isolation
- mark-all-read scope and repeat behavior
- bulk read/unread success
- bulk read `read_at` preservation
- empty list, >100 IDs, and invalid UUID validation
- mixed owned/unauthorized ID atomic failure
- non-enumerating unknown vs unauthorized responses

Frontend (`frontend/lib/notifications/display.test.ts`):

- bulk payload creation
- duplicate selected-ID normalization
- maximum selection enforcement
- selection cleanup against visible IDs
- read/unread action label mapping
- mutation response formatting
- bulk-selection boundary regression coverage:
  - 99 selected with 100th accepted
  - exactly 100 selected remains submittable
  - item 101 cannot be added
  - deselect still works at the maximum
  - bulk payload preserves exactly 100 unique IDs
  - select-all-visible caps merged selection at 100
  - neutral maximum-selection status message
- existing safe-target regression coverage remains passing

## Validation

Commands run from repository root:

Backend:

- `python manage.py test apps.notifications --noinput` -> passed (41 tests)
- `python manage.py test apps.accounts apps.access_control --noinput` -> passed (109 tests)
- `python manage.py test --parallel 4 --noinput` -> passed (291 tests)
- `python manage.py check` -> passed
- `python manage.py makemigrations --check --dry-run` -> no changes detected

Frontend (`frontend/`):

- `npm test` -> passed (94 tests)
- `npm run lint` -> passed
- `npx tsc --noEmit` -> passed
- `npm run build` -> passed

FO-057A boundary validation:

- exactly 100 selected IDs can be submitted through `buildBulkStatePayload`
- item 101 cannot be added through `toggleNotificationSelection`
- bulk read and bulk unread remain enabled at exactly 100 selected
- select-all-visible caps merged selection at 100

Repository checks:

- no migration created
- PR #34 remains open, draft, and unmerged

## Known Limitations Reserved for FO-058 through FO-060

- notification deletion
- business-module event hooks that create notifications automatically
- email, SMS, push, WebSocket, or SSE delivery
- notification preferences and templates
- external providers
- sidebar navigation entry for notifications
- component, integration, or browser test harness beyond helper-level coverage

## Deferred Module Status

Notifications remains `In Progress` at the module level because FO-058 through FO-060 are still pending after FO-057 state-management workflow delivery.
