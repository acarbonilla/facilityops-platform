# FO-110 — Technician Project Workspace

**Status:** Complete on shared feature branch (unmerged)  
**Date:** 2026-08-07  
**Branch:** `feature/project-management`  
**Draft epic PR:** [#67](https://github.com/acarbonilla/facilityops-platform/pull/67) (Draft; unmerged)  
**Next:** FO-111 — Technician Task Execution Experience (**COMPLETE**; FO-113 QA complete; FO-113A next)  
**Deferred:** FO-102  

## FO-113 status

Validated under FO-113 integrated QA. Decision: READY WITH ACCEPTED LIMITATIONS.
## Access strategy

**Implicit Project access (no auto-membership):** Technician may access a Project when they are an active `ProjectMember` **OR** Person in Charge of a non-cancelled `ProjectTask`.

Reusable helper: `apps.projects.workspace_access.can_access_project_workspace`.

Facility Manager / `projects.manage` / system_admin retain tenant-wide portfolio scope. Viewer unchanged. Employee denied.

## Permissions (seeded for `technician`)

`projects.view`, `projects.tasks.view|update|comment`, `projects.notes.view`, `projects.issues.view|report|comment`, `projects.timeline.view`, `projects.progress.view`, `projects.links.view`.

No create/delete/manage/members/assign/dependencies/recalculate/links.manage.

## Queryset scoping

`scope_projects_to_user` applies workspace filter for Technicians only.

## UI

`/projects` becomes **My Projects** for Technicians. Create hidden. Existing detail routes reused with management controls gated off.

## Membership interaction

Task assignment does **not** auto-create `ProjectMember`. Technicians may be PIC without membership (model validation updated).
