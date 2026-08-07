# FO-111 — Technician Task Execution Experience

**Status:** Complete on shared feature branch (unmerged)  
**Date:** 2026-08-07  
**Branch:** `feature/project-management`  
**Prior:** FO-110 Technician Project Workspace  
**Draft epic PR:** [#67](https://github.com/acarbonilla/facilityops-platform/pull/67) (Draft; unmerged)  
**Next:** FO-112 — Technician Dashboard & Assigned Work (**COMPLETE**; FO-113 QA complete; FO-113A next)  
**Deferred:** FO-102; push/email notifications for Project tasks (timeline history only)

## FO-113 status

Validated under FO-113 integrated QA. Decision: READY WITH ACCEPTED LIMITATIONS.

## Lifecycle

`not_started` → `in_progress` ⇄ `on_hold` (Paused) → `completed`

Paused maps to existing `on_hold` (no migration).

Endpoints:

- `POST .../tasks/{id}/start/`
- `POST .../tasks/{id}/pause/`
- `POST .../tasks/{id}/resume/`
- `POST .../tasks/{id}/complete/`
- `POST .../tasks/{id}/progress/`
- `POST .../tasks/{id}/report-blocker/`

Authorization: Technicians execute **assigned tasks only** (`execution_service` + FO-110 workspace rules). Project Managers retain full task authority.

## Progress

0–100 with FO-104 sync and FO-107 recalculation. Checklist does not auto-complete the task. Project is **not** auto-completed at 100%.

## Collaboration

Comments, checklist, attachments reuse existing APIs with assigned-task mutation guards. Blockers create Project Issues (`projects.issues.report`) — never FM Tickets.

## UI

`ProjectTaskExecutionPanel` on task detail: Start / Pause / Resume / Complete, progress control, blocker form. Full Edit/Assign/Delete/Link-manage hidden in Technician workspace mode.

## Notifications

No new Project notification hooks in FO-111. Execution events appear on Project Timeline / history. Formal notify deferred.

## Tests

Backend: `test_project_technician_workspace.py`  
Frontend: `lib/projects/execution.test.ts`
