# FO-059 - Notification Preferences and Delivery Foundation

## Status

Complete

## Purpose

FO-059 adds recipient-owned notification preferences and a provider-neutral in-app delivery tracking foundation while preserving the existing Notification Center. Operational in-app notifications continue to be created exactly as before; preference resolution is the foundation for future optional filtering and external delivery work.

This task does not send email, SMS, push notifications, or realtime messages.

## Backend Scope

### NotificationPreference model

- UUID primary key and timestamps through shared mixins
- `recipient` ForeignKey to the user model
- nullable `tenant` ForeignKey
- `source_module` string (`""` means channel-level default)
- `channel`: `in_app`, `email`, `sms`, `push`
- `is_enabled` boolean
- unique constraint on `recipient + source_module + channel`

Supported current module values: `fm_tickets`, `maintenance`, `inspection`. Values are validated in services, not as database enums.

### Preference resolution

`get_effective_notification_preference(recipient, channel, source_module="")`:

1. module-specific preference overrides channel default
2. channel default overrides platform fallback
3. platform fallbacks: `in_app` enabled; `email`, `sms`, `push` disabled

Missing rows resolve to platform fallbacks without eager seeding.

`set_notification_preferences(recipient, preferences)` performs atomic upsert with duplicate rejection, tenant-safe validation, and source-module normalization.

### NotificationDelivery model

Provider-neutral delivery records with:

- `notification`, `recipient`, nullable `tenant`
- `channel`, `status` (`pending`, `delivered`, `failed`, `skipped`)
- `attempt_count`, `last_attempt_at`, `delivered_at`
- `failure_code`, `failure_message`, `provider_reference`, `metadata`
- unique `notification + channel`
- recipient/tenant consistency and delivered-state validation

### In-app delivery recording

`create_notification()` now transactionally creates one delivered `in_app` `NotificationDelivery` row after the `Notification` row. Delivery failure rolls back notification creation and preserves FO-058 workflow rollback behavior.

### Preference API

- `GET /api/v1/notifications/preferences/`
- `PUT /api/v1/notifications/preferences/`

Authentication required. Preferences are always derived from `request.user` with no recipient UUID accepted from clients and no superuser bypass.

## Frontend Scope

- Authenticated route: `/settings/notifications`
- Channel defaults for email, SMS, and push
- Module overrides for FM Ticketing, Maintenance, and 5S Inspection
- In-app informational section
- Explicit message: external delivery channels are preference-ready but not connected yet
- Discoverable links from Notification Center and Profile
- Typed API methods, query keys, hooks, and helper tests

## Implemented

- Preference persistence
- Recipient-owned preference API
- Preference UI
- In-app delivery tracking
- Provider-neutral delivery records

## Not Implemented

- Actual email, SMS, or push delivery
- WebSocket or SSE
- Celery delivery jobs
- Provider credentials or integration
- Retry scheduling
- Digest scheduling
- Templates
- Quiet hours
- Escalation delivery

## Validation

Commands run from `backend/` and `frontend/`:

- `python manage.py test apps.notifications --noinput` -> passed (66 tests)
- `python manage.py test apps.fm_tickets apps.maintenance apps.inspection apps.accounts apps.access_control --noinput` -> passed (285 tests)
- `python manage.py test --parallel 4 --noinput` -> passed (379 tests)
- `python manage.py check` -> passed
- `python manage.py makemigrations --check --dry-run` -> no changes detected
- `npm test` -> passed (100 tests)
- `npm run lint` -> passed
- `npx tsc --noEmit` -> passed
- `npm run build` -> passed

## Deferred Scope

- FO-060 Notifications QA and stabilization
- external delivery providers and scheduling
- preference-based suppression of existing in-app notification creation

Notifications remains `In Progress` because FO-060 remains pending.
