# FO-105 — Gantt Chart and Task Dependencies

**Status:** Complete on shared feature branch (unmerged)  
**Date:** 2026-08-06  
**Branch:** `feature/project-management`  
**Starting branch SHA:** `2942f655f42b46614ec66fe70b6f8d84ad1538ae`  
**Branch HEAD (FO-105):** `049cbc2ddc2b585439e79d7b99a8a8a46340fcf4`  
**Commits:** `5327631` (backend), `eca3a8e` (frontend), `3066d9a` (docs), `049cbc2` (eslint memo fix)  
**Prior checkpoints:** FO-103 Foundation; FO-104 Task & Assignment  
**Next:** FO-106 — Timeline, Notes & Issues (**not started**)  
**Draft epic PR:** [#67](https://github.com/acarbonilla/facilityops-platform/pull/67) (Draft; unmerged until FO-109A)  

## FO-113 status

Validated under FO-113 integrated QA. Decision: READY WITH ACCEPTED LIMITATIONS. Draft PR #67 remains unmerged pending FO-113A.
**FO-109:** Integrated QA complete (includes start-then-link dependency gate hardening); FO-109A next  
**Deferred:** FO-102 — Gemini Billing, Quota & Rate Limit Diagnostics

## 1. Objective

Add Finish-to-Start task dependencies with cycle prevention and readiness gating, plus an accessible responsive Project Gantt experience with milestones, today marker, delay indicators, and zoom controls — without drag-to-reschedule, CPM, lead/lag, or FO-106/107/108 scope.

## 2. Architecture discovery

| Topic | Decision |
| --- | --- |
| App | Extend `apps.projects` |
| Gantt package | **No new package** — lightweight CSS/SVG React + Tailwind chart |
| Chart libs in repo | None suitable (no recharts/gantt/dnd schedule libs) |
| Dates | `DateField` + `timezone.localdate()` for delay |
| History | Reuse `ProjectHistory` |
| Notifications | Deferred |

## 3. Package / dependency decision

**Do not add a third-party Gantt library.** Justification: no existing chart package; a native SVG/CSS implementation meets MVP accessibility (paired schedule table), SSR/Next compatibility, testability, and avoids license/bundle risk.

## 4. Dependency model

`ProjectTaskDependency`: tenant, project, predecessor_task, successor_task, `dependency_type=finish_to_start` only; soft-delete; unique active (predecessor, successor).

## 5. Finish-to-Start semantics

Successor may enter `in_progress` or `completed` only after **all** active predecessors are `completed`. Stored status is not auto-set to `blocked`. Derived `is_dependency_ready` + blocking predecessor list.

## 6. Cycle detection

BFS/DFS on predecessor→successor adjacency excluding soft-deleted edges/tasks. Reject self-loops and cycles (A→B→A, longer cycles). Complexity **O(V+E)** per validation.

## 7. Readiness service

`get_dependency_readiness` / batch helpers return: `is_dependency_ready`, counts, blocking predecessors (id, code, name, status, planned_end). Used by task serializers, status gate, and Gantt.

## 8. APIs

| Method | Path |
| --- | --- |
| GET/POST | `/api/projects/{id}/dependencies/` |
| GET/DELETE | `/api/projects/{id}/dependencies/{dep_id}/` |
| GET | `/api/projects/{id}/gantt/` |
| GET | `/api/projects/{id}/tasks/{task_id}/predecessors/` |
| GET | `…/successors/` |
| GET | `…/dependency-readiness/` |

## 9. Gantt date / milestone / delay rules

- Primary bars: planned start/end; actual secondary in accessible table
- Scheduled = both planned dates (milestone may use equal start/end)
- Unscheduled listed separately — no invented dates
- `is_delayed`: not completed/cancelled; planned_end &lt; today; no actual_end
- `is_completed_late`: completed and actual_end &gt; planned_end
- Delay does **not** auto-change Project/Task status

## 10. Status gate & deletion

- Status → in_progress/completed blocked with `task_dependency_incomplete` when not ready
- Soft-delete task **blocked** while active dependencies exist (no orphaning)
- Project soft-delete continues to hide Gantt/deps via normal deleted filters

## 11. Permissions

`projects.gantt.view`, `projects.dependencies.view`, `projects.dependencies.manage` (+ manage aliases). Viewer: view-only. Employee: none.

## 12. Frontend

- Route: `/projects/{id}/gantt`
- Zoom: Day / Week / Month; prev/next/today/fit
- Desktop chart + always-available accessible schedule table
- Mobile: schedule cards/table + dependency panel (no miniature mandatory Gantt)
- Dependency create/remove forms (no drag-to-reschedule)
- Task detail predecessors/successors/readiness; task list compact indicators/filters
- Project detail Gantt link

## 13. Notification / reporting boundary

No dependency/delay notifications. No FO-107 accomplishment. No FO-108 links.

## 14. Performance boundaries

MVP validation target: ~200 tasks / ~400 dependencies per Project. Gantt uses batched readiness and select_related for PIC. Day zoom range clamped to avoid unbounded cell generation.

## 15. Migration

`projects.0003_project_task_dependencies_fo105` — table `projects_projecttaskdependency`.

## 16. Tests

- Backend: FO-105 focused + FO-103/104 regression via `apps.projects` (**114 OK**)
- Frontend: gantt/dependencies helpers + full suite (**450 pass**)

## 17. Manual acceptance

**Type:** Automated API + frontend unit + code-path review. Interactive browser not claimed.

## 18. Exclusions confirmed

SS/FF/SF deps, lead/lag, CPM, drag-reschedule, FO-106 notes/issues/timeline UI, FO-107/108, notifications, FO-102, merge to main.

## 19. Checkpoint status

FO-105 complete on `feature/project-management`, unmerged. Draft PR #67 remains Draft. FO-106 not started. FO-102 deferred.
