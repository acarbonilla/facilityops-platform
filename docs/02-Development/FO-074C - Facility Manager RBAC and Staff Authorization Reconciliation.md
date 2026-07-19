# FO-074C - Facility Manager RBAC and Staff Authorization Reconciliation

## Status

Implementation commit `b65ccc7b2f104eca06404de36636d1416c319f5e`,
focused regression coverage, affected-suite validation, local seed
reconciliation, and documentation are complete. Manual smoke, final cumulative
validation, user manual acceptance, and Sol's cumulative final review remain
pending. PR #40 remains open, draft, and unmerged.

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

## Remaining gates

Manual smoke remains pending. The final full suite is deferred until all manual
acceptance issues are resolved. FO-075 has not started. PR #40 remains draft
and unmerged.
