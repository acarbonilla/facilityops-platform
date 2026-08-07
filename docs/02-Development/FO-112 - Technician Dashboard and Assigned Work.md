# FO-112 — Technician Dashboard and Assigned Work

**Status:** Complete on shared feature branch (unmerged)  
**Date:** 2026-08-07  
**Branch:** `feature/project-management`  
**Prior:** FO-110 Workspace · FO-111 Task Execution  
**Draft epic PR:** [#67](https://github.com/acarbonilla/facilityops-platform/pull/67) (Draft; unmerged)  
**Next:** FO-113 — Project Management QA & Production Readiness  
**Deferred:** FO-102; nav badge polling; WebSocket/SSE; productivity scoring

## Route decision

Primary Technician route: **`/my-work`** (not `/projects/my-work`).

Reason: assigned work may later expand beyond Projects; keeps Projects prefix for portfolio/admin pages.

Full list: `/my-work/tasks`

API:

- `GET /api/projects/my-work/` — curated dashboard projection
- `GET /api/projects/my-work/tasks/` — filtered/paginated assigned list

## My Work definition

A task appears when:

- tenant matches;
- task and project are active (`is_deleted=False`);
- `person_in_charge ==` authenticated user;
- project is accessible via FO-110 workspace/tenant scope.

Membership alone does **not** include another user’s tasks.

## Summary metrics

My Projects · My Assigned Tasks · In Progress · Overdue · Due Today · Due This Week · Blocked/Paused · Completed Recently

Workload counts only (no utilization/productivity scores).

## Date categories (server `timezone.localdate()`)

| Bucket | Rule |
|---|---|
| Due Today | `planned_end == today`, not completed/cancelled |
| Overdue | FO-105 `compute_delay_flags` (`planned_end < today`, active, no `actual_end`) |
| Due This Week | `today < planned_end <= week_end` (ISO week Sunday), not overdue |
| Today’s Work | date window contains today **or** due today **or** `in_progress` |
| Upcoming | `not_started` with future `planned_start` (limit 8) |
| Unscheduled | missing planned start and/or end |
| Recently Completed | completed with `actual_end` within 14 days |

Paused maps to status `on_hold`. Blocked section includes status blocked, paused, and dependency-blocked.

## Permissions

Reuses `projects.view` / `projects.tasks.view` / `projects.manage`. No new `projects.dashboard.view_assigned` permission.

Sidebar **My Work** visible for Technician workspace mode only (`canAccessMyWorkNav`). Employee requesters never see it. Route remains permission-gated for testing.

## Quick actions

Dashboard Start / Pause / Resume only (FO-111). Completion stays on Task Detail.

Mutations invalidate `["projects", "my-work"]` so the dashboard refreshes.

## Security

- Identity always from session (no `user_id` query override)
- Tenant + assignment scoping server-side
- No other Technician workload
- No PM membership/dependency/link/completion controls

## Performance

`select_related` project/manager, `prefetch_related` checklist, `batch_dependency_readiness`, capped dashboard query (~200 tasks).

## Tests

Backend: `test_project_technician_my_work.py`  
Frontend: `lib/projects/my-work.test.ts` + navigation coverage

## Acceptance

Automated API coverage for assignment isolation, date buckets, blockers, filters, quick actions, and non-auto Project completion. Manual multi-persona walkthrough remains recommended before FO-113.

## Explicit exclusions

Technician performance scores, timesheets, GPS, AI assignment, PM team workload dashboard, feature merge.
