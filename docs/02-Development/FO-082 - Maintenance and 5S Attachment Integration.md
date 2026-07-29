# FO-082 — Maintenance and 5S Attachment Integration

**Status:** Implemented and validated on `feature/business-module-attachments`  
**Date:** 2026-07-29  
**Starting branch SHA:** `4bc61758750e827b9bd9da4cb2cb058806472c75` (FO-081 HEAD)  
**Draft PR:** #47 (OPEN, Draft — not ready for merge)

## Summary

FO-082 extends the shared FO-079/FO-080/FO-081 attachment platform to:

1. Maintenance Work Orders (`owner_type=maintenance_work_order`)
2. 5S Inspections (`owner_type=inspection`)

Both modules reuse centralized owner-access authorization, secure storage/download, soft delete, and FO-080 UI components. Employee Requesters remain isolated from Maintenance and inspection evidence. FO-083 has **not** started.

## Owner types

| Code | Module |
| --- | --- |
| `fm_ticket` | FM Tickets (FO-081) |
| `maintenance_work_order` | Maintenance Work Orders (FO-082) |
| `inspection` | 5S Inspections (FO-082) |

No new attachment tables. No migration (owner_type is an unconstrained CharField).

## Owner-access architecture

`apps.attachments.owner_access` resolves owner object, tenant, module permissions, workflow state, and visibility for list/upload/view/download/delete.

### Maintenance

- View: `maintenance.view` \| `maintenance.work_order.view` \| `maintenance.manage` + tenant-scoped WO
- Upload: view + (`maintenance.update` \| `maintenance.work_order.update` \| `maintenance.manage`) + mutable status
- Delete: `attachments.delete` + contribute + mutable status
- Immutable statuses: `completed`, `cancelled`, `closed`
- Visibility: always `internal_only` (requester_visible rejected)

### 5S Inspection

- View: `inspection.view` \| `inspection.manage` + tenant-scoped inspection
- Upload: view + (`inspection.update` \| `inspection.manage`) + mutable status
- Delete: `attachments.delete` + contribute + mutable status
- Immutable statuses: `completed`, `verified`, `cancelled`
- Visibility: always `internal_only`

### Requester isolation

Employee requesters receive generic 404 for Maintenance and inspection owner contexts and attachment IDs. My Requests continues to show only FO-081 requester-visible FM Ticket attachments.

## UI integration

| Surface | Component |
| --- | --- |
| `/maintenance/work-orders/[id]` | `MaintenanceWorkOrderAttachments` |
| `/inspection/inspections/[id]` | `InspectionAttachments` |

Both wrap FO-080 `AttachmentUploader` / `AttachmentList`.

## 5S → FM Ticket boundary

No automatic ownership transfer, file copy, or duplicate records when defects relate to tickets. Inspection attachments remain owned by the inspection. Generated tickets do not inherit inspection files.

## Notifications

No attachment upload/delete notification events. Existing Maintenance/5S/FM notification behavior unchanged.

## Tests

Backend: `test_maintenance_inspection_attachments.py` — authorized CRUD, cross-tenant denial, terminal locks, requester isolation, FO-081 regression, visibility rejection, audit metadata.

Frontend: `lib/maintenance/attachments.test.ts`, `lib/inspection/attachments.test.ts`.

## Validation

| Check | Result |
| --- | --- |
| Focused FO-082 backend | 18 passed |
| Attachment backend (FO-079+081+082) | 52 passed |
| Related regression | 137 passed |
| Full backend | **743 passed** (baseline 725) |
| Focused FO-082 frontend | 8 passed |
| Full frontend | **303 passed** (baseline 295) |
| ESLint / TypeScript / production build | passed |
| Django check / migration drift | passed / none |

## Manual acceptance

Environment: isolated fixtures for Tenant A/B, FM/technician/viewer/employee, mutable and terminal work orders and inspections, JPEG/PDF.

Method: FO-082 focused API suite covering authorized CRUD, cross-tenant denial, terminal locks, requester isolation, FO-081 regression, plus UI wiring on Maintenance and inspection detail pages with production build confirmation.

Result: **Passed**.

## Deferred

FO-083 QA/stabilization/merge; galleries; finding-level bindings; attachment transfer to tickets; AI/OCR; S3; attachment notifications.

## Grouped feature status

- FO-081 complete on shared branch
- FO-082 implemented on shared branch
- FO-083 not started
- Do not merge Draft PR #47 until FO-083
