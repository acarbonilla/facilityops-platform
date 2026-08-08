# FO-115C — Project Manager and Task PIC Role-Based Assignment Refinement

**Status:** Complete on feature branch (unmerged)  
**Branch:** `feature/interactive-gantt-tenant-scope`  
**Draft PR:** [#69](https://github.com/acarbonilla/facilityops-platform/pull/69)  
**Baseline (FO-115B HEAD):** `0c7b8a4224517d4013ceff445ad07162da3ca190`  
**Merge task:** FO-115A (not started)  
**FO-102:** Deferred

---

## 1. Objective

Correct Project Manager and Project Task Person-in-Charge (PIC) assignment so FacilityOps presents only role-eligible users and enforces the same eligibility rules on the backend.

Previous mismatch:

1. Project Manager selection could include unrelated tenant users (e.g. Technicians) via the generic users directory.
2. Task PIC UI was too restrictive (members + manager only), while Technicians needed an unnecessary pre-membership step.

---

## 2. RBAC discovery

Canonical role codes (repository truth):

| Code | Typical name |
|------|----------------|
| `system_admin` | System Administrator |
| `facility_manager` | Facility Manager |
| `technician` | Technician |
| `viewer` | Viewer |
| `employee` | Employee Requester |
| `inspector` | Inspector |

There is **no** separate RBAC role code `project_manager`. Project Manager in the product sense is an assignment on `Project.project_manager`, with membership role `ProjectMember.Role.PROJECT_MANAGER` when synced.

Eligibility uses:

- Project Manager: `facility_manager` role **and/or** permission `projects.manage`
- Task PIC: `technician` role (via `workspace_access.user_has_technician_role`) **or** the Project’s current `project_manager` (self-assignment)

Same-tenant membership alone is **not** sufficient for either selector.

---

## 3. Authoritative service

`apps.projects.assignment_eligibility`:

- `eligible_project_managers(...)`
- `eligible_task_pic_users(...)`
- `validate_project_manager(...)` → `invalid_project_manager`
- `validate_task_pic(...)` → `invalid_task_pic`
- `serialize_assignment_option(...)`

Wired from `Project.clean` and `ProjectTask` PIC validation. Serializers/views/UI must not redefine rules.

---

## 4. Options APIs

| Endpoint | Scope |
|----------|--------|
| `GET /api/projects/assignment-options/project-managers/` | Active same-tenant users with Facility Manager / `projects.manage` |
| `GET /api/projects/{project_id}/assignment-options/task-pic/` | Active Technicians in tenant + current Project Manager |

Both support search and a bounded limit (default 50). Safe fields: `id`, `display_name`, `email`, `role_label`, flags (`is_project_manager`, `is_project_member` for PIC).

---

## 5. Eligibility rules

### Project Manager

Active + same tenant + (`facility_manager` **or** `projects.manage`).

Excluded: Technician-only, Employee, Viewer without management capability, inactive, cross-tenant.

**System Administrator:** Eligible when tenant-bound and holding `projects.manage` (existing permission seed). Global/tenantless admins are not normal PM candidates via tenant-scoped options.

**Optionality:** Unchanged — Project Manager remains optional.

### Task PIC

Active + same tenant + (Technician **or** this Project’s Project Manager).

Excluded: Employee, Viewer (even if ProjectMember), inactive, cross-tenant, unrelated Facility Managers without Project Manager relationship.

**Project Manager as PIC:** Yes — current PM only (small projects / self-assignment).

**Optionality:** Unchanged — Unassigned allowed; FO-104 still requires PIC before `in_progress` / `completed` where already enforced.

### Organization boundary

Same **tenant** only. No additional organization staffing restriction invented.

---

## 6. Legacy Projects

If an existing Project has a technically invalid Project Manager under the new rule:

- Read remains allowed
- Assignment is not silently cleared
- Changing the manager requires an eligible successor (`allow_legacy_unchanged` on validate)

Same pattern for legacy PIC when unchanged.

No destructive mass reassignment. No schema migration.

---

## 7. Membership vs PIC access

**Decision:** Do **not** auto-create `ProjectMember` on PIC assignment.

FO-110 implicit workspace access remains:

- ProjectMember **or** Task PIC → Project / workspace visibility
- PIC grants minimum execution access only (view project, assigned task, My Work, FO-111 execution, comments/checklist/attachments/blocker)
- PIC does **not** grant create/edit/delete Project, member management, assignment management, dependency/link management, progress recalculation authority, or Project completion

Reassignment / unassignment / multiple assignments:

- New PIC gains implicit access
- Old PIC loses implicit access when no other assigned tasks **and** not a ProjectMember
- Explicit ProjectMember is never removed by PIC changes
- Multiple assigned tasks preserve access until the last assignment ends

Visibility (ProjectMember Viewer) ≠ PIC eligibility.

---

## 8. Frontend UX

- `ProjectAssignmentPicker` uses options APIs (not full user directory for these roles)
- Helper text clarifies eligible Facility/Project Managers and Technician/PM PIC
- Empty states: “No eligible Project Managers found.” / “No eligible Technicians found.”
- Selected identity: Name · Role · Email
- Search + touch-friendly full-width select patterns

---

## 9. RBAC seed / migration

- **seed_rbac:** No change required — existing `projects.manage` and Technician role codes suffice
- **Migration:** None (policy/API/UI only); `makemigrations --check` clean

---

## 10. Tests / validation (at implementation)

| Gate | Result |
|------|--------|
| FO-115C backend suite | 15 OK |
| `apps.projects` | **311 OK** (PostgreSQL `--keepdb`; was 296 + FO-115C) |
| Frontend suite | **532 pass** (528 baseline + assignment-options helpers) |
| Django check | Pass |
| makemigrations --check | No changes |
| Migration | None |
| FO-102 | Deferred |
| Merge | Not performed — FO-115A |

Regression coverage includes workspace/My Work/implicit access, reassignment, execution `actual_start`/`actual_end`, and tenant isolation.

---

## 11. Next

**FO-115A** — Finalize, merge Draft PR #69 (FO-115 + FO-115B + FO-115C), and post-merge verification.  
**FO-102** remains deferred.

---

## 12. Explicit exclusions (honored)

Multiple PMs, capacity planning, auto/AI technician assignment, skills matching, shift scheduling, contractor staffing, approval workflows, new notifications, drag-to-reschedule, further Gantt redesign, FO-102, merge to main.
