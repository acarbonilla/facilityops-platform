# FO-031 - Maintenance Work Order Backend Foundation

## Task ID

FO-031

## Task Title

Maintenance Work Order Backend Foundation

## Purpose

FO-031 introduces the first backend foundation for Maintenance Work Orders so the platform can move beyond FM Ticketing into the next business workflow without adding frontend maintenance screens or non-approved features.

## Scope

- Maintenance backend app registration and API routing
- Maintenance work order domain models and initial migration
- Work order serializers, permissions, filters, services, and viewset actions
- Seed data for development validation
- RBAC seed updates for maintenance permissions
- Backend automated tests and documentation updates

No maintenance frontend screens, notifications, file uploads, reporting, AI automation, or deployment work were added.

## Delivered Backend Foundation

- New backend app: `apps.maintenance`
- API base path: `/api/maintenance/work-orders/`
- Workflow actions:
  - `POST /api/maintenance/work-orders/`
  - `GET /api/maintenance/work-orders/`
  - `GET /api/maintenance/work-orders/{id}/`
  - `PATCH /api/maintenance/work-orders/{id}/`
  - `GET /api/maintenance/work-orders/{id}/history/`
  - `POST /api/maintenance/work-orders/{id}/assign/`
  - `POST /api/maintenance/work-orders/{id}/status/`
  - `POST /api/maintenance/work-orders/{id}/complete/`
- Seed command: `python manage.py seed_maintenance`
- Maintenance RBAC permissions:
  - `maintenance.view`
  - `maintenance.create`
  - `maintenance.update`
  - `maintenance.assign`
  - `maintenance.complete`
  - `maintenance.manage`

## Core Data Model

- `MaintenanceWorkOrder`
- `MaintenanceAssignment`
- `MaintenanceTask`
- `MaintenanceMaterial`
- `MaintenanceLabor`
- `MaintenanceAttachment`
- `MaintenanceAISummary`
- `MaintenanceSupervisorApproval`
- `MaintenanceCompletion`
- `MaintenanceHistory`
- `MaintenanceStatusHistory`
- `MaintenanceEscalation`
- `MaintenanceSLA`

The work order model enforces tenant and asset context, requester ownership, lifecycle timestamps, location consistency, status transition rules, and cancellation-reason validation.

## Validation Checklist

- [x] App is registered in Django settings
- [x] Maintenance API routes are wired into the shared API router
- [x] Initial maintenance migration is created and applied
- [x] Seed command is idempotent
- [x] RBAC seed contains maintenance permissions
- [x] Work order list and detail APIs pass test coverage
- [x] Work order create and update APIs pass test coverage
- [x] Assignment, status, completion, and history flows pass test coverage
- [x] Full backend pytest suite passes
- [x] README is updated
- [x] Development documentation is updated
- [x] No frontend maintenance scope was introduced
- [x] No reporting, AI automation, notifications, attachments, or deployment work was introduced beyond backend foundation placeholders already allowed by the task

## Commands Executed

```text
cd backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations maintenance
.\.venv\Scripts\python.exe manage.py makemigrations --check
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed_rbac
.\.venv\Scripts\python.exe manage.py seed_master_data
.\.venv\Scripts\python.exe manage.py seed_maintenance
.\.venv\Scripts\python.exe -m pytest
```

## Stabilization Notes

- The maintenance seed command now runs cleanly after migrations and remains idempotent on repeated execution.
- The RBAC seed regression test was updated to assert against the seeded role and permission definitions instead of the old FM-only hard-coded totals.
- Full backend regression coverage passed after the maintenance module was added.

## Outcome

FO-031 is complete for backend foundation scope. The repository is ready for the next approved maintenance-module task without reopening FM Ticketing stabilization work.
