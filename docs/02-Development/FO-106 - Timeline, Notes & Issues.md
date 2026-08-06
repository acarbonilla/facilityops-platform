# FO-106 — Timeline, Notes & Issues

**Status:** Complete on shared feature branch (unmerged)  
**Date:** 2026-08-06  
**Branch:** `feature/project-management`  
**Starting branch SHA:** `5d45b9c139c5f86ec327ecdd0d0179ced4455b11`  
**Branch HEAD (FO-106):** `ada12ce3aaef326f3ac27cd32ca35877411ad43c`  
**Commits:** `81e61b4` (backend), `3a4123b` (frontend), `ada12ce` (docs)  
**Prior checkpoints:** FO-103, FO-104, FO-105  
**Next:** FO-107 — Progress & Accomplishment Tracking (**not started**)  
**Draft epic PR:** [#67](https://github.com/acarbonilla/facilityops-platform/pull/67) (Draft; unmerged until FO-109A)  
**Deferred:** FO-102 — Gemini Billing, Quota & Rate Limit Diagnostics

## 1. Objective

Add the Project collaboration and history layer: read-only Project Timeline, Project Notes, and Project Issues (internal blockers — not FM Tickets), with attachments, issue comments, permissions, and secure tenant scoping.

## 2. Timeline architecture

- **Service:** `ProjectTimelineService` maps `ProjectHistory` into a unified newest-first feed
- **MVP source:** ProjectHistory only (note/issue/comment/task/dependency/project CRUD already write history)
- **Attachment rows:** appear when corresponding history exists; no separate attachment-merge required for MVP
- **Read-only:** no timeline editing

## 3. Notes

`ProjectNote`: title, `note` body, category (general/meeting/decision/safety/material/contractor/client/other), author, soft-delete.  
Attachments owner type: `project_note`.

## 4. Issues

`ProjectIssue`: title, description, severity (low→critical), status (open/investigating/blocked/resolved/closed/cancelled), owner, due_date, resolved_at.  
`ProjectIssueComment`: flat comments.  
Attachments owner type: `project_issue` (immutable when resolved/closed/cancelled).  
**Does not** create FM Tickets, Maintenance, Inspections, AI actions, or notifications (FO-108+).

## 5. APIs

| Path | Methods |
| --- | --- |
| `/api/projects/{id}/timeline/` | GET |
| `/api/projects/{id}/notes/` | GET/POST |
| `/api/projects/{id}/notes/{note_id}/` | GET/PATCH/DELETE |
| `/api/projects/{id}/issues/` | GET/POST |
| `/api/projects/{id}/issues/{issue_id}/` | GET/PATCH/DELETE |
| `/api/projects/{id}/issues/{issue_id}/comments/` | GET/POST |
| `.../comments/{comment_id}/` | DELETE |

## 6. Permissions

`projects.timeline.view`, `projects.notes.view|manage`, `projects.issues.view|manage|comment` (+ `projects.view|manage` aliases). Viewer: view-only. Employee: denied.

## 7. Frontend

Routes: `/timeline`, `/notes`, `/issues` (+ new/detail/edit). Project detail links. Filters/search; mobile cards; accessible badges.

## 8. Migration

`projects.0004_project_notes_issues_timeline_fo106`

## 9. Tests

- Backend `apps.projects`: **131 OK** (includes FO-103–106)
- Frontend suite: **479 pass**

## 10. Acceptance

Automated API + frontend unit + code-path review. Interactive browser not claimed.

## 11. Exclusions

FO-107 accomplishment; FO-108 integrations; AI; notifications; budgets; merge to main; FO-102.

## 12. Checkpoint status

FO-106 complete on `feature/project-management`, unmerged. FO-107 not started. FO-102 deferred.
