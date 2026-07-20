# FO-074G - Final FM Ticket Isolation Review and Acceptance Reconciliation

## Status

Sol's independent security review result is **APPROVED**. The user's manual
cross-tenant acceptance passed. FM Ticket tenant isolation is ready for the
user's ready-for-review and normal merge-commit action. PR #41 remains open,
draft, and unmerged.

## Review record

- Review result: APPROVED
- Severity corrected: **Critical**
- Approved implementation HEAD:
  `48bde40c40c2942b59a616df623a7f47329b8715`
- Scope: FO-074F FM Ticket tenant-isolation security correction, including the
  reconciled FO-061 assignment and Work Order generation contract

## Security conclusion

The reviewed implementation applies backend-authoritative FM Ticket scope
before request filters and object resolution. Tenant-bound non-global users
cannot list, retrieve, or act on another Tenant's tickets. Tenantless
non-global users fail closed, `is_staff` alone grants no global scope,
soft-deleted tickets remain excluded, and client-supplied Tenant filters cannot
broaden access. Approved active superusers and active `system_admin` role
holders retain global read/detail scope.

No exploitable cross-tenant path remains in the reviewed FM Ticket scope.

## Manual acceptance

- Result: Passed
- Date: 2026-07-19
- Executor: User
- Cross-tenant account: `debug@example.com`

The user confirmed:

- foreign-Tenant Ticket list entries are absent
- a known foreign-Tenant Ticket UUID returns Not Found
- the Tenant query parameter cannot broaden access
- own-Tenant behavior remains functional
- FO-061 assignment and Work Order generation retain no-global-bypass behavior

## FO-061 contract conclusion

FO-061 assignment and Work Order generation intentionally remain stricter than
general FM Ticket global read/detail scope. Both workflows require the caller's
Tenant to match the Ticket Tenant and provide no superuser or `system_admin`
global bypass. The final implementation and acceptance preserve this approved
contract.

## Validation baseline

- Focused isolation: 19 passed
- FM Ticket suite: 82 passed
- Maintenance: 85 passed
- Notifications: 78 passed
- Accounts + Access Control: 113 passed
- Full backend: 611 passed
- Django check: passed
- Migration drift: none
- Frontend unchanged; previous 227-test, ESLint, TypeScript, and production
  build baseline retained

The automated suites were not rerun for this documentation-only reconciliation.

## Deferred scope

Employee Requester Experience subsequently begins with FO-075 on
`feature/employee-requester`; FO-076 through FO-078 have not started. FO-063
automatic FM Ticket closure remains reserved/deferred. Attachment and AI work
remain outside this correction.

## Repository and PR reconciliation

This task changes Markdown documentation and PR metadata only. It introduces no
backend or frontend production-code change, migration, dependency, lockfile,
generated file, endpoint contract, or unrelated feature work. PR #41
subsequently merged normally to `main` at
`9362338ce6dbfc87e4fe533ebd657825e5d995d1`; its local and remote feature
branches were removed.
