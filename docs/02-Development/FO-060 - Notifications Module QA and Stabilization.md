# FO-060 - Notifications Module QA and Stabilization

## Status

Complete

## Purpose

FO-060 is the cumulative final QA and stabilization review for the Notifications
feature delivered through FO-055–FO-059A on `feature/notifications` (PR #34).

This task validated the complete module as one integrated surface, corrected one
confirmed frontend defect, added focused regression coverage, reconciled
documentation, and prepared PR #34 for Sol’s independent cumulative final review.

PR #34 remains draft and unmerged.

## Preflight

FO-059A was reconciled as independently approved before QA:

- Reviewed baseline: `6df8ec3`
- FO-059 fully complete
- FO-059A independently approved
- FO-060 recorded as the current task
- Pending-independent-review wording for FO-059A removed

Approved FO-059A validation baseline before FO-060 corrections:

- 76 notification backend tests
- 176 combined business-module tests
- 389 full backend tests
- 108 frontend helper tests

## QA Scope Reviewed

Cumulative diff:

- `main` baseline: `ca67eeb2fd425d8582973fabbb222f026ef6a90d`
- Feature HEAD at FO-060 start: `6df8ec3018a615f5f71741e996da862d41d464f1`

Covering FO-055 / FO-055A, FO-056 / FO-056A, FO-057 / FO-057A, FO-058 /
FO-058A / FO-058B / FO-058C / FO-058CA, FO-059 / FO-059A.

## Confirmed Defects

### FO-060-1 — Inherited effective label ignored draft channel defaults

| Field | Detail |
| --- | --- |
| Severity | Medium |
| Surface | Frontend preferences UI |
| Contract | FO-059A / FO-060 H: inherited settings show the currently effective channel-default result; changing a channel default must not change inherit module control state, but the effective helper should track the channel default being edited |
| Root cause | Module inherit labels called `resolveEffectivePreference()` against persisted API rows/platform defaults and never the live `channelDefaults` form state |
| Correction | Added `resolveDraftInheritedChannelDefault()` and wired the preferences screen inherit label to draft channel-default form state |
| Regression | `inherited effective label follows draft channel default toggles` in `frontend/lib/notifications/preferences.test.ts` |

No other confirmed defects were found across backend foundation, recipient API
security, business-module hooks, preferences semantics, delivery foundation,
safe navigation, or migration schema.

## Additional Regression Coverage

Not defect-driven corrections; contract confirmation added during QA:

- Backend: invalid list filters return HTTP 400
- Backend: `preferences/` path returns preference payload and does not collide with UUID detail routing

## Validation Summary

### Implementation review

Passed for:

- Notification UUID foundation, tenant/recipient consistency, global-user behavior
- Recipient-scoped API security with no superuser bypass
- Preferences path vs UUID detail routing isolation
- Read/unread/bulk atomic workflow and 100-ID limit
- Business-module notification hooks only in authoritative services
- Preference null-deletion semantics and resolution order
- In-app delivery recording; no email/SMS/push/provider/Celery/WebSocket delivery
- Notification Center accessibility and safe-navigation helpers
- Preferences three-state UI and auth-gated query hooks
- Migration 0001 unchanged relative to introduction history; 0002 adds preference and delivery tables only; constraint names under PostgreSQL limits; no makemigrations drift

### Automated validation

Backend:

- `python manage.py test apps.notifications --noinput` -> passed (78 tests)
- `python manage.py test apps.fm_tickets --noinput` -> passed (43 tests)
- `python manage.py test apps.maintenance --noinput` -> passed (69 tests)
- `python manage.py test apps.inspection --noinput` -> passed (64 tests)
- `python manage.py test apps.accounts apps.access_control --noinput` -> passed (109 tests)
- Combined business-module suite (`fm_tickets` + `maintenance` + `inspection`) -> 176 tests
- `python manage.py test --parallel 4 --noinput` -> passed (391 tests)
- `python manage.py check` -> passed
- `python manage.py makemigrations --check --dry-run` -> no changes detected
- `python manage.py showmigrations notifications` -> `0001_initial` and `0002_notification_preferences_and_delivery`
- Upgrade path validation: `migrate notifications 0001` then `migrate notifications 0002` -> OK
- Clean test-database application of both notification migrations confirmed via full suite database setup

Frontend:

- `npm test` -> passed (109 tests)
- `npm run lint` -> passed
- `npx tsc --noEmit` -> passed
- `npm run build` -> passed

### Manual smoke-test status

| # | Checklist item | Status |
| --- | --- | --- |
| 1 | Login and open Notification Center | Implementation review + automated coverage; browser not executed in FO-060 |
| 2 | Bell preview open/close | Implementation review (Escape/outside-click handlers present) |
| 3 | Read/unread cache refresh | Implementation review + mutation hook invalidation paths |
| 4 | Bulk exactly 100 | Automated frontend helper + backend bulk tests |
| 5 | Unsafe link non-clickable | Automated safe-URL helper tests |
| 6–10 | Preferences inherit/enabled/disabled/null/reset/warning | Implementation review + helper tests; browser not executed |
| 11–12 | Business-module event recipient eligibility | Automated backend integration tests; browser not executed |

Limitation: FO-060 did not run a live browser session. Claims above are
implementation review and automated validation only unless marked otherwise.

## Implemented (module complete)

- In-app notification persistence
- Notification Center
- Read/unread and bulk actions
- FM Ticket, Maintenance, and 5S workflow events
- Preferences persistence/API/UI with three-state module overrides
- Provider-neutral delivery tracking
- In-app delivery records

## Deferred

- Actual email delivery
- Actual SMS delivery
- Actual push delivery
- WebSocket/SSE
- Celery delivery jobs
- Provider integration
- Retry schedules
- Digests
- Templates
- Quiet hours
- Additional business events
- Notification deletion
- Preference-based suppression of existing in-app notification creation
- Component/integration/browser test harness

## Status Reconciliation

- FO-060 marked complete
- Notifications module marked complete
- Final backend totals: 78 notifications / 176 business-module / 109 accounts+access_control / 391 full suite
- Final frontend total: 109 helper tests
- Draft PR #34 remains open and unmerged
- PR #34 awaits Sol’s independent cumulative final review

Final confirmed HEAD is recorded in `docs/development/project-status.md` and PR #34 after push.
