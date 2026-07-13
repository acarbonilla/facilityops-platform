# FO-055 - Notifications Backend Foundation

## Status

Complete

## Scope Implemented

FO-055 introduces the backend foundation for tenant-isolated, recipient-scoped in-app notifications.

Implemented scope:

- Dedicated Django app: `apps.notifications`
- Persistent `Notification` model with UUID identity and timestamp fields
- Recipient-safe creation service with tenant consistency checks
- Authenticated read-only APIs for list, detail, and unread-count
- Recipient-scoped queryset isolation (including superusers/global users)
- Django admin read-oriented registration
- Initial migration and focused backend tests

Deferred (intentionally out of scope):

- Mark-as-read and bulk actions
- Business event hooks (FM Tickets, Maintenance, Inspection)
- External delivery channels (email, SMS, push)
- WebSocket/SSE realtime delivery
- Celery notification jobs
- Notification preferences and templates

## Data Model Contract

Model: `apps.notifications.models.Notification`

Fields:

- `id` (UUID primary key)
- `tenant` (nullable FK to `master_data.Tenant`)
- `recipient` (FK to user model)
- `event_code`
- `title`
- `message`
- `severity` (`info`, `success`, `warning`, `error`)
- `target_url` (optional)
- `source_module` (optional)
- `source_object_id` (optional UUID)
- `metadata` (JSONField, safe default `dict`)
- `is_read`
- `read_at`
- `created_at` and `updated_at` via shared foundations

Explicit non-goals in schema:

- No generic foreign keys
- No direct coupling to FM Ticket, Maintenance, or Inspection models

## Tenant and Recipient Isolation Rules

Enforced by model validation and service logic:

- Tenant-bound recipient: notification `tenant` must match `recipient.tenant`
- Global recipient (`recipient.tenant is null`): notification `tenant` must also be null
- Global/superuser accounts do not gain broad read access by role alone

Enforced by API queryset logic:

- End-user endpoints always filter by `recipient=request.user`
- Tenant users additionally require matching `tenant_id`
- Global users only receive notifications where `tenant is null`

Result: frontend filtering is never trusted for isolation; backend querysets are authoritative.

## Query and Index Strategy

Targeted query patterns:

- Recipient notification list
- Recipient unread list
- Newest-first ordering
- Recipient unread-count

Indexes added:

- `(recipient, -created_at, -id)`
- `(recipient, is_read, -created_at, -id)`

Ordering contract:

- Default newest-first ordering is deterministic with `-created_at, -id`
- API allows ordering by `created_at` only

## Service Foundation

Service: `apps.notifications.services.create_notification`

Behavior:

- Requires explicit active recipient
- Validates required business fields (`event_code`, `title`, `message`)
- Validates/normalizes severity
- Derives recipient tenant when tenant argument is omitted
- Rejects cross-tenant or global-recipient tenant-binding violations
- Persists optional source metadata fields without importing business modules
- Executes transactionally (`@transaction.atomic`)

## API Contract

Base path: `/api/v1/notifications/`

Endpoints:

- `GET /api/v1/notifications/`
- `GET /api/v1/notifications/{uuid}/`
- `GET /api/v1/notifications/unread-count/`

Security:

- `IsAuthenticated`
- Querysets are recipient-scoped and tenant-safe
- No superuser/global bypass for other recipients

Safe filtering:

- `is_read`
- `severity`
- `source_module`

Ordering:

- `created_at` only

Response notes:

- List is paginated with repository standard pagination contract
- Detail and list expose read-only notification fields
- Unread count returns `{ "unread_count": <int> }`
- Unknown UUID and unauthorized cross-recipient lookups return 404

## RBAC Decision

No new permission code was introduced in FO-055.

Rationale:

- Existing architecture does not define a notifications-specific permission code at this stage.
- Recipient-scoped backend querysets already enforce strict data ownership boundaries.
- Speculative RBAC expansion is deferred until a confirmed cross-module requirement appears.

## Admin Registration

`Notification` is registered with read-oriented admin behavior:

- Safe list display and filters
- Search over recipient and notification descriptors
- Read-only fields for inspection
- No unsafe mass-mutation actions (`actions = None`)

## Migration

Created:

- `apps/notifications/migrations/0001_initial.py`

## Tests Added

Added focused backend tests in `apps.notifications.tests` covering:

- UUID/default field behavior
- Recipient-tenant consistency validation
- Service validation and tenant derivation rules
- Anonymous access rejection
- Recipient list and detail access
- Cross-user and cross-tenant isolation
- Global/superuser no-bypass behavior
- Unread filtering
- Severity and source-module filtering
- Newest-first deterministic ordering
- Unread-count response
- Invalid UUID and missing-record behavior
- Pagination contract

## Validation Executed

Interpreter:

- `backend/.venv/Scripts/python.exe`

Commands and outcomes:

- `python manage.py test apps.notifications --noinput` -> passed (18 tests)
- `python manage.py test apps.accounts apps.access_control --noinput` -> passed (109 tests)
- `python manage.py test --parallel 4 --noinput` -> canonical full backend suite executed (268 discovered); this environment intermittently shows multiprocessing worker teardown trace output after parallel completion, consistent with prior repository notes
- `python manage.py check` -> passed (0 issues)
- `python manage.py makemigrations --check --dry-run` -> passed (no changes detected)

## Limitations Deferred to FO-056 Through FO-060

- No notification state mutation endpoints yet (`mark-read`, bulk operations)
- No business event integrations yet (reserved for FO-058)
- No realtime or external delivery pipelines
- No notification preference management
- No template engine or provider abstractions
