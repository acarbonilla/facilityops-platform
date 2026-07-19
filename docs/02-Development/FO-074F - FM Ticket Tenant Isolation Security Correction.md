# FO-074F - FM Ticket Tenant Isolation Security Correction

## Status

Critical backend security correction implemented, validated, independently
approved by Sol, and manually accepted by the user on
`feature/fm-ticket-tenant-isolation`. The approved implementation HEAD is
`48bde40c40c2942b59a616df623a7f47329b8715`. PR #41 remains open, draft, and
unmerged for the user's ready-for-review and normal merge-commit action.

## Confirmed defect

`FmTicketViewSet.get_queryset()` applied client query filters to an unscoped
platform-wide queryset. A tenant-bound user with an FM Ticket permission could
therefore list or resolve another tenant's ticket. Because standard and custom
detail actions use the same object resolution, the defect affected retrieve,
update, comments, history, escalations, escalation creation, assignment, Work
Order generation, and status changes.

Severity: **Critical**.

## Final access contract

- Active superusers and users with an active `system_admin` role have global
  FM Ticket read/detail scope. FO-061's assignment and Work Order generation
  workflows retain their stricter caller-Tenant match with no global bypass.
- Tenant-bound non-global users are restricted to `user.tenant_id`.
- Tenantless non-global users receive an empty list and generic HTTP 404 for
  object actions.
- `is_staff` alone never grants global scope.
- Soft-deleted tickets never list or resolve.
- Query parameters apply only after authoritative scope and cannot broaden it.
- Permission codes continue to control module actions; requester-only
  visibility is not introduced.

## Implementation

A dedicated FM Ticket scope helper now centralizes global and tenant-bound
queryset behavior. `FmTicketViewSet.get_queryset()` applies that scope first,
excludes soft-deleted tickets, and only then applies allow-listed request
filters. Every object action resolves through the scoped queryset.

Assignment and Work Order generation retain their FO-061 caller-Tenant match
after scoped object resolution. Work Order generation also revalidates that
match in the service after locking the scoped, non-deleted ticket, preserving
generic-404 protection, transaction behavior, and PostgreSQL-compatible row
locking.

## Creation and update hardening

- Tenant-bound creation defaults to and is constrained by the authenticated
  tenant; a supplied other-tenant UUID is rejected.
- Tenantless non-global creation fails closed.
- Global administrators must supply an active, non-deleted eligible Tenant.
- Requester remains `request.user`.
- Organization, Department, Building, Floor, Area, and Asset choices are
  restricted to active, non-deleted records in the actor's allowed scope.
- Existing model validation preserves same-Tenant and hierarchy consistency.
- Ticket tenant reassignment is rejected.
- Cross-tenant relationship substitutions fail without exposing inaccessible
  object details.
- Existing ticket history behavior is preserved.

Assignment and escalation targets are constrained to active users in the
ticket tenant. Existing notification recipient checks and generated Work Order
tenant/assignment validation remain authoritative.

## Protected endpoints and actions

| Surface | Protection |
| --- | --- |
| List and filters | Scoped before filters; deleted excluded |
| Retrieve | Scoped object resolution; cross-tenant 404 |
| Create | Actor-bound tenant and scoped relationships |
| Update / partial update | Scoped object; immutable tenant; scoped relationships |
| Comments GET/POST | Scoped parent ticket |
| History | Scoped parent ticket |
| Escalations GET/POST | Scoped parent and same-tenant target |
| Assignment | Scoped parent and same-tenant active assignee |
| Generate Work Order | Scoped locked ticket and tenant-safe integration |
| Status change | Scoped parent before mutation or notification |

## Regression coverage

Nineteen focused tests cover tenant-specific lists, tenantless fail-closed
behavior, Staff-only scope, active `system_admin` and superuser global scope,
soft-deleted exclusion, non-broadening Tenant filters, generic 404 across all
detail actions, no rejected-request side effects, creation binding, global
creation, related-object lifecycle/scope, immutable tenant updates,
same-tenant workflows, Work Order integration, notification scope, secondary
identities, FO-061's no-global-bypass workflow exception, and in-scope
permission denials.

## Validation

- Final focused isolation class after contract reconciliation: 19 passed.
- `python manage.py test apps.fm_tickets --noinput`: 82 passed.
- `python manage.py test apps.maintenance --noinput`: 85 passed.
- `python manage.py test apps.notifications --noinput`: 78 passed.
- `python manage.py test apps.accounts apps.access_control --noinput`: 113
  passed.
- `python manage.py test --parallel 4 --noinput`: 611 passed, exit 0, before
  the final no-global-bypass regression was added. The subsequent focused
  19-test and complete 82-test FM Ticket runs passed after restoring that
  previously approved FO-061 behavior.
- `python manage.py check`: no issues, exit 0.
- `python manage.py makemigrations --check --dry-run`: no changes, exit 0.

The first final-suite attempt did not execute tests because stale PostgreSQL
test databases and idle test sessions remained from prior infrastructure. Only
`test_facilityops_db` and its numbered clones were terminated/dropped. The one
permitted rerun then passed all 611 tests. This was test infrastructure, not a
product failure.

## Final review and manual acceptance

Sol's independent security review is **APPROVED** at implementation HEAD
`48bde40c40c2942b59a616df623a7f47329b8715`. The user-executed manual
cross-tenant acceptance passed on 2026-07-19 using `debug@example.com`.
Acceptance confirmed that foreign-Tenant Ticket list entries are absent, a
known foreign-Tenant Ticket UUID returns Not Found, Tenant query parameters
cannot broaden access, own-Tenant behavior remains functional, and FO-061
assignment and Work Order generation retain their no-global-bypass contract.

## Frontend and schema

No frontend file changed. The last validated frontend baseline remains 227
tests plus passed ESLint, TypeScript, and production build, with no generated
Next.js drift. No model, migration, dependency, lockfile, endpoint shape, or
frontend contract changed.

## Deferred scope

Employee Requester Experience has not started. FO-075 has not started. FO-063
remains reserved/deferred. Attachment and AI work are not included. FO-074G
records the final independent approval, manual acceptance, and repository/PR
reconciliation.
