# FO-042 - 5S Inspection Findings & Corrective Actions

## Scope

FO-042 adds frontend-only create, edit, and delete management for inspection findings and corrective actions using the existing backend APIs and RBAC rules.

Included:

- Findings CRUD from inspection detail
- Corrective action CRUD from inspection detail
- Frontend payload helpers, validation, and mutation hooks
- Permission-aware management visibility
- FO-042 documentation and tracker updates

Explicitly excluded:

- Backend changes
- AI execution
- Workflow status actions
- File upload implementation

## Delivered

### API wiring

- Added collection/detail endpoints in `frontend/services/api/endpoints.ts`:
  - `inspection.findingsCollection`
  - `inspection.finding(id)`
  - `inspection.correctiveActionsCollection`
  - `inspection.correctiveAction(id)`
- Added CRUD functions in `frontend/services/api/inspection.ts`:
  - `createInspectionFinding`
  - `updateInspectionFinding`
  - `deleteInspectionFinding`
  - `createInspectionCorrectiveAction`
  - `updateInspectionCorrectiveAction`
  - `deleteInspectionCorrectiveAction`

### Types, helpers, and validation

- Extended `frontend/types/inspection.ts` with:
  - finding and corrective-action status/type unions
  - `InspectionFindingFormValues`
  - `InspectionFindingCreatePayload`
  - `InspectionFindingUpdatePayload`
  - `InspectionCorrectiveActionFormValues`
  - `InspectionCorrectiveActionCreatePayload`
  - `InspectionCorrectiveActionUpdatePayload`
- Added `frontend/lib/inspection/findings.ts` for empty defaults and form-to-payload mapping
- Added `frontend/lib/validations/inspection-findings.ts` for zod validation of both dialog forms

### Hooks

- Added a shared invalidation helper in `frontend/hooks/use-inspection-record-mutation.ts`
- Added CRUD hooks:
  - `use-create-inspection-finding.ts`
  - `use-update-inspection-finding.ts`
  - `use-delete-inspection-finding.ts`
  - `use-create-inspection-corrective-action.ts`
  - `use-update-inspection-corrective-action.ts`
  - `use-delete-inspection-corrective-action.ts`
- Each successful mutation invalidates:
  - `inspectionQueryKeys.all`
  - `inspectionQueryKeys.detail(inspectionId)`
  - `inspectionQueryKeys.findings(inspectionId)`
  - `inspectionQueryKeys.correctiveActions(inspectionId)`

### UI

- Added `frontend/features/inspection/components/inspection-findings-actions.tsx`
- Delivered:
  - Findings management card
  - Corrective actions management card
  - Create/edit finding dialogs
  - Delete finding confirmation
  - Create/edit corrective action dialogs
  - Delete corrective action confirmation
  - Shared success and error feedback
- Integrated management controls into `frontend/features/inspection/components/inspection-detail.tsx` between the existing findings and corrective-action tables

## Permission behavior

Findings:

- Create and edit require `inspection.update` or `inspection.manage`
- Delete requires `inspection.delete` or `inspection.manage`

Corrective actions:

- Create and edit require `inspection.manage_corrective_action` or `inspection.manage`
- Delete requires `inspection.delete` or `inspection.manage`

## UX constraints kept

- No binary upload UI was added
- `photo_path` remains metadata text only
- `assigned_to` remains raw UUID input because the frontend still has no supported user-directory picker
- Finding item selection reuses inspection items already present on the detail payload
- Corrective-action finding selection reuses findings already present on the detail payload

## Validation

Validation was run from `frontend`:

- `npm run lint` - passed
- `npm run build` - passed

Notes:

- Initial sandboxed runs failed with a Windows `EPERM` path-resolution error under `C:\Users\dc`, so the required commands were rerun outside the sandbox.
- The build script temporarily rewrote `frontend/tsconfig.json` and `frontend/next-env.d.ts` with a timestamped runtime path. Those generated changes were reverted after validation.
- Manual smoke testing was not executed in this terminal session.

## Result

FO-042 is complete for the approved frontend findings and corrective-actions scope. Inspection detail now supports CRUD management for both related records with RBAC-aware controls and post-mutation refresh behavior, without extending into FO-043 AI work.
