# FO-035 - Maintenance Work Order Assignment Workflow

## Status

Complete

## Delivered

- Dedicated assignment service for assign, reassign, and unassign operations.
- Assignment history with tenant, technician, supervisor, previous principals, actor, type, status, reason, notes, and timestamps.
- Required assignment endpoints plus a work-order-scoped candidate endpoint for frontend selectors.
- Backend validation for permissions, active users, available role data, distinct technician/supervisor users, terminal work-order states, and required reasons.
- Status updates for `open/reopened -> assigned` and `assigned -> open` on unassignment.
- Frontend assignment card, assign/reassign/unassign dialogs, technician/supervisor selectors, history timeline, hooks, API methods, cache invalidation, inline errors, and success messages.

## Endpoints

- `POST /api/maintenance/work-orders/{id}/assign/`
- `POST /api/maintenance/work-orders/{id}/reassign/`
- `POST /api/maintenance/work-orders/{id}/unassign/`
- `GET /api/maintenance/work-orders/{id}/assignments/`
- `GET /api/maintenance/work-orders/{id}/assignment-candidates/`

## Permissions

FO-035 seeds and enforces:

- `maintenance.work_order.assign`
- `maintenance.work_order.reassign`
- `maintenance.work_order.unassign`
- `maintenance.work_order.view_assignment`

The existing `maintenance.assign`, `maintenance.reassign`, `maintenance.unassign`, `maintenance.view_assignment`, and `maintenance.manage` codes remain accepted for compatibility.

## Tenant Boundary Note

Each new assignment persists the work-order tenant and the model rejects a tenant that differs from its work order. The current account model has no user-to-tenant or user-to-organization membership relation, so user membership cannot be independently checked without a future accounts-domain schema change. The candidate endpoint is work-order scoped so that membership filtering can be added at that boundary when membership data exists.

## Notifications

No notification service or assignment notification event bus exists in the repository, so FO-035 does not add a fake notification integration.

## Verification

- Django system checks and maintenance backend tests.
- Migration consistency check.
- Frontend ESLint and TypeScript compilation.

