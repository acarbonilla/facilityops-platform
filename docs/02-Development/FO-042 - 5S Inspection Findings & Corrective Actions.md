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

## FO-042A Stabilization

FO-042A applies a small frontend/backend compatibility follow-up without starting FO-043.

Delivered:

- Added the `5S Inspection` sidebar entry for `/inspection/inspections` with `inspection.view` or `inspection.manage`
- Verified locally that all six inspection form-options master-data endpoints accept unfiltered `GET` requests with `page_size=100`
- Identified the failure mode as nullable query filters being serialized into backend requests instead of being omitted
- Hardened shared frontend query handling so `null` and `undefined` query params, including array entries, are removed before requests are sent
- Fixed inspection create payload mapping so a blank `inspection_template` is omitted instead of being sent as `null`
- Fixed inspection checklist payload handling so the default scaffold row is omitted unless the user enters meaningful content
- Fixed checklist item payload mapping so blank optional fields are omitted instead of being sent as explicit empty/null values
- Guarded create-time inspector auto-assignment so users creating for another tenant do not get attached as a cross-tenant inspector

Notes:

- No inspection-specific form-options endpoint needed a mandatory parent filter once nullable query values were stripped
- Backend validation rules for checklist items were not loosened; the frontend now avoids sending placeholder rows and blank optional values
- Backend create behavior changed only to stop auto-assigning a cross-tenant requester as inspector during create

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

Validation was run from `frontend` and `backend`:

- `npm run lint` - passed
- `npm run build` - passed
- `.\.venv\Scripts\python.exe manage.py test apps.inspection.tests.test_inspection.InspectionApiTests.test_inspection_create_sets_history_and_nested_items apps.inspection.tests.test_inspection.InspectionApiTests.test_inspection_create_allows_no_checklist_items apps.inspection.tests.test_inspection.InspectionApiTests.test_inspection_create_allows_partial_checklist_item_payload apps.inspection.tests.test_inspection.InspectionApiTests.test_inspection_create_does_not_auto_assign_cross_tenant_system_admin --keepdb` - passed

Notes:

- Initial sandboxed runs failed with a Windows `EPERM` path-resolution error under `C:\Users\dc`, so the required commands were rerun outside the sandbox.
- The build script temporarily rewrote `frontend/tsconfig.json` and `frontend/next-env.d.ts` with a timestamped runtime path. Pre-build snapshots were restored after validation so no generated config edits remain from the build run.
- Automated validation now covers:
  - inspection creation without checklist items
  - inspection creation with a complete checklist item
  - inspection creation with a partially completed checklist item whose optional fields remain blank

## Result

FO-042 remains complete for the approved findings and corrective-actions scope, and FO-042A closes the follow-up navigation and create-page stability issues by aligning frontend payload/query serialization with the existing backend contracts, suppressing placeholder checklist item submission, and preventing invalid cross-tenant inspector defaults, without extending into FO-043 AI work.
