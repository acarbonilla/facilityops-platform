# FO-034 - Maintenance Work Order Status Workflow

## Task ID

FO-034

## Task Title

Maintenance Work Order Status Workflow

## Purpose

FO-034 adds the controlled maintenance work-order status workflow across backend and frontend. The goal is to replace the old generic status-change path with dedicated workflow actions, stronger transition validation, richer status history, permission-aware frontend actions, and auditable workflow metadata.

## Delivered Workflow Actions

Backend and frontend now support:

- `submit`
- `assign`
- `start`
- `hold`
- `resume`
- `complete`
- `cancel`
- `reopen`

## Actual Status Model

The repository now uses these work-order status values:

- `draft`
- `open`
- `assigned`
- `in_progress`
- `on_hold`
- `completed`
- `cancelled`
- `reopened`
- `closed`

`closed` remains in the model for compatibility, but the FO-034 workflow actions are centered on the active transitions below.

## Valid Workflow Transitions

- `draft -> open`
- `open -> assigned`
- `open -> cancelled`
- `assigned -> in_progress`
- `assigned -> cancelled`
- `in_progress -> on_hold`
- `in_progress -> completed`
- `in_progress -> cancelled`
- `on_hold -> in_progress`
- `completed -> reopened`
- `cancelled -> reopened`
- `reopened -> assigned`

Invalid transitions now return backend validation errors.

## Backend Changes

- Added dedicated workflow endpoints under `/api/maintenance/work-orders/{id}/...`
- Added workflow service module:
  - `backend/apps/maintenance/work_order_workflow_service.py`
- Added richer status-history fields:
  - `action`
  - `reason`
  - existing `note`
- Added `actual_hours` to `MaintenanceCompletion`
- Added `reopened` to the maintenance status choices
- Updated RBAC seed data for dedicated workflow permissions
- Replaced the old generic frontend-targeted status action with dedicated workflow actions in the viewset

## Backend Endpoints

- `POST /api/maintenance/work-orders/{id}/submit/`
- `POST /api/maintenance/work-orders/{id}/assign/`
- `POST /api/maintenance/work-orders/{id}/start/`
- `POST /api/maintenance/work-orders/{id}/hold/`
- `POST /api/maintenance/work-orders/{id}/resume/`
- `POST /api/maintenance/work-orders/{id}/complete/`
- `POST /api/maintenance/work-orders/{id}/cancel/`
- `POST /api/maintenance/work-orders/{id}/reopen/`

## Backend Permission Convention

The repository already used `module.action` permission codes, so FO-034 follows that existing convention instead of introducing nested `maintenance.work_order.*` codes.

Workflow permissions now include:

- `maintenance.submit`
- `maintenance.assign`
- `maintenance.start`
- `maintenance.hold`
- `maintenance.resume`
- `maintenance.complete`
- `maintenance.cancel`
- `maintenance.reopen`
- `maintenance.manage`

## Backend Validation Notes

- Hold, cancel, and reopen require `reason`
- Complete requires:
  - `completion_notes`
  - `actual_hours > 0`
  - all recorded tasks to be completed
- Reopen clears the active assignee and returns the work order to a reusable workflow state
- Status history is recorded for every workflow transition with action, reason, and note metadata

## Frontend Changes

- Added workflow API methods in `frontend/services/api/maintenance.ts`
- Added dedicated workflow hooks for all eight actions
- Added new workflow components:
  - `MaintenanceWorkflowActions`
  - `MaintenanceAssignDialog`
  - `MaintenanceHoldDialog`
  - `MaintenanceCompleteDialog`
  - `MaintenanceCancelDialog`
  - `MaintenanceReopenDialog`
  - `MaintenanceWorkflowConfirmDialog`
  - `MaintenanceStatusTimeline`
- Added workflow action area near the maintenance detail header
- Added dedicated status timeline rendering from `status_history`
- Detail screen now refreshes through React Query invalidation after workflow actions

## Frontend Assignment Limitation

The repository still does not expose a general users directory endpoint. Because of that, the new frontend assignment dialog currently assigns the work order to the authenticated user instead of pretending it can browse or search all users.

The backend assignment endpoint itself supports arbitrary user IDs, but the current frontend intentionally stays honest about the missing assignee source.

## Validation Commands Executed

Backend:

```text
cd backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations maintenance
.\.venv\Scripts\python.exe -m pytest apps\maintenance\tests\test_maintenance.py
```

Frontend:

```text
cd frontend
npm run lint
.\node_modules\.bin\tsc.cmd --noEmit
```

## Validation Outcome

- Backend `manage.py check` passed.
- Maintenance backend test suite passed.
- Frontend lint passed.
- Frontend TypeScript compilation passed.

## Outcome

FO-034 is complete for the approved maintenance status workflow scope. The repository is ready to proceed to later maintenance tasks, with the main remaining limitation being richer assignee selection and other later workflow surfaces that still depend on future backend/frontend work.
