# FO-104 — Project Task and Assignment Management

**Status:** Complete on shared feature branch (unmerged)  
**Date:** 2026-08-06  
**Branch:** `feature/project-management`  
**Starting branch SHA:** `3001b720f762ddbb5898daa2e93468fbaa0feff1`  
**Branch HEAD (FO-104):** `d37b3c21de9628aa4076e9d52ae3abd1194c6b20`  
**Commits:** `16ec321` (backend), `0a9e5d1` (frontend), `d37b3c2` (docs)  
**Prior checkpoint:** FO-103 — Project Management Foundation  
**Next:** FO-105 — Gantt Chart & Task Dependencies (**not started**)  
**Draft epic PR:** [#67](https://github.com/acarbonilla/facilityops-platform/pull/67) (remains Draft; unmerged until FO-109A)  
**Deferred:** FO-102 — Gemini Billing, Quota & Rate Limit Diagnostics

## 1. Objective

Add operational task planning inside each Project: task CRUD, Person in Charge assignment, status/priority/schedule/progress, checklist, comments, task attachments, audit events, reorder, and Project detail task summary — without Gantt, dependencies, notes/issues, or project accomplishment calculation.

## 2. Architecture discovery (selected)

| Layer | Choice |
| --- | --- |
| App | Extend `apps.projects` (no new Django app) |
| Routing | Nested paths under `/api/projects/{id}/tasks/` (manual URL wiring + task ViewSet actions) |
| History | Reuse `ProjectHistory` with task metadata (no module-local task history table) |
| Comments | `ProjectTaskComment` (FM-ticket style), not Project Notes |
| Checklist | `ProjectTaskChecklistItem` (inspection-item inspired, no scoring) |
| Attachments | Owner type `project_task` in shared attachments framework |
| Frontend | Nested routes under `/projects/[projectId]/tasks/*`; summary on Project detail |
| Notifications | Assignment notifications **deferred** (FO-104 boundary) |

## 3. Task model

`ProjectTask`: tenant, project, `task_code`, name, description, `person_in_charge`, status, priority, planned/actual dates, `progress_percentage`, `sequence`, `is_milestone`, BaseModel audit/soft-delete.

Related: `ProjectTaskChecklistItem`, `ProjectTaskComment`.

## 4. Task-code strategy

- Format: `{PROJECT_CODE}-T{NNN}` (example: `PRJ-2026-0001-T001`)
- Unique per project; server-generated; not client-editable
- Soft-deleted codes included in sequence calculation (**never reuse**)

## 5. Status / progress rules

Statuses: `not_started`, `in_progress`, `blocked`, `on_hold`, `completed`, `cancelled`.

| Rule | Behavior |
| --- | --- |
| completed | progress forced to 100 |
| not_started | progress forced to 0 |
| cancelled | last progress preserved |
| in_progress | progress coerced: 0→1; 100→status completed |
| blocked / on_hold | progress preserved (0–100) |
| Range | 0–100 only |

## 6. Person in Charge

- Optional at create
- **Required** before `in_progress` or `completed`
- Must be active Project member (`is_active`, not deleted) or Project Manager
- Same tenant; inactive/non-member/cross-tenant rejected
- Explicit `POST …/assign/` plus PATCH support; reassignment audited; same-PIC assignment idempotent

## 7. Schedule validation

- Planned/actual end ≥ start
- Milestones: zero-duration (`end = start`) when appropriate
- When Project has **both** planned start and end: reject task planned dates outside that window
- When Project schedule incomplete: allow valid task ranges
- No automatic Project date expansion

## 8. Permissions

| Code | Use |
| --- | --- |
| `projects.tasks.view` | List/retrieve/summary |
| `projects.tasks.create` | Create |
| `projects.tasks.update` | Update / checklist mutate |
| `projects.tasks.delete` | Soft delete |
| `projects.tasks.assign` | Assign PIC |
| `projects.tasks.comment` | Comments |
| `projects.tasks.manage` | Full task manage alias |

Also accepts `projects.view` / `projects.manage` where mapped. Seeded for system_admin, facility_manager; viewer gets `projects.tasks.view`. Employee: none.

## 9. APIs

| Method | Path |
| --- | --- |
| GET/POST | `/api/projects/{project_id}/tasks/` |
| GET/PATCH/DELETE | `/api/projects/{project_id}/tasks/{task_id}/` |
| POST | `/api/projects/{project_id}/tasks/{task_id}/assign/` |
| POST | `/api/projects/{project_id}/tasks/reorder/` |
| GET/POST | `…/tasks/{task_id}/checklist/` |
| PATCH/DELETE | `…/checklist/{item_id}/` |
| GET/POST | `…/tasks/{task_id}/comments/` |
| DELETE | `…/comments/{comment_id}/` |
| GET | `/api/projects/{project_id}/task-summary/` |

`task_summary` also embedded on Project detail.

## 10. Checklist / comments / attachments / audit

- Checklist: ordered items; add/update/toggle/delete; **does not** auto-set task progress/status
- Comments: authorized users; `is_internal` default true; soft-delete where applicable
- Attachments: `project_task`; internal-only; immutable when completed/cancelled; path not exposed
- Audit: create/update/assign/status/progress/checklist/comment/delete via `ProjectHistory`

## 11. Frontend

Routes: list, new, detail, edit under `/projects/{id}/tasks`.  
Project detail: task status summary + link to Tasks.  
PIC selector scoped to project members.  
No Gantt / dependencies / notes / issues UI.

## 12. Notification behavior

**Deferred:** no `project.task_assigned` (or other) notifications in FO-104. Documented in services for later checkpoints.

## 13. Migration

- Name: `projects.0002_project_tasks_fo104`
- Tables: `projects_projecttask`, `projects_projecttaskchecklistitem`, `projects_projecttaskcomment`
- No dependency schema; no FKs from FM/Maintenance/5S

## 14. Tests

- Backend: FO-104 focused suite in `test_project_tasks.py` + FO-103 regression via `apps.projects` (**70 OK**)
- Frontend: `lib/projects/tasks-*.test.ts` + attachments; full suite **435 pass**

## 15. Manual acceptance

**Type:** Combination of automated API tests, frontend unit tests, and code-path review.  
Interactive browser acceptance not claimed for this checkpoint.

## 16. Explicit exclusions confirmed

FO-105 Gantt/dependencies; FO-106 timeline/notes/issues; FO-107 accomplishment; FO-108 module links; overdue automation; AI; FO-102; merge to `main`.

## 17. Checkpoint status

FO-104 is **complete on `feature/project-management`**, unmerged. Draft PR #67 remains Draft. FO-105 has not started. FO-102 remains deferred.
