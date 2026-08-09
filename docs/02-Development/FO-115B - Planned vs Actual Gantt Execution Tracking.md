# FO-115B — Planned vs Actual Gantt Execution Tracking

**Status:** COMPLETE AND MERGED (via FO-115A / PR #69)
**Branch:** `feature/interactive-gantt-tenant-scope` (deleted after merge)
**PR:** [#69](https://github.com/acarbonilla/facilityops-platform/pull/69)
**Baseline (FO-115 HEAD):** `95e7b300734bb5d164b66df38832287cdf49dbaa`
**Merge task:** FO-115A — see sibling FO-115A doc
**Follow-on on same branch:** FO-115C assignment refinement (does not alter actual_start/actual_end rules)
**FO-102:** Deferred

---

## 1. Objective

Preserve the **planned** Project Task schedule as the management baseline while recording **actual** execution from task lifecycle events, and present planned-vs-actual timing, variance, overdue execution, and milestone performance in the interactive Gantt.

---

## 2. Actual execution fields

Existing `ProjectTask` fields (FO-104, `DateField`, no new migration):

| Field | Meaning |
|-------|---------|
| `planned_start` / `planned_end` | Management baseline (never rewritten by Start/Complete) |
| `actual_start` / `actual_end` | System-derived execution facts |

Project-level `actual_start_date` / `actual_end_date` are separate and unchanged.

---

## 3. Lifecycle rules

| Event | Behavior |
|-------|----------|
| Start / first enter active status | Set `actual_start = localdate()` **once** if empty |
| Pause / Resume | Preserve `actual_start` |
| Progress updates | Preserve `actual_start`; may set it if first activation |
| Complete / progress→100% | Set `actual_end`; set `actual_start` if still empty |
| Reopen (leave `completed`) | Clear current `actual_end`; keep `actual_start`; new end on next complete |
| Cancel | Preserve any recorded actual facts; do not invent `actual_end` |

Authoritative helper: `apps.projects.execution_service` + `update_task` in `services.py`.

---

## 4. Manual edit policy

Actual dates are **system-derived**.

- Removed from Task create/update serializers (client cannot PATCH them).
- Removed from ordinary Task form inputs.
- Technicians cannot pass `actual_start`/`actual_end` via assigned-task PATCH; lifecycle services may set them via `ASSIGNED_TASK_SYSTEM_FIELDS`.
- Complete action ignores client-supplied `actual_end`.

No PM correction UI in this MVP.

---

## 5. Variance contract

Computed in `execution_variance.compute_execution_schedule` (not persisted):

- `start_variance_days` = actual_start − planned_start (when both exist)
- `completion_variance_days` = actual_end − planned_end (when both exist)
- `execution_schedule_status`: `not_started` | `started_early` | `started_on_time` | `started_late` | `in_progress_past_due` | `completed_early` | `completed_on_time` | `completed_late` | `unscheduled` | `variance_unavailable`
- `days_past_planned_end` for active past-due tasks

Exposed on Task list/detail serializers and Gantt payload.

Unscheduled tasks may still execute; variance is not invented from actual dates.

---

## 6. Gantt visualization

- **Not started:** planned bar only
- **In progress / paused / blocked with actual start:** subdued planned baseline + dominant actual bar (start → today)
- **Completed:** planned baseline + complete actual bar
- **Milestones:** planned diamond + actual completion marker when finished
- Same-day tasks remain normal tasks (not milestones)
- Legend distinguishes Planned / Actual / Milestone / Actual Milestone / Today / Delayed / Dependency
- Popover and Schedule Table include Planned, Actual, and Variance text
- Fit Project includes actual dates and today for open actual bars
- Dependencies still anchor to planned bars; no auto-replanning

---

## 7. Boundaries preserved

- Project accomplishment remains task-progress based (lateness does not reduce %)
- Project completion remains manager-controlled (FO-107)
- FO-114 scheduling semantics unchanged
- FO-115 pan/zoom/sticky/popover interactions unchanged
- No drag-to-reschedule, baseline versioning, critical path, or forecasting

---

## 8. Backfill

No data migration. Legacy tasks without reliable start/end history may leave `actual_start`/`actual_end` null (“Actual Start unavailable for legacy task”). Do not fabricate from `created_at`.

---

## 9. Tests / validation (at implementation)

| Gate | Result |
|------|--------|
| FO-115B backend suite | 20 OK |
| `apps.projects` | **296 OK** (PostgreSQL `--keepdb`) |
| Frontend unit tests | **≥528** after adding execution-variance suite |
| Migration | None required (`makemigrations --check` expected clean) |
| Merge | Not performed — FO-115A |

---

## 10. Next

**FO-115C** — Project Manager & Task PIC role-based assignment refinement (same branch).
**FO-115A** — Finalize, merge Draft PR #69, and post-merge verification.
**FO-102** remains deferred.
