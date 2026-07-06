# FO-026 - FM Ticketing Create/Edit Forms

## Task ID

FO-026

## Task Title

FM Ticketing Create/Edit Forms

## Purpose

FO-026 adds frontend create and edit capability to FM Ticketing on top of the backend foundation from FO-024 and the read screens introduced in FO-025. The scope is limited to reusable form-driven ticket creation and updates, without expanding into assignment, status workflow, comments, attachments, or automation.

## Scope

- FM Ticketing create, update, and form value types
- Authenticated create and update API functions
- Zod validation for reusable FM ticket form values
- Reusable React Hook Form ticket form component
- Permission-guarded create and edit routes
- TanStack Query mutations with FM ticket query invalidation
- Permission-aware create and edit action links in read screens
- README and development documentation updates

Out of scope:

- Assignment UI
- Status-change or close workflow
- Comment creation
- File attachments
- Notifications
- SLA or escalation automation
- AI recommendations
- Maintenance work orders

## Backend Endpoints Used

- `GET /api/fm-tickets/tickets/{id}/`
- `POST /api/fm-tickets/tickets/`
- `PATCH /api/fm-tickets/tickets/{id}/`

Actual serializer behavior consumed by the frontend:

- `source` and `due_at` are writable in create and update flows
- `status` is read-only on create and not accepted on update
- `assignee` is not accepted by the current create or update serializers
- Optional location fields are submitted as `null` when the form leaves them blank

## Frontend Routes Created

- `/fm-tickets/new`
- `/fm-tickets/[id]/edit`

## Types Added

Updated file: `frontend/types/fm-tickets.ts`

Added:

- `FmTicketCreatePayload`
- `FmTicketUpdatePayload`
- `FmTicketFormValues`
- `FmTicketFormOption`

## API Functions Added

Updated file: `frontend/services/api/fm-tickets.ts`

Added:

- `createFmTicket`
- `updateFmTicket`

## Validation Schema

File: `frontend/lib/validations/fm-tickets.ts`

Added:

- `fmTicketSchema`

Validation behavior:

- `title`, `description`, `tenant`, `organization`, and `building` are required
- `priority` and `category` are validated against known backend enum values
- `source` defaults to `web`
- `status` defaults to `open` in the form model but is not submitted for workflow changes
- `department`, `floor`, `area`, `asset`, `assignee`, and `due_at` remain optional

## Ticket Form Fields

- Ticket Information: title, description, category, priority, source
- Location: tenant, organization, department, building, floor, area, asset
- Dates: due date
- Status display: current status badge in edit mode only

## Related Select Behavior

- Related master-data options are loaded from the existing tenants, organizations, departments, buildings, floors, areas, and assets endpoints
- Filtering is intentionally client-side and lightweight
- Organizations filter by tenant
- Departments filter by organization when selected, otherwise by tenant
- Buildings filter by tenant and organization
- Floors filter by building
- Areas filter by floor when selected, otherwise by building
- Assets filter by organization, building, floor, and area
- Assignee selection is not rendered because the current backend serializers do not accept assignee updates and the frontend user-management list endpoint is still unavailable

## Permission Assumptions

- `/fm-tickets/new` requires `fm_tickets.create`
- `/fm-tickets/[id]/edit` requires `fm_tickets.update`
- Read/list/detail navigation continues to rely on `fm_tickets.view`
- Backend authorization remains the source of truth

## Known Limitations

- The current backend serializer scope prevents assignee editing and direct status changes from this form task
- Due date is edited with a browser `datetime-local` field and converted to ISO on submit
- Related select data loads with the existing default page size and does not implement pagination-aware option browsing
- Server-side field validation is surfaced as safe API error messaging, but the form does not yet map backend field errors back onto individual client fields

## Validation Commands

Backend:

```text
cd backend
.venv\Scripts\activate
python manage.py check
python manage.py migrate
python manage.py seed_rbac
python manage.py seed_master_data
python manage.py seed_fm_tickets
python manage.py runserver
```

Frontend:

```text
cd frontend
npm install
npm run lint
npm run dev
```

## Next Task Recommendation

FO-027 - FM Ticketing Comments and Status Workflow should build on these create/edit flows and introduce comment-write and status transition UX only after the backend workflow contract is consumed explicitly.
