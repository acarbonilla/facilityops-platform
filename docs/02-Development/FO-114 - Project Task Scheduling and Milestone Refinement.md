# FO-114 — Project Task Scheduling and Milestone Refinement

**Status:** COMPLETE AND MERGED  
**Date:** 2026-08-08  
**Branch:** `feature/project-task-scheduling-refinement` (deleted)  
**Starting main SHA:** `91cce0b22c6ee2b2091c94a0e989ee1e262e147e`  
**Merge commit SHA:** `a8de616e2089790f4b05c09be1665d96b967d53e`  
**PR:** [#68](https://github.com/acarbonilla/facilityops-platform/pull/68) — **MERGED**  
**Baseline:** FO-113A Project Management COMPLETE AND MERGED  
**Deferred:** FO-102 Gemini billing/quota diagnostics  
**Merge task:** FO-114A — COMPLETE AND MERGED  

## 1. Objective

Refine Project Task scheduling so FacilityOps supports realistic planning without requiring every task to have individual planned dates, while keeping Milestone semantics explicit and Finish-to-Start dependency schedules consistent.

## 2. Repository preflight

| Check | Result |
| --- | --- |
| Fetch/prune | Performed |
| Local `main` = `origin/main` | Yes @ `91cce0b…` |
| FO-113A on `main` | Confirmed |
| Tracked tree clean at start | Yes |
| Prior FO-114 implementation | None |
| Branch name collision | None locally/remotely |
| Data preserved | SQLite/PG/attachments/uploads untouched |

## 3. Architecture discovery

### Backend fields (`ProjectTask`)

- `planned_start`, `planned_end` — nullable dates
- `is_milestone` — boolean, default `false`
- Existing FO-104 project-window validation when project has both planned dates
- Delay flags require `planned_end`
- My Work unscheduled bucket when either planned date is missing
- Gantt `is_milestone` comes from stored flag only

### Root cause — incorrect Milestone display

Confirmed: UI badges/labels key **only** off `is_milestone`. They do **not** derive Milestone from missing dates or same-day duration.

The screenshot showing **MILESTONE** with Planned Start/End **Not set** means the stored task had `is_milestone=true` with null dates (previously allowed). Demo/test data or an earlier create path could set the flag without dates. Form default was already `false`; serializer default was already `false`.

FO-114 now rejects date-less milestones and requires an explicit milestone date.

## 4. Decisions

| Topic | Decision |
| --- | --- |
| Task date optionality | Planned dates optional |
| Partial dates | **Both or neither** (MVP) |
| Same-day tasks | Allowed (`start == end`); not auto-milestone |
| Overlap | Allowed; no exclusivity; no resource conflict detection |
| Project vs Task dates | Project dates = overall schedule; tasks are not auto-copied |
| Milestone | Explicit `is_milestone=true` only; requires a date |
| Milestone persistence | Single UI date → `planned_start = planned_end` |
| FS day boundary | `successor.planned_start >= predecessor.planned_end` |
| Unscheduled dependencies | Allowed; readiness still status-based |
| Delay | No planned end → not delayed / unscheduled |
| Accomplishment | Date presence irrelevant |
| Migration | **None** — existing nullable fields sufficient |

## 5. Backend changes

- `ProjectTask.clean()`: milestone date fill/collapse; both-or-neither; FS schedule validation on update
- `ProjectTaskDependency.clean()`: FS calendar conflict → `task_schedule_dependency_conflict`
- `fs_schedule_conflict_message()` in `dependency_service.py`
- Serializer clean mirrors filled `planned_start` / `planned_end`

## 6. Frontend changes

- Task create/edit: **Planned schedule (optional)** section; helper copy; milestone checkbox; Milestone date field when checked
- Milestone toggle prompts when collapsing unequal start/end
- Task detail: Unscheduled / schedule range / Milestone date
- Gantt schedule table: Schedule column + Unscheduled text; Milestone badge only when `is_milestone`
- Display helpers: `formatTaskPlannedScheduleLabel`, `isTaskScheduleUnscheduled`
- Conflict errors labeled under Schedule dependency

## 7. Tests

### Backend (`test_project_task_scheduling_fo114.py` + regressions)

Covers optionality, same-day, overlap, explicit milestones, partial rejection, project boundary, delay, Gantt flag source, FS conflict/same-day boundary, unscheduled deps/readiness, My Work unscheduled bucket, technician execution, accomplishment with mixed schedules. Regression fixtures updated for milestone dates and FS-compatible dates.

### Frontend

Extended `tasks-form.test.ts` and `tasks-display.test.ts` for optional schedule, same-day, partial rejection, milestone defaults/sanitize, Unscheduled labels, conflict error rendering.

## 8. Validation (FO-114 / FO-114A)

| Gate | Result |
| --- | --- |
| `apps.projects` | **270 OK** pre-merge and post-merge (PostgreSQL `--keepdb`) |
| Frontend suite | **517 pass / 0 fail** pre-merge and post-merge |
| ESLint / TypeScript / production build | Pass (pre + post) |
| Django check / makemigrations --check | Pass; no FO-114 migration |
| Migration chain | projects 0001–0006 |
| PR #68 | MERGED @ `a8de616…` |
| FO-102 | Remains deferred |
| FO-115 | Not started |

## 9. Remaining limitations

- No resource/capacity conflict detection
- No critical path / lead-lag / hourly scheduling
- No automatic Project date expansion
- Manual acceptance of Lobby Tile scenario remains operator-verified in FO-114A as needed

## 10. Explicit exclusions (honored)

Resource conflicts, capacity planning, automatic scheduling, critical path, schedule optimization, lead/lag, hourly/time-of-day, calendar integrations, recurring tasks, AI scheduling, notification changes, FO-102, unrelated PM redesign.
