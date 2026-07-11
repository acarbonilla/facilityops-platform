# FO-043 - 5S Inspection AI Analysis

## Scope

FO-043 completes the current inspection AI-analysis foundation without introducing an external AI provider.

Included:

- Method-correct backend AI-analysis permissions
- Structured inspection AI context preparation
- Stored AI-analysis create/update validation
- Frontend AI-analysis read and edit UI
- Backend and frontend validation
- Documentation and tracker updates

Explicitly excluded:

- OpenAI, Gemini, Anthropic, or any other external AI provider integration
- Background jobs or asynchronous AI processing
- Image analysis
- Automatic corrective-action creation
- Automatic workflow or status decisions
- Automatic verification or approval
- FO-044 module-wide QA

## Delivered

### Backend

- Split `GET` and `POST` permissions for `/api/inspection/inspections/{id}/ai-analysis/`:
  - `GET`: `inspection.view_ai` or `inspection.manage`
  - `POST`: `inspection.update` or `inspection.manage`
- Added deterministic `build_inspection_ai_context(inspection=...)` in `backend/apps/inspection/services/inspection_ai_service.py`
- Structured context now exposes:
  - inspection summary fields
  - location names
  - checklist rows
  - findings
  - corrective actions
  - summary counts
- Hardened `InspectionAISerializer` so:
  - `summary`, `analysis`, and `recommendation_summary` may each remain blank individually
  - at least one of those three fields is required on `POST`
  - completely empty submissions are rejected
  - `model_name` defaults to `manual` when omitted or blank
  - `payload` is normalized to a JSON object
  - optional `context_preview` is exposed as a read-only serializer field
- Secured inspection detail serialization so users without `inspection.view_ai` or `inspection.manage` do not receive nested AI-analysis data through the main inspection detail payload
- Preserved the repository constraint that AI analysis is stored only through `upsert_ai_analysis()` and does not invoke any external provider

### Frontend

- Added AI-analysis types, form values, and payload contracts in `frontend/types/inspection.ts`
- Added AI-analysis mapping helpers in `frontend/lib/inspection/ai-analysis.ts`
- Added AI-analysis zod validation in `frontend/lib/validations/inspection-ai.ts`
- Added `saveInspectionAIAnalysis(id, payload)` in `frontend/services/api/inspection.ts`
- Added `useSaveInspectionAIAnalysis` mutation hook with invalidation for:
  - `inspectionQueryKeys.all`
  - `inspectionQueryKeys.detail(id)`
  - `inspectionQueryKeys.aiAnalysis(id)`
  - `inspectionQueryKeys.history(id)`
- Replaced the read-only detail card with `InspectionAIAnalysis` in `frontend/features/inspection/components/inspection-ai-analysis.tsx`
- Delivered UI behavior for authorized users:
  - read view for stored AI analysis
  - add/edit/save controls
  - cancel editing
  - validation feedback
  - API error feedback
  - success feedback
  - stored payload preview
  - backend context preview
- Added the advisory notice:
  - “AI-assisted analysis is advisory only. Inspectors and supervisors remain responsible for validating findings, recommendations, and final decisions.”

## Permission Behavior

- Users with `inspection.view_ai` can read stored AI analysis through the dedicated endpoint
- Users with only `inspection.view_ai` cannot create or overwrite AI analysis
- Users with `inspection.update` can create the first AI-analysis record when none exists
- Users with only `inspection.update` cannot overwrite an existing AI-analysis record they are not allowed to view
- Users with `inspection.manage` can read and save AI analysis
- Inspection detail still requires `inspection.view` or `inspection.manage`, but nested AI-analysis data is only serialized for users with AI-read permission
- Inspection detail exposes a safe `ai_analysis_exists` flag so update-only users can avoid a blind overwrite path in the frontend

## Notes

- No external AI provider is connected in this repository
- `model_name` defaults to `manual` when not supplied
- Stored AI output remains advisory only
- Inspectors and supervisors retain final decision authority
- Findings, corrective actions, and inspection status are not automatically changed by AI-analysis saves

## Validation

Backend validation from `backend`:

- `.\.venv\Scripts\python.exe manage.py check` - passed
- `.\.venv\Scripts\python.exe manage.py makemigrations --check` - passed
- `.\.venv\Scripts\python.exe -m pytest apps\inspection\tests\test_inspection.py -q` - passed

Frontend validation from `frontend`:

- `npm run lint` - passed
- `npm run build` - passed

Notes:

- Windows sandboxed Node commands failed with `EPERM` under `C:\Users\dc`, so frontend lint and build were rerun outside the sandbox
- The Next.js build temporarily rewrote `frontend/tsconfig.json` and `frontend/next-env.d.ts`; pre-build snapshots were restored after validation so no generated config edits remain from the build run
- Browser-based manual smoke testing was not executed in this terminal session

## Result

FO-043 implements secure stored AI-analysis review for inspections, adds deterministic inspection context preparation, preserves manual human review authority, and keeps the repository aligned with its current non-provider AI foundation.
