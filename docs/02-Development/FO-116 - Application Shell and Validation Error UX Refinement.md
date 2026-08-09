# FO-116 — Application Shell and Validation Error UX Refinement

**Status:** Complete on feature branch (unmerged)  
**Branch:** `feature/application-shell-validation-ux`  
**Draft PR:** [#70](https://github.com/acarbonilla/facilityops-platform/pull/70)  
 
**Starting main SHA:** `242432d5ba7d0d69dd5ac9a657e03d84471f413f`  
**Merge task:** FO-116A (not started)  
**FO-102:** Deferred  

---

## 1. Objective

Improve platform-wide UX for:

1. Expected API validation failures escaping into the Next.js Runtime `ApiError` overlay.
2. Permanently expanded desktop sidebar consuming horizontal workspace on dense pages.

---

## 2. Validation root cause

`services/api/client.ts` correctly throws structured `ApiError` for HTTP 400 responses.

Project / Project Task create/edit forms used `await mutation.mutateAsync(...)` without catching expected failures. Unhandled promise rejections from expected validation reached the Next.js development Runtime Error overlay, even when a form-level error banner could have rendered.

Backend validation was and remains authoritative. FO-116 changes presentation and catch boundaries only.

---

## 3. Error architecture

Preferred path:

API client → structured `ApiError` → form submit catch → `normalizeFormValidationError` → form summary + field errors.

Expected (`isExpected: true`): 400 validation, 401/403/404, 409, network (status 0), 5xx safe fallback — swallowed after UI mapping.

Unexpected: programming/`Error` not marked expected; may still propagate.

Authoritative helper: `frontend/lib/api/form-validation.ts`.

---

## 4. Project Task schedule UX

When Project schedule is loaded, Planned Start/End violations include Project schedule context and actionable date guidance. FO-114 both-or-neither, dependency conflicts, and FO-115C `invalid_project_manager` / `invalid_task_pic` map to user-facing copy without raw codes as primary text.

Form values are preserved; submit remains pending-guarded via existing `isSubmitting`.

---

## 5. Application shell

| State | Behavior |
|-------|----------|
| Desktop expanded | `w-60` rail with labels |
| Desktop collapsed | `w-[4.5rem]` icon rail + tooltips/sr-only labels |
| Preference | `localStorage` key `facilityops.sidebar.collapsed` |
| Hydration | Default expanded until client preference ready |
| Mobile (`< md`) | Header **Open navigation** → modal drawer |
| Tablet | Same as mobile drawer below `md`; desktop rail from `md` up |
| RBAC | Single source: `useFilteredNavigation` (same filter as before) |

Main content reclaims width: dense routes and collapsed desktop use `max-w-none` instead of `max-w-5xl`.

No new runtime dependencies. Icons reuse `lucide-react`.

---

## 6. Migration / dependency

- **Migration:** None  
- **Dependencies:** No new packages  

---

## 7. Next

**FO-116A** — Finalize, Ready for Review, merge, post-merge verification.  
**FO-102** remains deferred.
