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

FO-062B removed non-persisted planning-only controls from the Create/Edit form. Technician and Supervisor assignment is managed from Work Order Details (FO-035 / FO-061A). Attachments, save draft, and create/update line-item persistence remain deferred and are documented as informational guidance rather than interactive fake controls.

## Validation Behavior

- Title is required
- Priority is required
- Requested by is required (display; requester ownership remains session-driven)
- Asset is required
- Building is required
- Due date cannot be before requested date
- Estimated completion date cannot be before estimated start date
- Empty optional location/date fields normalize to null before submit

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

FO-033 remains complete for the approved frontend create/edit scope. FO-062B subsequently removes non-persisted planning controls from the visible form so Create/Edit matches the current create/update API contract. Assignment and status workflows remain on Work Order Details; attachments and line-item persistence remain deferred.
