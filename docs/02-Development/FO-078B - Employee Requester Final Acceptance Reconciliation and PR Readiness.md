# FO-078B - Employee Requester Final Acceptance Reconciliation and PR Readiness

## Status

Final acceptance reconciliation complete. FO-078 and FO-078A manual acceptance
passed on **2026-07-26** (User-performed). Cumulative scope and security review
found no unresolved blocking defects. PR #42 was marked Ready for review by
FO-078B and was subsequently **merged** into `main` by FO-078C on 2026-07-26
at merge commit `7102a4ef8102dc45f63d94282729a672934cecf0`. FO-079 has not
started.

## Purpose

FO-078B reconciles the complete Employee Requester Experience delivered through
FO-075–FO-078A. This task records manual acceptance, reviews the cumulative
PR #42 diff against `main`, synchronizes documentation, and marks PR #42 Ready
for review only when every acceptance gate passes.

This is a reconciliation and release-readiness task—not a new implementation
task. No production code was changed during FO-078B.

## Preflight

| Check | Result |
| --- | --- |
| Repository | `facilityops-platform` |
| Branch | `feature/employee-requester` |
| Starting HEAD | `05df9f1fb1f4c662657001c68c7d73ebc96a870f` |
| Origin equality | Local matched `origin/feature/employee-requester` |
| Working tree | Clean at FO-078B start (after restoring unrelated uncommitted UI WIP) |
| PR #42 | OPEN, DRAFT → Ready for review; unmerged |
| PR base / head | `main` / `feature/employee-requester` |
| PR head SHA (start) | `05df9f1fb1f4c662657001c68c7d73ebc96a870f` |
| Mergeable | MERGEABLE / CLEAN |
| Required checks | GitGuardian Security Checks: SUCCESS |
| Review threads | None |
| Milestones present | FO-075, FO-076, FO-077, FO-077A, FO-078, FO-078A |
| FO-078B prior state | Not completed before this task |

### Preflight note — uncommitted UI WIP

An uncommitted layout change to
`frontend/features/admin/users/components/user-role-assignment-dialog.tsx`
(Manage Roles modal portal/overlap polish from a prior session) was present at
FO-078B start. It was **restored to HEAD** so FO-078B could proceed as
documentation-only against the validated FO-078A baseline. The overlap is
recorded below as a non-blocking Low UX observation and is **not** part of this
reconciliation commit.

## Manual acceptance evidence

### FO-078 Manual Acceptance

| Field | Value |
| --- | --- |
| Result | **Passed** |
| Acceptance date | **2026-07-26** |
| Performed by | User |
| Skipped items | None |
| Failures | None |
| Automated baseline | Already passed (FO-077A / FO-078A lineage) |
| Final reconciliation | FO-078B |

Codex did **not** independently perform the browser tests.

### FO-078A Manual Retest

| Field | Value |
| --- | --- |
| Result | **Passed** |
| Acceptance date | **2026-07-26** |
| Account | `doejane@gmail.com` |
| Tenant | XYZ Company |
| Role | System Administrator |
| Staff | No |
| Superuser | No |
| Steps completed | 1–21 |
| Skipped items | None |
| Failures | None |
| Performed by | User |

Codex did **not** independently perform the browser retest.

## Automated evidence (reused)

No production code changed after `05df9f1fb1f4c662657001c68c7d73ebc96a870f`.
FO-078B therefore **reuses** the fresh FO-078A automated evidence and does
**not** rerun full backend or frontend suites.

| Gate | Result |
| --- | --- |
| Full backend `--parallel 4 --noinput` | **661 passed** (exit 0) |
| Frontend complete tests | **267 passed** |
| ESLint | Passed |
| `tsc --noEmit` | Passed |
| Production build | Passed |
| Django check | Passed |
| `makemigrations --check --dry-run` | No changes |
| Dependencies added | None |

### Lightweight reconciliation checks run during FO-078B

```text
git status --short
git rev-parse HEAD
git rev-parse origin/feature/employee-requester
git diff --check
git diff --stat origin/main...HEAD
git diff --name-only origin/main...HEAD
gh pr view 42 --json ...
```

## Cumulative scope review (PR #42 vs `main`)

### Included milestones

- FO-075 — Employee requester backend foundation
- FO-076 — Employee My Requests frontend experience
- FO-077 — Requester cancel / acknowledge / reopen + notification targets
- FO-077A — Workflow concurrency locking + confirmation-dialog accessibility
- FO-078 — Cumulative QA and stabilization (docs)
- FO-078A — User Management tenant-isolation security correction
- FO-078B — Final acceptance reconciliation (this task; docs/PR metadata)

### Changed-file categories

| Category | Assessment |
| --- | --- |
| Backend production | Employee RBAC, FM Ticket requester scope/serializers/views/workflows, notification targets, User Management scope helpers |
| Backend tests | Employee requester, workflow, concurrency, Tenant-bound System Admin user isolation |
| Frontend production | My Requests routes/UI/hooks/helpers, Employee navigation, notification target remapping, User Management Tenant filter/org scoping |
| Frontend tests | My Requests helpers + User Management role helper updates |
| Documentation | FO-075–FO-078A docs + development status trackers |
| Migrations | **None** |
| Dependencies | **None** (`frontend/package.json` only adds My Requests test paths to the `test` script) |
| Unrelated drift | **None** material out-of-scope production changes identified |

