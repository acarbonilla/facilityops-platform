# FO-108 — FacilityOps Module Integration

**Status:** Complete on shared feature branch (unmerged)  
**Date:** 2026-08-07  
**Branch:** `feature/project-management`  
**Starting branch SHA:** `29f398599e866091ad2719a6875bff057518bedb`  
**Branch HEAD (FO-108):** `6fc44446b956d3c736368178260901aa8f55c4e6`  
**Commits:** `9d6471c` (backend), `b90d533` (frontend), `6fc4444` (docs)  
**Prior checkpoints:** FO-103–FO-107  
**Next:** FO-109A — Finalize, Merge & Post-Merge Verification (**not started**)  
**FO-109:** Complete — see `docs/02-Development/FO-109 - Project Management QA and Production Readiness.md`  
**Draft epic PR:** [#67](https://github.com/acarbonilla/facilityops-platform/pull/67) (Draft; unmerged until FO-109A)  
**Deferred:** FO-102 — Gemini Billing, Quota & Rate Limit Diagnostics

## 1. Objective

Add optional, permission-safe reference links between Projects (and optional Project Tasks) and FM Tickets, Maintenance Work Orders, and 5S Inspections — without cross-module status sync, mandatory FKs on operational tables, or privilege escalation.

## 2. Selected architecture

**Project-owned `ProjectOperationalLink`** with three nullable FKs (`fm_ticket`, `maintenance_work_order`, `inspection`) and a CheckConstraint enforcing exactly one target. No Django GFK. No `project_id` on operational modules. No `inspection_finding` link type (Inspection is the supported entity).

## 3. Integration semantics

Links are references only. Target workflows, SLAs, assignments, scores, and statuses remain owned by their modules. Project accomplishment remains task-progress-based (FO-107). Project Issues ≠ FM Tickets.

## 4. Dual authorization

List/detail summaries require Project access **and** target view permission. Inaccessible targets return `{target_accessible: false}` without sensitive fields. Reverse `linked_projects` requires Project access; FM employee-requester scope returns `[]`.

## 5. Model & relationships

`link_type`: fm_ticket | maintenance_work_order | inspection  
`relationship`: related | source | execution | corrective_action | evidence | follow_up  
Optional `project_task` (same Project). Soft-delete. Unique active links per Project+type+target.

## 6. APIs

| Path | Methods |
| --- | --- |
| `/api/projects/{id}/links/` | GET/POST |
| `/api/projects/{id}/links/{link_id}/` | GET/PATCH/DELETE |
| `/api/projects/{id}/link-options/?type=&search=` | GET |

PATCH may edit relationship/notes/project_task only — not target.  
Reverse: `linked_projects` on FM/WO/Inspection retrieve serializers.

## 7. Task deletion

Soft-delete of a Project Task is **blocked** while active operational links reference it (structured error with link details).

## 8. Frontend

- `/projects/{id}/links` management UI
- Task detail compact links
- Internal Linked Projects on FM Ticket / Maintenance / Inspection detail (not my-requests)

## 9. Boundaries

No progress impact from links; no Gantt bars for operational records; no Issue→Ticket create; no notifications; no AI; no mandatory FKs.

## 10. Permissions

`projects.links.view`, `projects.links.manage` (+ view/manage aliases). Viewer: view only. Employee: denied from PM.

## 11. Migration

`projects.0006_project_operational_links_fo108` — projects app only.

## 12. Tests

- Backend: FO-108 **45** + full `apps.projects` **220 OK**
- Frontend suite: **496 pass**

## 13. Acceptance

Automated API + frontend unit + code-path review. Interactive browser not claimed.

## 14. Checkpoint status

FO-108 complete on `feature/project-management`, unmerged. FO-109 QA complete (READY WITH ACCEPTED LIMITATIONS). FO-109A next. FO-102 deferred.
