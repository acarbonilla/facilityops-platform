# FO-075 - Employee Role and Requester Authorization Foundation

## Status

Backend foundation implemented on `feature/employee-requester`. Independently
approved at `513977a66e69c572948e8a22af24da23ab81f99d`. FO-076 Employee My
Requests frontend is implemented on the same branch. The cumulative Employee
Requester pull request remains open, draft, and unmerged. FO-077 and FO-078
have not started.

## Objective

Introduce the immutable Employee system role and enforce backend-authoritative,
requester-owned FM Ticket access without weakening Tenant isolation, Master
Data authorization, or existing operational roles.

## Employee role contract

- Name: Employee
- Code: `employee`
- Active immutable system role
- Permissions:
  - `fm_tickets.view`
  - `fm_tickets.create`

The Employee role receives no update, assignment, close, management,
Maintenance, Inspection, Reporting, Master Data, User, or Role permission.
Viewer remains unchanged. RBAC reseeding is idempotent and deactivates any
unexpected legacy Employee role-permission assignment before restoring the
approved two-permission contract.

## Eligibility

Employee requester access requires:

- an active authenticated user
- an active Employee role and role assignment
- an active, non-deleted Tenant
- an active, non-deleted Organization in that Tenant

Employee-only users without an eligible Tenant or Organization fail closed.
No User schema field or migration was added.

## Requester ownership

Active superusers and active `system_admin` users retain existing global
general FM Ticket scope. An Employee whose broadest active FM Ticket view role
is Employee is restricted to non-deleted Tickets matching both the
authenticated Tenant and `requester=request.user`.

Facility Manager, Technician, Viewer, and custom active roles that independently
grant `fm_tickets.view` retain their existing Tenant-wide scope. An Employee
gains broader visibility only through such a separately active role. Tenant
and requester ownership are applied before URL filters, so filters cannot
broaden access. Non-owned same-Tenant and cross-Tenant UUIDs return the same
generic 404 behavior. `is_staff` alone grants no bypass.

FO-061's caller-Tenant checks remain unchanged for assignment and Work Order
generation, including the no-global-bypass contract.

## Requester-safe responses

Employee list and detail responses use dedicated serializers. They expose the
request number, safe Organization/location references and names, title,
description, category, priority, status, and public lifecycle timestamps.

They do not expose requester or assignee identities, Tenant identifiers, SLA
internals, escalation details, linked Work Order data, due dates, internal
notes, or raw operational history metadata. Existing raw comments, history,
and escalation endpoints return 404 for Employee-only requester scope.
Employee comments remain deferred to FO-077. Existing operational serializers
and endpoints remain unchanged.

## Safe creation contract

Employee request input accepts only:

- title
- description
- category
- building
- optional floor
- optional area
- optional asset

The backend fixes requester to the authenticated user, Tenant and Organization
to the authenticated account, source to `web`, priority to `medium`, and status
to `open`. Employee attempts to submit requester, Tenant, Organization,
Department, source, priority, status, assignee, due dates, SLA fields, or
workflow timestamps are explicitly rejected.

Building, Floor, Area, and Asset choices must be active, non-deleted, within the
Employee Tenant and Organization, and consistent with the selected hierarchy.
Rejected requests create no Ticket, history, notification, or Work Order.

## Request-options endpoint

Exact route:

`GET /api/fm-tickets/tickets/request-options/`

The endpoint requires authenticated Employee creation eligibility and derives
Tenant and Organization from the user. Client Tenant or Organization scope
parameters are rejected. It does not require or grant `settings.view`.

Response contract:

- `organization`: `id`, `name`
- `buildings`: `id`, `name`
- `floors`: `id`, `name`, `building_id`
- `areas`: `id`, `name`, `building_id`, `floor_id`
- `assets`: `id`, `name`, `building_id`, `floor_id`, `area_id`
- `categories`: `value`, `label`

Only active, non-deleted, same-Tenant and same-Organization choices are
returned. Addresses, descriptions, serial numbers, audit fields, lifecycle
metadata, and unrelated Tenant or Organization records are excluded.

## Validation

- Focused Employee/RBAC/requester tests: 21 passed.
- FM Ticket suite: 101 passed before two final eligibility test-only additions;
  the final 21-test focused class and 633-test full backend suite include those
  additions.
- Accounts + Access Control: 113 passed.
- Notifications: 78 passed.
- Maintenance: 85 passed.
- Full backend parallel suite: 633 passed.
- Django check: passed.
- Migration drift: none.

No production frontend file changed. The previous 227-test, ESLint, TypeScript,
and production-build baseline is retained without rerunning the complete
frontend suite.

## Deferred scope

FO-076 Employee My Requests frontend is implemented on the branch. FO-077
requester workflow and notification alignment, and FO-078 cumulative QA have
not started. Employee comments, cancellation, resolution acknowledgement, and
requester-safe activity remain deferred to FO-077. Attachment upload and AI
integration remain deferred. FO-063 automatic Ticket closure remains
reserved/deferred.

## Schema and dependency confirmation

FO-075 adds no model field, migration, dependency, lockfile, frontend route, or
navigation change.