## Review findings by area

### A. Backend — PASS

- Employee sees only own FM requests via `requester_id=user.id` when in employee
  requester scope
- Tenant boundaries enforced by `scope_fm_ticket_queryset`
- Same-Tenant non-owned and cross-Tenant inaccessible objects fail safely
  (generic 404)
- Requester and Tenant identity come from authenticated backend context
- Client payloads cannot impersonate another requester or Tenant
- Cancel / acknowledge / reopen use dedicated requester workflow rules with
  `select_for_update` locking (FO-077A)
- Facility Manager / operational Tenant-wide behavior preserved for broader
  permission holders
- Employee role limited to `fm_tickets.view` and `fm_tickets.create`
  (`STRICT_ROLE_PERMISSION_CODES`)
- Staff alone grants no application permission bypass
- User Management list/detail/mutation/role assignment Tenant-scoped for
  Tenant-bound `system_admin` (FO-078A)
- Cross-Tenant User Management UUID access returns generic 404
- Transaction / rollback / audit / UUID / soft-deletion contracts preserved

### B. Frontend — PASS

- Employee navigation exposes only authorized destinations
- My Requests uses requester-safe queries and routes
- Create form does not submit authoritative Tenant or requester identity
- Lifecycle actions match backend eligibility flags
- Notification links open requester-safe `/my-requests/{id}` pages
- Cross-Tenant / not-found UI does not intentionally leak metadata
- Tenant-bound administrators do not receive global Tenant filters
- Organization choices remain Tenant-scoped
- Session query-cache clearing on logout/account switch preserved
- Frontend checks are defense-in-depth only; backend remains authoritative

### C. API / contract — PASS

No accidental breaking change identified to operational FM Ticket APIs,
Notification APIs, User Management APIs, role-assignment APIs, query keys,
serializers, pagination, or established response/error shapes beyond the
intentional FO-078A Tenant-scope correction for Tenant-bound System
Administrators.

### D. Security reconciliation — PASS

| Invariant | Result |
| --- | --- |
| Object ownership | Employee requester ownership enforced |
| Tenant isolation | FM Tickets and User Management scoped |
| Generic 404 behavior | Same-Tenant non-owned and cross-Tenant share safe failure |
| Role boundaries | Employee limited to view/create |
| Staff / Superuser | Staff alone no bypass; Superuser global retained |
| System-role immutability | Seed/strict Employee permissions preserved |
| Crafted payloads | Client Tenant/requester impersonation rejected |
| Direct UUID access | Scoped queryset → generic 404 |
| Search / filter isolation | Applied after authoritative scope |
| Cached frontend state | Cleared on logout/account switch |
| Audit / transactions | Workflow locks and rollback preserved |

### E. Staff / System Administrator / Superuser — PASS

- `is_staff` alone: no User Management or requester bypass
- Tenant-bound `system_admin`: Tenant-scoped User Management; may assign system
  roles within visible Tenant scope
- Tenantless `system_admin` and Superuser: platform-global User Management
  retained per established contract
- FM Ticket `has_global_fm_ticket_scope` continues to treat active
  `system_admin` (including Tenant-bound) as global Ticket administrators per
  FO-075 approved design (distinct from User Management data scope)

## Findings and severity

| ID | Severity | Area | Notes | Disposition |
| --- | --- | --- | --- | --- |
| FO-078-O1..O6 | Low / Info | Prior FO-078 | Existing non-blocking observations | Deferred; unchanged |
| FO-078B-O1 | Low | UX | Manage Roles dialog can visually overlap sidebar/title when rendered inside scrollable main content | Documented only; uncommitted polish restored; not acceptance-blocking |

**Blocking findings:** None (Critical / High / Medium-affecting-acceptance).

## Migration and dependency confirmation

- Migrations introduced by FO-075–FO-078B: **none**
- Dependencies added: **none**

## PR readiness decision

All FO-078B gates pass:

- FO-075 through FO-078A present
- FO-078 manual acceptance Passed (2026-07-26)
- FO-078A manual retest Passed (2026-07-26)
- Automated validation reused and remains valid
- Cumulative review: no unresolved blocking defect
- PR scope correct
- Documentation synchronized
- No unintended migration or dependency change
- No unresolved required check or blocking review conversation
- Branch pushed and clean after FO-078B commit
- PR remains unmerged

**Decision (FO-078B):** Mark PR #42 Ready for review. Do **not** merge in
FO-078B. Wait for explicit merge authorization. Do **not** begin FO-079.

## Deferred scope

- Comments
- Attachments
- AI functionality
- Email / SMS / push delivery
- WebSocket / SSE
- Broader requester self-service
- FO-063 automatic Ticket closure (reserved/deferred)
- Manage Roles dialog layout polish (FO-078B-O1)
- FO-079 and later features

## Pull request

PR #42 was Ready for review after FO-078B and was **merged** into `main` by
FO-078C on 2026-07-26 (merge commit
`7102a4ef8102dc45f63d94282729a672934cecf0`). See
`docs/02-Development/FO-078C - Employee Requester PR Merge and Main-Branch Verification.md`.
