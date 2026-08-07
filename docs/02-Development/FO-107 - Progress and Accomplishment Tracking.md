# FO-107 — Progress and Accomplishment Tracking

**Status:** Complete on shared feature branch (unmerged)  
**Date:** 2026-08-07  
**Branch:** `feature/project-management`  
**Starting branch SHA:** `699f5753020cf0eb5517dda0e8df0369f2e21a80`  
**Branch HEAD (FO-107):** `ab741346ea3d653c63b59880eff98cb5255f5cdd`  
**Commits:** `fd6d1db` (backend), `146bf10` (frontend), `ab74134` (docs)  
**Prior checkpoints:** FO-103–FO-106  
**Next (historical):** FO-108 — FacilityOps Module Integration  
**Draft epic PR:** [#67](https://github.com/acarbonilla/facilityops-platform/pull/67) (Draft; unmerged until FO-109A)  
**FO-109:** Integrated QA complete — see FO-109 checkpoint doc; FO-109A next  
**Deferred:** FO-102 — Gemini Billing, Quota & Rate Limit Diagnostics

## 1. Objective

Derive Project accomplishment from task progress, persist it safely, expose progress summaries and append-only history, and provide an accessible Progress dashboard — without weighted progress, FO-108 integrations, or notifications.

## 2. Architecture

| Decision | Choice |
| --- | --- |
| Service | `ProjectProgressService` authoritative |
| Persistence | Update `Project.completion_percentage` (serializer remains read-only) |
| History | `ProjectProgressSnapshot` append-only + ProjectHistory when rounded % changes |
| Charts | No new package — CSS bars + history table (+ optional SVG sparkline) |
| Backfill | Data migration `migration_rebuild` in `0005_project_progress_fo107` |

## 3. Formula

**Simple average** of `progress_percentage` for non-deleted, non-cancelled tasks.  
Empty included set → **0**.  
**Rounding:** Decimal `ROUND_HALF_UP` to integer 0–100, stored as `Decimal('NN.00')`.  
Example: (100+100+50+0+0+0)/6 → **42**.

Excluded: cancelled, soft-deleted.  
Milestones: incomplete → 0 contribution via progress rules; completed → 100.

## 4. Triggers

Recalculate on task create / progress or status change / soft-delete.  
Not on comments, attachments, checklist, notes, issues, or dependency-only changes.

## 5. APIs

| Method | Path |
| --- | --- |
| GET | `/api/projects/{id}/progress/` |
| GET | `/api/projects/{id}/progress-history/` |
| POST | `/api/projects/{id}/recalculate-progress/` |

## 6. Project status consistency

Completing a Project requires accomplishment = 100. Sets `actual_end_date` if empty. Does **not** auto-complete at 100%.

## 7. Schedule elapsed

Optional separate `schedule_elapsed_percentage` — never mixed into accomplishment.

## 8. Permissions

`projects.progress.view`, `projects.progress.recalculate` (+ view/manage aliases). Viewer: view only.

## 9. Frontend

Route `/projects/{id}/progress`; detail/list/gantt summary integration; recalculate for authorized managers.

## 10. Migration

`projects.0005_project_progress_fo107`

## 11. Tests

- Backend `apps.projects`: **175 OK** (44 FO-107 focused)
- Frontend suite: **487 pass**

## 12. Acceptance

Automated API + frontend unit + code-path review. Interactive browser not claimed.

## 13. Exclusions

Weighted progress; FO-108; notifications; AI; portfolio reporting; merge to main; FO-102.

## 14. Checkpoint status

FO-107 complete on `feature/project-management`, unmerged. FO-108 not started. FO-102 deferred.
