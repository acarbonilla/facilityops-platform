# FO-103 — Project Management Foundation

**Status:** Complete on shared feature branch (unmerged)  
**Date:** 2026-08-06  
**Branch:** `feature/project-management`  
**Starting main SHA:** `c7ae7fc81bb58b2afffd33f185910329c04c1231`  
**Branch HEAD (FO-103):** `356eae9fa995d0af91bcbaae22dbddc9467163a1`  
**Commits:** `bb87f80` (backend), `c25d0ab` (docs), `356eae9` (frontend)  
**Feature Draft PR:** [#67](https://github.com/acarbonilla/facilityops-platform/pull/67) (full epic; Draft; unmerged)  
**UX baseline:** PM-UX-001 / PM-UX-001A (COMPLETE AND MERGED)  
**Next (historical):** FO-104 — Project Task & Assignment Management  
**Epic status:** FO-103–FO-113A COMPLETE AND MERGED on `main` @ `ebdad1b…`  
**PR policy:** Epic PR #67 MERGED  
**Deferred:** FO-102 — Gemini Billing, Quota & Rate Limit Diagnostics (external dependency)  
**FO-109:** See `docs/02-Development/FO-109 - Project Management QA and Production Readiness.md`  
**FO-113 / FO-113A:** See FO-113 and FO-113A docs (COMPLETE AND MERGED)

## FO-113 status

Validated under FO-113 integrated QA. Decision: READY WITH ACCEPTED LIMITATIONS. Merged via FO-113A / PR #67.

## 1. Objective

Establish the foundational Project Management module on the shared `feature/project-management` branch: tenant-scoped data model, permissions, CRUD APIs, membership foundation, search/filter/sort/pagination, overview metrics, attachments, audit history, and list/create/detail/edit UI — without implementing FO-104+ capabilities.

## 2. Feature-based branch strategy

| Rule | Value |
| --- | --- |
| Shared branch | `feature/project-management` |
| Checkpoints | FO-103 → FO-109 on the same branch |
| Sole merge | FO-109A only |
| Standalone FO-103 PR | Not opened |
| Merge to `main` | Not performed |

## 3. Architecture discovery (selected)

### Backend

- Standalone Django app `apps.projects` (peer to `fm_tickets`, `maintenance`, `inspection`)
- `BaseModel` UUID PK, timestamps, soft-delete (`is_deleted` / `deleted_at`), audit UUID fields
- Tenant + organization ownership; optional building
- Module-local history (`ProjectHistory` + `record_history`) matching maintenance/inspection
- `HasProjectPermission` + `required_permissions_any`
- Pagination: `StandardResultsSetPagination`
- Custom filters (no django-filter)
- Attachments: reuse generic framework with owner type `project`

### Frontend

- Thin App Router pages under `app/(app)/projects/`
- Feature UI in `features/projects/components/`
- API client `services/api/projects.ts`; types in `types/projects.ts`
- Helpers/tests in `lib/projects/`
- Nav item after Maintenance, gated by `projects.view`
- Shared PageHeader / EmptyState / DataTable / attachment components

## 4. Backend app structure

```text
backend/apps/projects/
  models.py          # Project, ProjectMember, ProjectHistory
  serializers.py
  views.py           # ProjectViewSet + members/history/metrics
  urls.py            # /api/projects/
  permissions.py
  filters.py
  tenant_scope.py
  services.py
  migrations/0001_initial.py
  tests/test_projects.py
```

Registered in `INSTALLED_APPS` and mounted at `/api/projects/`.

## 5. Frontend module structure

```text
frontend/
  app/(app)/projects/page.tsx
  app/(app)/projects/new/page.tsx
  app/(app)/projects/[projectId]/page.tsx
  app/(app)/projects/[projectId]/edit/page.tsx
  features/projects/components/
  hooks/use-projects.ts
  lib/projects/
  services/api/projects.ts
  types/projects.ts
```

Routes implemented: `/projects`, `/projects/new`, `/projects/{id}`, `/projects/{id}/edit`.  
Deferred routes (not implemented): tasks, gantt, timeline, issues, notes.

## 6. Core entities

### Project

Tenant, organization, optional building, `project_code`, name, description, project_manager, status, priority, planned/actual dates, `completion_percentage` (default 0, read-only API), audit/soft-delete fields.

### ProjectMember

Tenant, project, user, role (`project_manager` | `member` | `viewer`), `is_active`, `added_by`. Duplicate active membership prevented; PM field kept consistent with membership via `sync_project_manager_membership`.

### ProjectHistory

Actor, action, description, metadata JSON for create/update/status/PM/member/delete events.

## 7. Project code strategy

- Format: `PRJ-{YYYY}-####` (example: `PRJ-2026-0001`)
- Generated server-side on save when empty
- Unique per tenant (`UniqueConstraint` on `tenant` + `project_code`)
- Not client-supplied as the authoritative create path

## 8. Status values

Machine values: `draft`, `planned`, `in_progress`, `on_hold`, `delayed`, `completed`, `cancelled`.  
FO-103 stores and displays status; advanced lifecycle transition enforcement deferred.

## 9. Priority implementation

**Decision:** Module-local `TextChoices` on `Project` (Low / Medium / High / Critical), consistent with maintenance/inspection string values, **not** shared with FM Ticket or Maintenance priority enums at the model layer, and **not** auto-linked across modules.

## 10. Permission model

| Code | Purpose |
| --- | --- |
| `projects.view` | List/retrieve/metrics/history |
| `projects.create` | Create |
| `projects.update` | Update |
| `projects.delete` | Soft delete |
| `projects.manage` | Full module manage alias |
| `projects.members.manage` | Add/remove members |

Seeded: System Administrator (all); Facility Manager (all listed); Viewer (`projects.view`); Employee (none — STRICT).

## 11. Tenant isolation

- Tenant derived server-side from organization / actor scope
- Client tenant spoof ignored/rejected
- Org/building/PM/members must belong to tenant
- List/detail scoped via `scope_projects_to_user`
- Cross-tenant access returns safe 404/deny patterns

## 12. Project CRUD API

| Method | Path |
| --- | --- |
| GET | `/api/projects/` |
| POST | `/api/projects/` |
| GET | `/api/projects/{id}/` |
| PATCH | `/api/projects/{id}/` |
| DELETE | `/api/projects/{id}/` (soft delete) |
| GET | `/api/projects/metrics/` |
| GET | `/api/projects/{id}/history/` |

Serializers: list, detail, create, update.

## 13. Member API

| Method | Path |
| --- | --- |
| GET/POST | `/api/projects/{id}/members/` |
| DELETE | member destroy action (nested) |

Validates same tenant, active user, no duplicates, permission enforcement, PM consistency.

## 14. Search / filter / sort / pagination

Search: code, name, description, project manager name/email.  
Filters: status, priority, organization, building, project manager, planned date ranges.  
Sort: created/updated, code, name, planned dates, status.  
Pagination: platform `StandardResultsSetPagination`.

## 15. Overview metrics

Status counts: total, draft, planned, in_progress, on_hold, delayed, completed (and cancelled as applicable). No task-based progress metrics.

## 16. Audit / history

`ProjectHistory` records create, update, status change, PM change, member add/remove, soft delete. Timeline UI deferred to FO-106.

## 17. Attachments

Owner type `project` in shared attachments framework; internal-only; immutable when completed/cancelled; path not exposed; tenant + permission gated.

## 18. Notification boundary

No Project assignment/overdue/milestone/issue notifications in FO-103. Future event naming reserved for later checkpoints.

## 19. Delete / archive behavior

**Decision:** Soft delete (`is_deleted` / `deleted_at`); excluded from standard lists; completed projects blocked from deletion; audit retained; no cascade to FM/Maintenance/5S records.

## 20. Accessibility & responsive

List summary cards, filters, table/mobile-safe layout, single-column forms, status/priority labels not color-only, attachment controls reuse accessible shared components. Gantt responsive deferred to FO-105.

## 21. Migration

- Name: `projects.0001_initial`
- Tables: `projects_project`, `projects_projectmember`, `projects_projecthistory`
- No mandatory FKs from FM Tickets, Work Orders, or Inspections
- `makemigrations --check` / `manage.py check` clean at FO-103 validation

## 22. Tests

### Backend (`apps.projects.tests.test_projects`)

Focused suite covering authorization, tenant isolation, code generation, validation, CRUD/soft-delete, membership, search/filter/sort/pagination, audit, and attachment authorization. **26 tests OK.**

### Frontend (`lib/projects/*.test.ts`)

Helper coverage for display labels, filter serialization, form/date validation, attachment owner context. Registered in `package.json`. Full frontend suite **416 pass** at FO-103 validation.

## 23. Manual acceptance

**Type:** Combination of automated API tests, frontend unit tests, code-path review.  
**Interactive browser acceptance:** Not claimed for this checkpoint (deferred to broader FO-109 QA where appropriate).

## 24. Defects

| Found | Corrected |
| --- | --- |
| None blocking at FO-103 validation | N/A |

## 25. Explicit exclusions (confirmed not started)

FO-104 tasks/assignment; FO-105 Gantt/dependencies; FO-106 timeline UI/notes/issues; FO-107 accomplishment calculation; FO-108 cross-module links; project notifications; AI project mutations; FO-102; merge to `main`.

## 26. Checkpoint status

FO-103 Project Management Foundation is **complete on `feature/project-management`**, unmerged. FO-104 has not started. FO-102 remains deferred.
