# FO-037 - Maintenance Work Order Module QA and Stabilization

## Status

Complete

## Scope Validated

FO-031 through FO-036 were validated as one integrated maintenance module: CRUD, read screens, forms, status workflow, assignment workflow, SLA/escalation behavior, RBAC, tenant isolation, migrations, performance, accessibility basics, responsive structure, and production build output.

## Defects Resolved

- Added account tenant/organization membership and enforced tenant-scoped maintenance list, detail, dashboard, search, filters, SLA, escalation, and assignment candidate access.
- Blocked cross-tenant technician/supervisor assignment and cross-tenant create/update payloads.
- Added exact `maintenance.work_order.*` CRUD/workflow permission aliases while preserving legacy permission compatibility.
- Removed detail-only prefetches from list/dashboard requests and added relation-aware detail prefetches to prevent nested-user N+1 queries.
- Corrected the labor prefetch relation from the invalid `technician` name to `performed_by`.
- Updated maintenance seed behavior to create/select users within the seeded tenant.
- Added accessible names to maintenance workflow, assignment, and escalation dialogs.
- Added lifecycle, tenant isolation, exact RBAC, and query-count regression coverage.

## API Inventory

- Work orders: list, create, retrieve, partial update, search, filters, sorting, pagination, dashboard, history.
- Status actions: submit, start, hold, resume, complete, cancel, reopen.
- Assignment: assign, reassign, unassign, assignment history, tenant-scoped candidates.
- SLA: retrieve and recalculate.
- Escalation: history, acknowledge, resolve.
- `PUT` and `DELETE` are intentionally not enabled for maintenance work orders; updates use `PATCH`, and workflow state replaces destructive deletion.

## Security Verification

- Regular users are restricted to their account tenant.
- Tenantless regular users receive no maintenance queryset data.
- Superusers and users with the explicit `system_admin` role retain global scope.
- Cross-tenant detail lookup returns `404` to avoid disclosing object existence.
- Assignment principals must belong to the work-order tenant.
- Assignment, SLA, and escalation children validate against their parent work-order tenant.
- Backend permission enforcement accepts exact `maintenance.work_order.*`, legacy `maintenance.*`, or `maintenance.manage` according to action.

## Performance Review

- List/dashboard requests no longer prefetch detail collections.
- Detail retrieval uses `select_related` and targeted `Prefetch` querysets for assignments, tasks, labor, status history, escalations, and attachments.
- Regression bounds: list request at most 12 queries; populated detail request at most 20 queries in the test environment.
- Existing database indexes cover status, priority, requested/due timestamps, SLA status, assignment activity, and escalation status/type.

## Automated Validation

- Full backend pytest suite.
- Maintenance lifecycle scenarios: create/assign/start/complete, hold/resume/complete, cancel/reopen/reassign/complete, and overdue/escalation resolution.
- Tenant isolation and exact permission regression tests.
- Django system and migration consistency checks.
- Black and isort checks on changed backend files.
- Flake8 with Black-compatible line-length exclusions.
- Frontend ESLint and TypeScript checks.
- Next.js production build, including all maintenance routes.

## Known Limitations

- The frontend repository has no Vitest dependency or frontend test files, so component/hook tests cannot run without introducing a new test-tooling feature. ESLint, TypeScript, and the production build are the available automated frontend gates.
- Ruff is not installed; the repository development requirements provide Black, isort, and flake8 instead.
- Celery SLA checking exists, but periodic Beat scheduling remains deployment configuration.
- Notification delivery is not implemented.
- Core create/update APIs do not persist form planning line items or new attachment uploads; those controls remain explicitly capability-limited rather than silently discarding data.

No critical or high-severity maintenance defects remain after this QA cycle.

