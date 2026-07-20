# FO-078 - Employee Requester Experience QA and Stabilization

## Status

Cumulative repository QA complete on `feature/employee-requester`. Pull request
#42 remains open, draft, and unmerged. Manual browser acceptance is **pending**.
The Employee Requester Experience is **not** approved for merge until manual
acceptance and Sol’s final review are complete.

## Purpose

FO-078 is the cumulative QA and stabilization review for FO-075 through FO-077A
on `feature/employee-requester` (PR #42). This task performed static contract
reconciliation across RBAC, tenant isolation, safe API representations,
request creation, frontend requester mode, workflows, concurrency, notifications,
and accessibility. No production defects were confirmed. Documentation and a
manual browser acceptance checklist were prepared for the User and Sol.

## Preflight

| Check | Result |
| --- | --- |
| Branch | `feature/employee-requester` |
| HEAD | `cbdd0a4c5cf2f2e75eb686fc8108b8cf5ae25685` |
| Origin equality | Local matched `origin/feature/employee-requester` |
| Working tree | Clean at FO-078 start |
| PR #42 | OPEN, DRAFT, unmerged; base `main`, head `feature/employee-requester` |
| Milestones present | FO-075, FO-076, FO-077, FO-077A |
| FO-078 prior state | Not implemented before this task |
| Next.js drift | None at FO-078 start |

## Accepted FO-077A validation baseline

FO-078 acknowledges the fresh FO-077A baseline as cumulative evidence and did
**not** rerun full suites because no production defect was confirmed:

| Gate | Result |
| --- | --- |
| Full backend `--parallel 4` | 654 passed (exit 0) |
| `apps.fm_tickets` + `apps.notifications` | 202 passed |
| Frontend helper tests | 264 passed |
| ESLint | Passed |
| TypeScript | Passed |
| Production build | Passed |
| Django check | Passed |
| Migration drift | None |

## QA scope reviewed

Cumulative production changes across:

- **FO-075** — Employee role, requester authorization, safe serializers, scoped
  queryset, request-options, requester-safe creation
- **FO-076** — My Requests frontend, requester-mode routing, session cache
  hygiene, operational FM Ticket redirects
- **FO-077** — Requester cancel/acknowledge/reopen workflows and notification
  target alignment
- **FO-077A** — Requester workflow concurrency locking and accessible
  confirmation modal

## Confirmed production defects

**None.**

## Observations (non-blocking, no code change)

| ID | Severity | Area | Notes |
| --- | --- | --- | --- |
| FO-078-O1 | Low | UX | Advisory `can_cancel` on detail may be briefly stale if a Work Order is generated concurrently; backend revalidation under lock is authoritative |
| FO-078-O2 | Low | UX | Create form relies on disabled submit during pending; no explicit `isPending` guard in `handleSubmit` (unlike workflow actions) |
| FO-078-O3 | Low | Defense-in-depth | Some operational endpoints (`assign`, `change_status`, `generate-work-order`) rely on missing RBAC permissions (403) rather than explicit requester-scope 404; not a representation leak |
| FO-078-O4 | Low | Deferred scope | Requester reopen does not sync linked Maintenance Work Order; one-way Maintenance→Ticket sync remains by design |
| FO-078-O5 | Low | Pre-existing | Operational `change_status` does not use `select_for_update`; out of FO-077A requester-requester scope |
| FO-078-O6 | Info | Test gap | No explicit employee `GET` detail test for soft-deleted own ticket; code path excludes deleted rows in queryset |

## Cumulative findings by review area

### A. Employee RBAC — PASS

- Employee is an immutable active system role (`seed_rbac`, `access_control/services`)
- Employee has only `fm_tickets.view` and `fm_tickets.create`
- Reseeding deactivates unexpected Employee permissions (`STRICT_ROLE_PERMISSION_CODES`)
- Viewer unchanged
- `is_staff` alone grants no permission or scope bypass
- Employee + operational role keeps operational tenant scope and blocks requester endpoints
- Inactive users, roles, assignments, tenants, and organizations fail closed

### B. Tenant and requester isolation — PASS

- List and detail scoped to `requester_id=user.id` for employee-only mode
- Same-tenant non-owned and cross-tenant UUIDs return indistinguishable generic 404
- Soft-deleted tickets excluded from queryset
- Query filters cannot broaden ownership or tenant scope
- Client-supplied tenant/requester/organization rejected on create and request-options
- `is_staff` does not bypass employee ownership; superuser/system_admin exit employee requester mode by approved global design (FO-075)

### C. Safe API representations — PASS

Employee list/detail/create omit internal comments, assignment notes, raw history,
escalation data, SLA/internal metadata, other requester identities, Work Order
authority, and administrative fields. Request-options exposes minimum active
same-tenant, same-organization option fields without `settings.view`.

### D. Request creation — PASS

Approved fields only; authenticated requester/tenant/organization are
authoritative; hierarchy validation is backend-enforced; stale frontend location
selections are cleared before submit; duplicate submit mitigated via pending
disablement; API validation remains in-page.

### E. Frontend requester-mode routing — PASS

Employee-only navigation shows Dashboard + My Requests; operational modules
hidden; multi-role users retain operational experience; `/fm-tickets` routes
redirect employee-only users; `/my-requests` rejects non-requester users;
`is_staff` is not a frontend bypass; session query cache clears on
logout/login/token loss.

### F. Requester workflows — PASS

Cancel, acknowledge, and reopen follow dedicated requester-owned endpoints with
backend eligibility; reasons required where specified; active Maintenance
execution blocks cancellation; operational users use operational endpoints;
backend `can_*` flags drive frontend actions; invalid/repeated actions do not
duplicate history or notifications.

### G. Concurrency and atomicity — PASS

Ticket row locks with `select_for_update` inside `transaction.atomic`; eligibility
re-evaluated after locked reload; cancellation lock order Ticket → Work Order;
only one conflicting concurrent requester action commits; notification failure
rolls back state and histories; lock order compatible with Work Order generation.

### H. Notification alignment — PASS

Employee requester recipients receive `/my-requests/{uuid}`; operational
recipients receive `/fm-tickets/{uuid}`; actor exclusion and recipient
deduplication preserved; rejected/no-op actions create no notification; legacy
operational targets remapped in Employee frontend mode; in-app delivery only.

### I. UX and accessibility — PASS

List/detail/create cover loading, error, empty, and not-found; status/category
language is requester-friendly; workflow confirmation modal implements accessible
name/description, initial focus, Tab cycle, Escape when not pending, focus return,
pending close protection, and narrow-screen layout.

### J. Performance and queries — PASS (static)

No N+1 or unbounded queryset defects identified in employee requester paths
during static review. Request-options uses scoped active-record queries. List
filters apply after authoritative scope.

## Tests added or updated during FO-078

**None.** No production defect required correction or new regression coverage.

Existing cumulative test evidence remains authoritative from FO-075 through
FO-077A (requester authorization, workflow, concurrency, frontend helpers).

## Commands actually run during FO-078

Lightweight repository hygiene only (no full backend/frontend/build reruns):

```text
git status --short
git diff --stat
git diff --name-only
git diff --check
python manage.py check
python manage.py makemigrations --check --dry-run
```

All passed with no output drift.

## Migration and dependency confirmation

No migrations and no new dependencies introduced during FO-078.

## Manual browser acceptance

**Status: Pending — not executed by Codex.**

Use the checklist below. Return results to the project tracker before Sol review
or merge readiness.

### Required accounts

- Employee-only user in Tenant A
- Another Employee in Tenant A
- Employee in Tenant B
- Facility Manager or other operational user in Tenant A
- Staff-only user (if available)
- Optional Employee + operational multi-role user

### Browser checklist

| # | Step | Pass criteria |
| --- | --- | --- |
| 1 | Log in as Employee-only (Tenant A) | Navigation shows **Dashboard** and **My Requests** only |
| 2 | Open My Requests list | Only the signed-in Employee’s own requests appear |
| 3 | Compare with another Employee’s request in Tenant A | Other Employee’s request is **absent** from the list |
| 4 | Open a known non-owned same-Tenant detail URL | Safe not-found (no data leak) |
| 5 | Open a known cross-Tenant detail URL | Same safe not-found as step 4 |
| 6 | Open Create Request | Requester-safe form only; no operational fields |
| 7 | Verify Organization field | Derived/read-only from authenticated identity |
| 8 | Change Building → Floor → Area → Asset | Cascading options work; invalid child selections clear |
| 9 | Submit a valid new request | Request created and owned by the Employee |
| 10 | Return to My Requests list | New request appears |
| 11 | Review detail page | No operational fields, assignment controls, or admin data |
| 12 | Cancel an eligible open request | Confirmation modal, required reason, success message |
| 13 | Attempt cancel on ineligible/in-progress request | Cancel not offered or backend rejects safely |
| 14 | Acknowledge a resolved request | Status becomes closed |
| 15 | Reopen a resolved request with reason | Status returns to in progress |
| 16 | Trigger Employee notification | Opens `/my-requests/{id}` without operational UI flash |
| 17 | Log in as Facility Manager | Standard FM Ticketing navigation and workflow remain |
| 18 | Log in as Staff-only (if available) | No requester or operational bypass |
| 19 | Logout or switch accounts | Previous user’s cached requests do not appear |
| 20 | Narrow viewport + keyboard | Dialog and form usable; Tab/Escape/focus behave correctly |

### Return format for the User

Please report:

- **Result:** Passed or Failed
- **Acceptance date**
- **Accounts/roles tested**
- **Skipped items** (if any)
- For failures: step number, expected result, actual result, screenshot or error text

## Deferred scope

- Comments
- Attachments
- AI integration
- Broader requester self-service
- FO-063 automatic Ticket closure (reserved/deferred)
- Manual browser acceptance (pending User execution)

## Readiness for Sol review

Repository cumulative QA is complete with no confirmed production defects. The
feature is **ready for Sol’s static/final review** subject to pending User
manual browser acceptance. PR #42 remains draft and unmerged.

## Pull request

PR #42 remains open, draft, and unmerged.
