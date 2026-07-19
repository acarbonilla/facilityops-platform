# FO-074C - Facility Manager RBAC and Staff Authorization Reconciliation

## Status

Implementation commit `b65ccc7b2f104eca06404de36636d1416c319f5e`,
focused regression coverage, affected-suite validation, local seed
reconciliation, and documentation are complete. FO-074D records passed user
manual acceptance on 2026-07-19 and the 593-test final cumulative backend gate.
FO-074E records Sol's independent cumulative **APPROVED** review, including
this correction. PR #40 remains open, draft, and unmerged.

## Confirmed defect and severity

The shared frontend permission helpers treated `is_staff` or `is_superuser` as
a universal permission bypass. This was a Medium-severity authorization UX
defect: Staff users could receive unauthorized navigation and controls, while
backend permission checks still rejected unauthorized operations.

Frontend permission helpers now rely only on the authoritative permission-code
response. Backend superusers continue receiving every active permission code
through `get_user_permission_codes()`. Backend `is_staff` does not grant
application permissions or global Tenant scope.

## Facility Manager contract

Facility Manager remains a Tenant-bound, optionally Organization-bound,
non-Staff, non-superuser system role. Existing FM Ticket and Maintenance
operational permissions are unchanged.

The role receives:

- `inspection.view`
- `reporting.view`
- `settings.view`

The role does not receive Inspection mutation permissions,
`inspection.manage`, `settings.manage`, `users.view`, `users.manage`,
`roles.view`, or `roles.manage`. It receives no global/system-administrator
scope. Viewer, Technician, Inspector, and System Administrator mappings are
unchanged. No Employee/Requester role was added.

## Seed reconciliation

Canonical command:

`python manage.py seed_rbac`

The command completed twice with exit code 0, confirming repeat execution is
safe. Required Facility Manager assignments were active after seeding. No
legacy Facility Manager Inspection mutation rows existed in the local
development database, so no local rows required deactivation; focused seed
coverage proves existing legacy assignments are deactivated on reconciliation.

Local Jane-like account verification confirmed:

- `is_active=True`
- `is_staff=False`
- `is_superuser=False`
- active `facility_manager` assignment
- `inspection.view`, `reporting.view`, and `settings.view`
- no `inspection.manage`, `settings.manage`, `users.manage`, or `roles.manage`

## Validation

The already-passed FO-074C baseline was not repeated during delivery
finalization:

- Affected backend suites: 297 passed.
- Frontend: 227 passed.
- ESLint: passed.
- TypeScript: passed.
- Production build: passed.
- Django check: passed.
- Migration drift: clean.

No migration, dependency, lockfile, generated Next.js file, build artifact,
secret, unrelated feature change, or FO-075 work is included.

## Final reconciliation

The user passed manual acceptance on 2026-07-19 with `doejane@gmail.com`, an
active, non-Staff, non-superuser Facility Manager. The user confirmed the
required operational and read-only navigation, tenant-scoped Master Data,
absence of mutation and administrative controls, working lifecycle filters and
tenant isolation, rejection of unauthorized mutation, no Staff requirement,
and no runtime overlay. User-supplied screenshot evidence was provided.

FO-074D's final backend gate passed 593 tests with all required commands at
exit 0. Sol's approved cumulative state includes the removal of the frontend
Staff bypass and the backend-authoritative Facility Manager contract. Master
Data Management is complete on the branch. FO-075 has not started, Employee
Requester Experience remains next, and FO-063 remains reserved/deferred.
PR #40 remains open, draft, and unmerged for the user's ready-for-review and
normal merge-commit action.
