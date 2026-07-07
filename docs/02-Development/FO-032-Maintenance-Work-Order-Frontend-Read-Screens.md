# FO-032 - Maintenance Work Order Frontend Read Screens

## Task ID

FO-032

## Task Title

Maintenance Work Order Frontend Read Screens

## Purpose

FO-032 adds the complete read-only frontend surface for the Maintenance Work Order module on top of the FO-031 backend foundation. The goal is to let authorized users browse the maintenance dashboard, list work orders with server-side query support, and inspect full work order detail without enabling create or edit workflows yet.

## Scope

- Maintenance dashboard route and summary cards
- Maintenance work order list route
- Backend-driven search, advanced filters, sorting, and pagination
- Maintenance detail route
- Read-only sections for assignment, tasks, materials, labor, attachments, AI summary, SLA, history, completion, and audit
- Frontend maintenance API integration, hooks, and shared types
- Navigation and documentation updates
- Minimal backend read-contract support required by the frontend: metrics, search, ordering, and richer list filters

No maintenance create, edit, approval, status-change, assignment-change, delete, reporting, notification, or file-upload workflow actions were added.

## Routes

- `/maintenance`
- `/maintenance/work-orders`
- `/maintenance/work-orders/[id]`

All routes remain guarded by `maintenance.view`.

## Delivered Frontend Pieces

- New frontend types in `frontend/types/maintenance.ts`
- New maintenance API layer in `frontend/services/api/maintenance.ts`
- New maintenance query hooks:
  - `use-maintenance-dashboard`
  - `use-maintenance-list`
  - `use-maintenance-detail`
  - `use-maintenance-history`
- New maintenance components under `frontend/features/maintenance/components/`
- Sidebar navigation entry for Maintenance

## Read Contract Support Added

Although FO-032 is a frontend task, the existing FO-031 backend read contract needed a few additions so the screens could satisfy the requested behavior honestly:

- dashboard summary endpoint: `/api/maintenance/work-orders/dashboard/`
- backend search across work order number, title, description, asset, assignee, requester, and location fields
- backend ordering support for number, title, priority, status, created, updated, due date, and requested date
- overdue and attachment filters
- requester-email and assignee-email filters
- list serializer additions for location names, asset code, attachment count, and audit timestamps

## UI Notes

- The dashboard shows total work orders, status mix, overdue load, high-priority counts, critical counts, and recently updated counts.
- The list screen uses backend-driven query parameters rather than client-only filtering.
- The detail screen intentionally renders unavailable placeholders for fields the backend foundation does not yet expose, such as category, maintenance type, QR code, rate, and version history.
- Attachments are metadata-only during this phase, so preview and download actions stay visibly unavailable.

## Validation Commands Executed

Backend:

```text
cd backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe -m pytest apps\maintenance\tests\test_maintenance.py -x
```

Frontend:

```text
cd frontend
npm run lint
.\node_modules\.bin\tsc.cmd --noEmit
```

Production build probing:

```text
npx next build --no-lint
```

## Validation Outcome

- Backend maintenance read-contract tests passed after adding metrics, search, ordering, and richer filters.
- Frontend lint passed.
- Frontend TypeScript compilation passed.
- The local Next production build did not surface a compile error in the captured log before timing out on this host. The log showed startup into the standard Next build phase and then stalled, which matches the known slow local build behavior in this environment.

## Known Limitations

- The current backend foundation still does not expose category, maintenance type, estimated hours, rate, total cost, QR code, or version history fields; the UI marks those as unavailable instead of faking values.
- There is still no dedicated frontend component-test harness in this repository stage, so FO-032 validation relied on lint, TypeScript, and integrated backend contract checks rather than browser-side unit tests.
- The local production build remains environment-limited by slow execution on this host and should be rechecked in a cleaner or faster environment if a strict build artifact gate is required.

## Outcome

FO-032 is complete for the approved read-only frontend scope. The repository is ready to proceed to FO-033 for maintenance create and edit forms.
