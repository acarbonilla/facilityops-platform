# FO-040 - 5S Inspection Create and Edit Forms

## Task ID

FO-040

## Task Title

5S Inspection Create and Edit Forms

## Purpose

FO-040 adds the 5S inspection create and edit frontend flow on top of the FO-038 backend foundation and FO-039 read screens. The goal is to let authorized users create and update persisted inspection records, including nested checklist items, while keeping workflow actions, delete actions, and AI execution explicitly out of scope.

## Scope Delivered

- New inspection routes:
  - `/inspection/inspections/new`
  - `/inspection/inspections/[id]/edit`
- Reusable inspection form components for:
  - basic information
  - location
  - assignment and planning
  - checklist items
  - remarks
  - form actions
- Client-side validation with Zod and React Hook Form
- Backend integration for:
  - `createInspection`
  - `updateInspection`
- Inspection form hooks:
  - `useCreateInspection`
  - `useUpdateInspection`
  - `useInspectionFormOptions`
  - `useInspectionFormDefaults`
- Permission-gated navigation and page access using:
  - `inspection.create`
  - `inspection.update`
  - `inspection.manage`
- Success redirect back to inspection detail with one-time flash messaging
- Permission-gated list and detail actions for:
  - `New Inspection`
  - `Edit Inspection`

## Important Frontend Limits

The current frontend still does not have a supported user-directory list API. Because of that:

- inspector and supervisor IDs are preserved for edit flows
- inspector and supervisor fields remain read-only in the form
- create relies on the existing backend behavior that can default the inspector to the current authenticated user

No workflow, delete, corrective-action, attachment-upload, or AI execution UI is added in FO-040.

## Validation Behavior

- Title is required
- Tenant is required
- Organization is required
- Building is required
- Inspection type is required
- 5S category is required
- Priority is required
- Scheduled date must be a valid datetime when provided
- Checklist item is required when a checklist row has content
- Max score must be positive when provided
- Score must be between 0 and max score when provided
- Pass / fail is required when a score is provided
- Empty checklist rows are filtered out before submit

## RBAC Behavior

- `New Inspection` button is shown only with `inspection.create` or `inspection.manage`
- `Edit Inspection` button is shown only with `inspection.update` or `inspection.manage`
- Create route is guarded by `inspection.create` or `inspection.manage`
- Edit route is guarded by `inspection.update` or `inspection.manage`
- Existing list and detail routes remain guarded by `inspection.view` or `inspection.manage`

## Validation Commands Executed

Frontend:

```text
cd frontend
npm run lint
npm run build
```

## Validation Outcome

- Frontend lint passed.
- Frontend production build passed.
- The build confirmed the new routes:
  - `/inspection/inspections/new`
  - `/inspection/inspections/[id]/edit`
- No dedicated frontend component-test harness exists in the repository yet, so FO-040 validation remains limited to lint, production build, and implementation review.

## Outcome

FO-040 is complete for the approved frontend create/edit scope. The repository is ready to proceed to later inspection workflow tasks, with the known limitation that inspector and supervisor selection remain read-only until a supported frontend user-directory API is available.
