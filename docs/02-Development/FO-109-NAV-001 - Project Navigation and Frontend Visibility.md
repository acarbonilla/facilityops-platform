# FO-109-NAV-001 — Project Navigation & Frontend Visibility Verification

**Status:** Complete on shared feature branch (unmerged)  
**Date:** 2026-08-07  
**Branch:** `feature/project-management`  
**Parent:** FO-109 — Project Management QA & Production Readiness  
**Starting branch HEAD:** `306f30384e944063763dc988e1c080c92538332e`  
**Draft epic PR:** [#67](https://github.com/acarbonilla/facilityops-platform/pull/67) (remains Draft; unmerged)  
**Deferred:** FO-102; FO-109A not started  

## 1. Concern

Projects sidebar item was not visible despite FO-103–FO-108 frontend implementation.

## 2. Preflight

| Check | Result |
| --- | --- |
| Branch | `feature/project-management` |
| Local = origin | Yes @ FO-109 tip before this task |
| FO-103–FO-108 | Present |
| PR #67 | OPEN, Draft |
| Tracked tree | Only local Next.js `next-env.d.ts` / `tsconfig.json` path drift (unrelated; not committed) |

## 3. Direct route verification

| Route | Classification |
| --- | --- |
| Source under `app/(app)/projects/**` | Present (20 page files) |
| Production build inventory (FO-109) | `/projects`, `/projects/new`, detail/edit/tasks/gantt/timeline/notes/issues/progress/links present |
| Expected when authorized | **A** — route exists and opens (permission-gated pages use `projects.view`) |
| Expected when unauthorized / missing seed | **B** — permission denied / nav hidden |

**Conclusion:** Routes exist. Absence of sidebar item is not a missing-route defect.

## 4. Navigation registration

`frontend/lib/navigation.ts` already contains:

```ts
{
  label: "Projects",
  href: "/projects",
  authenticatedOnly: true,
  requiredPermissions: ["projects.view"],
  matchStrategy: "prefix",
}
```

Placement: immediately after Maintenance. Permission key matches backend contract `projects.view`. No feature flag.

## 5. Root cause

**Confirmed:** missing Project permission seed data in the running local database — not missing navigation registration.

Live DB check before remediation:

- `Permission` rows with `code__startswith='projects.'`: **0**
- `projects.view` on `system_admin` / `facility_manager` / `viewer`: **absent**
- Employee: correctly has no Project permissions

Sidebar filters with `requiredPermissions: ["projects.view"]`. Without that code from `/access-control/me/permissions/`, Projects is hidden even for Facility Manager / System Admin accounts that otherwise see Maintenance.

`seed_rbac.py` already defined and assigned Project permissions (FO-103+). The local database had not been re-seeded after those definitions landed.

## 6. Remediation

1. Ran `python manage.py seed_rbac` against the local backend database.
2. Post-seed verification:
   - 26 `projects.*` permissions present
   - `system_admin` / `facility_manager`: `projects.view` True (26 codes)
   - `viewer`: `projects.view` True (9 codes)
   - `employee`: `projects.view` False (0 codes)
3. Hardened Employee Requester nav exclusion to include `/projects` (defense-in-depth if `projects.view` were ever granted incorrectly).
4. Added `frontend/lib/navigation.test.ts` regression coverage for placement, permission gating, and employee hide.

## 7. Operator action (existing environments)

After pulling `feature/project-management`, run:

```bash
python manage.py seed_rbac
```

Then sign out/in (or refresh) so `/access-control/me/permissions/` reloads. No frontend rebuild is required solely for permission seed refresh; restart the backend if it was already running against the stale DB.

## 8. Classification summary

| Hypothesis | Result |
| --- | --- |
| Missing navigation registration | Ruled out — present |
| Incorrect permission key | Ruled out — `projects.view` correct |
| Missing route implementation | Ruled out |
| Stale frontend build / cache | Not the primary cause |
| Frontend permission-state mismatch | Symptom of missing backend seed |
| Backend permission API | Correct; returned empty Project codes because DB lacked them |
| **Missing role-permission seed data in running DB** | **Confirmed root cause** |

## 9. Tests

- `lib/navigation.test.ts` (4 cases) added to `npm test`
- Re-run navigation tests after change

## 10. Branch / PR policy

Continues on `feature/project-management`. Draft PR #67 remains Draft and unmerged. FO-109A not started. FO-102 deferred.
