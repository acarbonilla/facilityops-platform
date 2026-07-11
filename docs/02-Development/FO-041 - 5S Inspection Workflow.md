# FO-041 - 5S Inspection Workflow

## Scope

FO-041 adds the frontend-only 5S inspection lifecycle workflow on top of the existing backend inspection workflow endpoints.

Included:

- Assign, start, complete, verify, cancel, and reopen inspection actions
- Permission-aware workflow action visibility on inspection detail
- Frontend request helpers and React Query mutation hooks
- Status timeline rendering from backend `status_history`
- FO-041 documentation and development tracker updates

Explicitly excluded:

- Backend changes
- Findings workflow changes
- Corrective-action workflow UI
- AI execution
- Delete UI

## Delivered

### API wiring

- Added inspection workflow endpoint helpers in `frontend/services/api/endpoints.ts`
- Added workflow API functions in `frontend/services/api/inspection.ts`:
  - `assignInspection`
  - `startInspection`
  - `completeInspection`
  - `verifyInspection`
  - `cancelInspection`
  - `reopenInspection`

### Types and workflow helper

- Extended `frontend/types/inspection.ts` with:
  - `InspectionWorkflowAction`
  - `InspectionSimpleWorkflowPayload`
  - `InspectionAssignPayload`
  - `InspectionCancelPayload`
  - `InspectionReopenPayload`
  - `InspectionStatusHistory`
- Added `frontend/lib/inspection/workflow.ts` to map allowed frontend actions by status:
  - `draft`: `assign`, `cancel`
  - `scheduled`: `start`, `cancel`
  - `in_progress`: `complete`, `cancel`
  - `completed`: `verify`, `reopen`
  - `verified`: `reopen`
  - `cancelled`: `reopen`
  - `reopened`: `assign`, `start`, `cancel`

### Hooks

- Added `frontend/hooks/use-inspection-workflow-mutation.ts`
- Added workflow mutation hooks:
  - `use-assign-inspection.ts`
  - `use-start-inspection.ts`
  - `use-complete-inspection.ts`
  - `use-verify-inspection.ts`
  - `use-cancel-inspection.ts`
  - `use-reopen-inspection.ts`
- Each workflow mutation invalidates:
  - `inspectionQueryKeys.all`
  - `inspectionQueryKeys.detail(id)`
  - `inspectionQueryKeys.history(id)`

### UI

- Added `frontend/features/inspection/components/inspection-workflow-actions.tsx`
- Delivered:
  - Workflow Actions card
  - Current status display
  - Confirmation dialog
  - Assign dialog
  - Cancel dialog
  - Reopen dialog
  - Success message
  - Error state
  - Status timeline from backend `status_history`
- Integrated `InspectionWorkflowActions` and `InspectionStatusTimeline` into `frontend/features/inspection/components/inspection-detail.tsx`

## Permission behavior

- `assign` requires `inspection.assign` or `inspection.manage`
- `start`, `cancel`, and `reopen` require `inspection.update` or `inspection.manage`
- `complete` requires `inspection.complete` or `inspection.manage`
- `verify` requires `inspection.verify` or `inspection.manage`

## Implementation notes

- The workflow UI reuses the established maintenance workflow frontend pattern for action mapping by status, mutation-hook invalidation, modal confirmation flow, and backend-driven timeline rendering.
- The assign dialog uses the shared, searchable `UserDirectoryPicker` for inspector and supervisor while preserving the `inspection.assign` mutation permission and exact backend payload keys.
- The workflow UI stays focused on inspection lifecycle only and does not introduce delete, AI action, or corrective-action workflow controls.

## Validation

Validation was run from `frontend`:

- `npm run lint` - passed
- `npm run build` - passed

Notes:

- The initial sandboxed runs failed with a Windows `EPERM` path-resolution error under `C:\Users\dc`, so the required validation commands were rerun outside the sandbox.
- The build script temporarily rewrote `frontend/tsconfig.json` and `frontend/next-env.d.ts` to point at a timestamped runtime directory. Those generated path changes were reverted after validation so FO-041 does not commit unstable build-artifact references.

## Result

FO-041 is complete for the approved frontend inspection workflow scope. Inspection detail now exposes lifecycle actions based on backend status and frontend permissions, refreshes after successful workflow mutations, and renders backend status-history transitions without extending into FO-042 scope.
