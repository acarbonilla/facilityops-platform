# FO-033 - Maintenance Work Order Create and Edit Forms

## Task ID

FO-033

## Task Title

Maintenance Work Order Create and Edit Forms

## Purpose

FO-033 adds the maintenance work-order create and edit frontend flow on top of the FO-031 backend foundation and FO-032 read screens. The goal is to let authorized users create and update the persisted maintenance work-order record while keeping later workflow and line-item features visibly out of scope where the backend is not ready yet.

## Scope Delivered

- New maintenance routes:
  - `/maintenance/work-orders/new`
  - `/maintenance/work-orders/[id]/edit`
- Reusable maintenance form components for:
  - basic information
  - asset and location
  - assignment planning
  - schedule
  - task rows
  - material rows
  - labor rows
  - attachment placeholder
  - form actions
- Client-side validation with Zod and React Hook Form
- Backend integration for:
  - `createMaintenanceWorkOrder`
  - `updateMaintenanceWorkOrder`
  - `getMaintenanceFormOptions`
- Maintenance form hooks:
  - `useCreateMaintenanceWorkOrder`
  - `useUpdateMaintenanceWorkOrder`
  - `useMaintenanceFormOptions`
  - `useMaintenanceFormDefaults`
- Permission-gated navigation and page access using:
  - `maintenance.create`
  - `maintenance.update`
  - `maintenance.view`
- Success redirect back to work-order detail with one-time flash messaging
- Unsaved-change warning for in-form navigation

## Important Backend Contract Limits

The current backend create and update serializers still only persist the core work-order record:

- tenant
- organization
- department
- building
- floor
- area
- asset
- title
- description
- priority
- scheduled start/end
- due date

The following form areas are intentionally visible but marked as pending or planning-only because the backend contract does not persist them yet:

- maintenance category
- maintenance type
- notes
- assignment planning fields
- task rows
- material rows
- labor rows
- attachments
- save draft

This keeps the UI aligned with the approved FO-033 scope without faking backend support that does not exist yet.

## Validation Behavior

- Title is required
- Maintenance type is required
- Priority is required
- Requested by is required
- Asset or location context is required
- Due date cannot be before requested date
- Estimated completion date cannot be before estimated start date
- Estimated hours must be positive when provided
- Task estimated hours must be positive
- Material quantity must be positive
- Labor estimated hours must be positive
- Empty task, material, and labor rows are filtered out before submit

## RBAC Behavior

- `New Work Order` button is shown only with `maintenance.create`
- `Edit work order` button is shown only with `maintenance.update`
- Create route is guarded by `maintenance.create`
- Edit route is guarded by `maintenance.update`
- Existing dashboard, list, and detail routes remain guarded by `maintenance.view`

## Validation Commands Executed

Frontend:

```text
cd frontend
npm run lint
.\node_modules\.bin\tsc.cmd --noEmit
```

## Validation Outcome

- Frontend lint passed.
- Frontend TypeScript compilation passed.
- No dedicated frontend component-test harness exists in the repository yet, so FO-033 validation remains limited to lint, type-checking, and implementation review.

## Outcome

FO-033 is complete for the approved frontend create/edit scope. The repository is ready to proceed to later maintenance workflow tasks, with the known limitation that richer planning fields still need backend write support before they can persist beyond the current form session.
