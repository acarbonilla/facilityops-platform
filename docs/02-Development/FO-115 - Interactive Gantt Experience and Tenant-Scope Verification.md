# FO-115 — Interactive Gantt Experience and Tenant-Scope Verification

**Status:** COMPLETE ON FEATURE BRANCH (UNMERGED)  
**Date:** 2026-08-08  
**Branch:** `feature/interactive-gantt-tenant-scope`  
**Starting main SHA:** `2fae32bd36be322345ab0ecdb5d5c44de1265f2f`  
**Baseline:** FO-114 / FO-114A COMPLETE AND MERGED  
**Deferred:** FO-102 Gemini billing/quota diagnostics  
**Merge task:** FO-115A (not started)  
**Follow-on on same branch:** FO-115B Planned vs Actual; FO-115C assignment refinement (see sibling docs)

## 1. Objective

Refine the Project Gantt into an interactive schedule viewer (pan/navigation only — no drag-to-reschedule) and verify Project list/Gantt data remain correctly tenant-scoped while clarifying Organization presentation.

## 2. Repository preflight

| Check | Result |
| --- | --- |
| Fetch/prune | Performed |
| `main` == `origin/main` | Yes @ `2fae32b…` |
| FO-114 on main | Confirmed |
| Tracked tree | Clean (untracked `backend/attachments/` preserved) |
| Prior FO-115 | None |
| Branch collision | None |
| FO-115A | Not started |
| FO-102 | Deferred |

## 3. Architecture discovery

### Tenant vs Organization

- `Project.tenant` and `Project.organization` are distinct FKs.
- List serializer exposes `organization_name` (and `tenant` ID), not tenant name.
- Ambiguous Project list subtitle was **Organization**, not Tenant.
- Scoping: `scope_projects_to_user` filters `tenant_id` for non-global users; System Admin / superuser may have global scope.
- Facility Manager / Technician / Viewer remain tenant-bound.
- Same-tenant multiple Organizations may appear; Tenant B never appears.

### Gantt baseline

- GET `/api/projects/{id}/gantt/` — read-only payload; scoped via project queryset (cross-tenant → 404).
- Frontend: React + Tailwind + SVG; no third-party Gantt library.
- FO-114: milestones explicit; unscheduled excluded from chart bars.

## 4. Tenant security result

Focused suite `test_project_tenant_scope_fo115.py`:

- Tenant A list shows Org A + Org B projects; excludes Tenant B.
- Detail / Gantt / Tasks / Progress / Timeline / Links / Task detail → 404/403 for Tenant B.
- FM / Technician / Viewer tenant-bound.
- Employee denied.
- My Work does not expose Tenant B.
- **No Critical cross-tenant exposure found.** No scoping logic change required.

System Administrator: global scope preserved via `has_global_project_scope` (superuser / `system_admin`).

## 5. Project list presentation

- Desktop: separate **Organization** column (Project name no longer carries unlabeled org subtitle).
- Mobile: `Organization: {name}` explicit label.
- Tenant name not shown to ordinary users.

## 6. Gantt architecture (FO-115)

| Decision | Choice |
| --- | --- |
| Package | **No new dependency** — native scroll + pointer pan |
| Pan | Pointer-drag empty timeline adjusts `scrollLeft` (navigation only) |
| Sticky | Sticky left Task column + sticky top calendar header |
| Headers | Rich month bands + day/week/month cells; weekend shading on day zoom |
| Bars | Duration bars + progress fill; same-day short bars; milestone diamonds |
| Selection | Click/keyboard select → detail popover; Escape closes; related deps highlight |
| Mutations | None via Gantt — edits remain on Task form |
| Mobile | Interactive Gantt `md+`; Schedule table primary on phone |

## 7. Validation

| Gate | Result |
| --- | --- |
| FO-115 tenant tests | 6 OK |
| `apps.projects` | **276 OK** (PostgreSQL `--keepdb`; was 270 + FO-115 tenant suite) |
| Frontend suite | **522 pass / 0 fail** |
| ESLint | Pass (after unused import cleanup) |
| TypeScript | Pass |
| Production build | Pass |
| Django check | Pass |
| makemigrations --check | No changes |
| Migration | None |
| FO-102 | Deferred |
| Merge | Not performed — FO-115A |

## 8. Limitations

- Interactive browser Lobby / tenant manual scenarios not executed in agent session.
- No drag-to-reschedule / dependency drawing / critical path (explicit exclusions).
- Light inertial pan not implemented (native scroll sufficient).

## 9. Explicit exclusions (honored)

Drag-to-reschedule, bar resize, inline date edit, connector drawing, critical path, resource leveling, AI scheduling, calendar sync, FO-102, unrelated redesign.
