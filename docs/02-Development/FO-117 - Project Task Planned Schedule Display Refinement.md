# FO-117 — Project Task Planned Schedule Display Refinement

**Status:** Complete on feature branch (unmerged)  
**Date:** 2026-08-09  
**Branch:** `feature/project-task-schedule-display`  
**Draft PR:** _(filled after open)_  
**Starting main SHA:** `ee421b1de9b73950467f89c9381d39428dbc9e6a`  
**Merge task:** FO-117A (not started)  
**FO-102:** Deferred  

## Problem

The Project Task list showed only **Planned End**. Facility Managers could not see when each Task was planned to start without opening detail or Gantt.

## Design

Replace the Planned End column with a compact **Planned Schedule** cell using shared formatter `formatTaskPlannedScheduleLabel`:

| Case | Display |
| --- | --- |
| Multi-day Task | `Aug 9 – Aug 10` |
| Same-day Task (`is_milestone = false`) | `Aug 13` |
| Explicit Milestone | `Milestone · Aug 23` |
| Both dates null | `Unscheduled` |
| Partial legacy dates | `Incomplete schedule` |

Project schedule context appears once above the filters:

**Project schedule** — e.g. `Aug 9, 2026 – Aug 27, 2026`

Actual Execution is not shown in the Task list (optional dual Planned/Actual indicator deferred to avoid clutter). FO-115B Gantt and Task Detail continue to show planned vs actual.

## Semantics preserved

- FO-114 scheduling rules remain authoritative (optional dates, both-or-neither, same-day valid, Project boundary, FS conflicts).
- Same-day Tasks are not Milestones unless `is_milestone = true`.
- No backend business-logic change; serializers already expose `planned_start` / `planned_end` / `is_milestone`.
- No migration; no new runtime dependency.

## Sorting / filtering

- Sort options add **Planned schedule: earliest/latest start** (`planned_start` / `-planned_start`); existing Planned End ordering retained.
- Planned End date filters remain unchanged (backend field-specific filters).

## Surfaces

- Desktop table: Code, Name, Status, Priority, Progress, PIC, **Planned schedule**, Actions
- Mobile cards: explicit **Planned schedule** label + formatter output
- Detail / Gantt popover reuse the same formatter (human-readable, milestone prefix)

## Validation

- Focused FO-117 + FO-114/115/116 helper regressions
- Full frontend suite
- `apps.projects` backend regression
- ESLint / TypeScript / production build
- Django check / `makemigrations --check`

## Next

**FO-117A** — Finalize, Ready for Review, merge, post-merge verification.
