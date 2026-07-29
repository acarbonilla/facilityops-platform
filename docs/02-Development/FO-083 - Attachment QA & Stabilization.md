# FO-083 — Attachment QA & Stabilization

**Status:** Complete on `feature/business-module-attachments`  
**Date:** 2026-07-29  
**Starting SHA:** `d67f036ddc66a65f471b75e0505308a8012dc7b5`  
**Draft PR:** [#47](https://github.com/acarbonilla/facilityops-platform/pull/47)  
**Finalizes:** FO-079, FO-080, FO-081, FO-082

## Summary

FO-083 performed comprehensive quality assurance and stabilization for the
attachment platform. No architectural redesign was introduced. Verified defects
were corrected with minimal, safe patches.

## Review summary

| Area | Result |
| --- | --- |
| Architecture | Shared FO-079 services + FO-080 UI + FO-081/082 owner adapters remain sound |
| Security | Tenant isolation, owner validation, visibility, private download, soft-delete, generic 404s confirmed |
| Permissions | Backend remains authoritative for FM Ticket / Maintenance / Inspection / requester |
| Workflow immutability | Closed/cancelled tickets; completed/cancelled/closed WOs; completed/verified/cancelled inspections |
| UX consistency | Module wrappers share uploader/list; stale deferred copy removed |
| Accessibility | Delete dialog focus trap + restore; unique heading IDs; non-interactive file input |
| Responsive | Truncation, stacked mobile queue, no horizontal overflow in attachment UI |
| Performance | Batch upload list refresh once per queue (not per file); remove redundant post-delete refetch |
| Audit | Upload/download/delete history with owner metadata confirmed |
| Documentation | Trackers and FO-083 doc aligned; stale FO-080/081 “not started” notes superseded |

## Defects identified

1. Owned soft-delete was not idempotent after the owner became immutable.
2. Unfiltered `/attachments` library list returned module-owned evidence.
3. `authorize_owned_attachment_access` could return `False` without denying access.
4. Multi-file upload triggered one list refetch per successful file.
5. Delete handlers double-refetched after mutation invalidation.
6. Stale “deferred” copy on `/attachments` workspace and Maintenance create/edit form.
7. Empty state always instructed users to upload, including view-only users.
8. Delete dialog lacked focus trap / restore and used hardcoded element IDs.
9. Nested interactive file input inside dropzone role=button.
10. Silent omission of attachments beyond `page_size: 50` (no count hint).

## Defects corrected

1. Idempotent owned delete authorizes via `view` after soft-delete (survives terminal owner states).
2. Unlinked library list filters `owner_type=""`, `owner_id__isnull=True`.
3. Unsupported owned context raises `Http404`; callers use `_authorize_owned_or_404`.
4. `AttachmentUploader` calls `onUploaded` once after the batch (and once after retry).
5. Module wrappers rely on mutation cache invalidation only.
6. Workspace and Maintenance form guidance updated to reflect FO-081/082.
7. Empty state respects `canUpload`.
8. Focus trap + restore; `useId` for dialog/list headings; backdrop dismiss.
9. File input `tabIndex={-1}` + `aria-hidden`.
10. List shows “Showing N of M” when `totalCount` exceeds loaded rows.

## Remaining deferred work

- Physical storage purge after soft-delete
- Virus scanner beyond no-op extension point
- S3 storage backend implementation
- Attachment history UI surface
- Full pagination controls beyond count hint
- Shared `OwnerAttachmentSection` wrapper deduplication (optional maintainability)
- Component-level React tests (repo uses helper `node:test` only)
- `ACCESS_DENIED` audit action (enum exists; not written)

## Production-readiness checklist

- [x] Tenant isolation and generic 404s
- [x] Owner + visibility enforcement
- [x] Workflow immutability for mutation
- [x] Secure authenticated download (no public URLs / storage paths)
- [x] Soft-delete + audit integrity
- [x] Requester isolation from Maintenance / 5S evidence
- [x] Shared UI reused across modules
- [x] Accessibility baseline for upload/list/delete
- [x] Focused + full automated suites green
- [x] ESLint / TypeScript / production build
- [x] Django check + no migration drift
- [x] Documentation finalized
- [x] PR #47 Ready for Review (not auto-merged)

## Validation totals

| Check | Result |
| --- | --- |
| Focused attachment backend | 54 passed |
| Full backend suite | 745 passed |
| Django check | no issues |
| Migration drift | No changes detected |
| Frontend suite | 303 passed |
| ESLint | passed |
| TypeScript (`tsc --noEmit`) | passed |
| Production build | passed |
| Dependencies | No unexpected attachment deps (Django 5.2.8, DRF 3.15.2, Pillow 11.0.0) |

## Manual acceptance

Static and automated acceptance completed for security, permissions, workflow,
UX copy, accessibility code paths, and regression suites. Interactive browser
walkthrough remains available to the reviewer on Draft/Ready PR #47.
