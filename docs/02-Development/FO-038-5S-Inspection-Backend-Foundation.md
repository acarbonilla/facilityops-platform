# FO-038 - 5S Inspection Backend Foundation

## Task ID

FO-038

## Task Title

5S Inspection Backend Foundation

## Status

In Progress

## Purpose

FO-038 establishes the backend foundation for the 5S Inspection module so later read, create, and workflow screens can consume a real inspection domain rather than placeholders.

## Scope

- New Django backend app: `apps.inspection`
- Inspection domain models and migration
- Serializers, filters, services, permissions, admin, tasks, and routed API endpoints
- Seed command for development validation
- RBAC seed updates for inspection permissions
- Backend automated tests
- Developer and API documentation updates

No frontend 5S inspection screens were added in this task.

## Delivered Backend Foundation

- App registration: `apps.inspection`
- API base path: `/api/inspection/`
- Primary endpoints:
  - `GET /api/inspection/inspections/`
  - `POST /api/inspection/inspections/`
  - `GET /api/inspection/inspections/{id}/`
  - `PATCH /api/inspection/inspections/{id}/`
  - `GET|POST /api/inspection/inspections/{id}/items/`
  - `GET /api/inspection/inspections/{id}/findings/`
  - `GET|POST /api/inspection/inspections/{id}/attachments/`
  - `GET|POST /api/inspection/inspections/{id}/comments/`
  - `GET /api/inspection/inspections/{id}/history/`
  - `GET /api/inspection/inspections/{id}/corrective-actions/`
  - `GET|POST /api/inspection/inspections/{id}/ai-analysis/`
  - `POST /api/inspection/inspections/{id}/assign/`
  - `POST /api/inspection/inspections/{id}/start/`
  - `POST /api/inspection/inspections/{id}/complete/`
  - `POST /api/inspection/inspections/{id}/verify/`
  - `POST /api/inspection/inspections/{id}/cancel/`
  - `POST /api/inspection/inspections/{id}/reopen/`
  - `GET|POST|PATCH /api/inspection/findings/`
  - `GET|POST|PATCH /api/inspection/corrective-actions/`
- Seed command: `python manage.py seed_inspection`
- Celery task: `inspection.check_inspection_sla_breaches`

## Core Data Model

- `Inspection`
- `InspectionItem`
- `InspectionFinding`
- `InspectionAttachment`
- `InspectionComment`
- `InspectionAssignment`
- `InspectionHistory`
- `InspectionStatusHistory`
- `InspectionAIAnalysis`
- `InspectionCorrectiveAction`
- `InspectionSLA`
- `InspectionEscalation`

The inspection model enforces tenant and location consistency, timestamp coherence, score validation, tenant-scoped user assignments, corrective-action ownership, and workflow status transitions.

## Permissions

- `inspection.view`
- `inspection.create`
- `inspection.update`
- `inspection.delete`
- `inspection.complete`
- `inspection.verify`
- `inspection.assign`
- `inspection.view_ai`
- `inspection.manage_corrective_action`
- `inspection.manage`

## Validation Checklist

- [x] App is registered in Django settings
- [x] Inspection API routes are wired into the shared API router
- [x] Initial inspection migration is created
- [x] Seed command is idempotent
- [x] RBAC seed contains inspection permissions
- [x] Inspection CRUD APIs pass targeted test coverage
- [x] Nested item, comment, attachment, finding, and corrective-action flows pass targeted test coverage
- [x] Workflow and tenant-isolation coverage are implemented
- [x] Developer documentation is updated
- [x] API documentation is updated
- [x] No frontend inspection scope was introduced

## Commands Executed

```text
cd backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations inspection
.\.venv\Scripts\python.exe -m pytest apps\inspection\tests\test_inspection.py
```

## Stabilization Notes

- The module follows the existing maintenance-style service layer rather than placing domain logic in viewsets.
- Tenant isolation uses the same `system_admin` global-scope exception and per-tenant filtering pattern already established in maintenance.
- AI integration is implemented as a persisted hook and metadata endpoint, not as an active external model invocation.

## Outcome

FO-038 backend foundation is implemented and documented. The overall 5S Inspection module remains `In Progress` because frontend read and workflow surfaces are intentionally deferred to later tasks.

