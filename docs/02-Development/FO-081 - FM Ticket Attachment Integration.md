# FO-081 — FM Ticket Attachment Integration

**Status:** Implemented and validated on `feature/business-module-attachments`  
**Date:** 2026-07-28  
**Baseline main SHA:** `e60b79b247be0c9fd615e19e6fbdf3a45edf6096`  
**Grouped branch:** `feature/business-module-attachments` (shared with FO-082 / FO-083; not merged independently)

## Summary

FO-081 connects the merged FO-079 attachment foundation and FO-080 shared upload UI to FM Ticket workflows for both internal operational users and Employee Requesters. Attachments use a server-validated owner context (`owner_type=fm_ticket`, `owner_id=<ticket UUID>`) and a conservative visibility classification (`internal_only` default / `requester_visible`).

FO-082 and FO-083 have since been completed on the same shared branch (see
FO-082 / FO-083). This unit remains part of the grouped PR #47 and must not be
merged alone.

## Architecture

```text
Internal /fm-tickets/[id]  ──┐
                             ├── FmTicketAttachments (thin integration)
Employee /my-requests/[id] ──┘
         │
         ├── AttachmentUploader / AttachmentList (FO-080)
         │
         ▼
POST/GET/DELETE /api/attachments/?owner_type=fm_ticket&owner_id=…
         │
         ▼
AttachmentService + owner_access (FM Ticket scope + visibility)
         │
         ▼
Attachment row (tenant, uploaded_by, owner_*, visibility) + private storage
```

## Backend integration

### Schema (migration `0002_fm_ticket_owner_visibility`)

Security reason for the schema change: FO-079 stored tenant-scoped blobs without module ownership or audience classification. Requester-safe FM Ticket embedding requires both:

| Field | Purpose |
| --- | --- |
| `owner_type` | Stable owning object type (`fm_ticket`, or blank for unlinked library) |
| `owner_id` | Owning object UUID |
| `visibility` | `internal_only` (default) or `requester_visible` |

Defaults are conservative: existing and internal uploads remain `internal_only` unless an authorized internal actor explicitly selects requester visibility. Requester uploads are forced to `requester_visible` server-side.

### Ownership context

Server-derived only:

- owning object type / id validated against authenticated ticket scope
- tenant from authenticated actor / ticket
- uploader from authenticated actor

Clients never supply tenant or uploader IDs.

### Permission rules

| Audience | List / view / download | Upload | Delete |
| --- | --- | --- | --- |
| Internal | Ticket in tenant scope + attachment RBAC | `attachments.upload` + `fm_tickets.update`/`manage` + mutable ticket | `attachments.delete` + contribute + mutable ticket |
| Employee requester | Own ticket only + `requester_visible` | Own mutable ticket + `attachments.upload` (forced requester-visible) | Own upload + requester-visible + mutable ticket |

Mutable excludes `closed` and `cancelled`. Soft-deleted tickets → generic 404.

Unauthorized or cross-tenant access → generic 404 where FO-079 already used that pattern. Immutable upload attempts → 403 with a safe message.

### API contract

Extends `/api/attachments/`:

- **List:** `?owner_type=fm_ticket&owner_id=<uuid>`
- **Upload:** multipart fields `owner_type`, `owner_id`, optional `visibility`
- **Download / delete:** existing detail routes; owner-linked rows authorize via ticket + visibility

Response adds `visibility`, `owner_type`, `owner_id`, and advisory `can_delete`. Requester payloads omit `uploader_email`, `owner_type`, and `owner_id`.

Unlinked library behavior (FO-079/FO-080 `/attachments` workspace) remains unchanged when owner filters are omitted.

### Audit

Upload / download / delete history metadata includes `owner_type`, `owner_id`, and `visibility`. Attachment audit history is not exposed to Employee Requesters.

### Notifications

No attachment upload/delete notification events. Deferred.

## UI integration

| Surface | Component | Audience |
| --- | --- | --- |
| `/fm-tickets/[id]` | `FmTicketAttachments` in ticket detail | `internal` |
| `/my-requests/[id]` | same component | `requester` |

Create flow: attachments only after a stable ticket ID exists (detail / My Request detail). No orphan or temporary ownership.

Shared FO-080 components are reused; `FmTicketAttachments` only supplies owner context, audience mode, capabilities, and query invalidation.

## Security verification

- Tenant isolation via ticket scope
- Requester ownership and visibility separation
- No direct storage URLs / public media
- No client-supplied tenant or uploader IDs
- No internal `/fm-tickets` routing for requesters
- Soft-deleted attachments excluded from lists
- Generic 404 for inaccessible objects

## Tests

### Backend (`apps.attachments.tests.test_fm_ticket_attachments`)

Internal list/upload/download/delete; unauthorized viewer; technician upload-without-delete; cross-tenant denials; requester visibility filtering; requester download rules; other-requester denial; requester upload/delete of own files; deleted exclusion; invalid owner context; immutable ticket upload; audit owner metadata.

### Frontend (`lib/fm-tickets/attachments.test.ts` + attachment helper extensions)

Owner context shape (no tenant/uploader IDs); upload/delete capability matrices; visibility defaults; guidance labels; requester-safe copy.

## Validation (FO-081 delivery)

Commands and totals recorded on `feature/business-module-attachments`:

| Check | Result |
| --- | --- |
| Focused FO-081 backend `apps.attachments.tests.test_fm_ticket_attachments` | 15 passed |
| Attachment backend (FO-079 + FO-081) | 34 passed |
| Related regression (attachments + FM employee/tenant/auto-closure/workflow + notification routing) | 119 passed |
| Full backend | **725 passed** (baseline 710) |
| Focused FO-081 frontend helpers | 27 passed (`attachments.test` + `fm-tickets/attachments.test`) |
| Full frontend | **295 passed** (baseline 285) |
| ESLint | passed |
| TypeScript `tsc --noEmit` | passed |
| Production build | passed |
| Django system check | passed |
| Migration drift `--check --dry-run` | none (after `0002_fm_ticket_owner_visibility`) |

## Manual acceptance

Environment: local isolated Django test database fixtures mirroring one tenant, internal FM user, unauthorized viewer/technician, two Employee Requesters, requester-owned tickets, requester-visible and internal-only JPEG/PDF evidence.

Method: FO-081 focused API acceptance suite (`test_fm_ticket_attachments`) exercising upload/list/download/delete, cross-tenant 404, requester visibility isolation, immutable ticket denial, and audit owner metadata, plus UI wiring verification on internal detail and My Requests detail (shared `FmTicketAttachments`), production build confirming routes compile.

Result: **Passed** against the FO-081 security and authorization checklist. Interactive browser polish remains available for FO-083 grouped stabilization.

## Deferred scope

- FO-082 Maintenance / 5S attachment integration
- FO-083 QA and stabilization / final merge
- Thumbnails, galleries, OCR, AI, S3, attachment notifications
- Attachment versioning / ZIP / email

## Shared branch strategy

1. FO-081 committed here  
2. FO-082 next on the same branch  
3. FO-083 stabilization  
4. Single final feature PR and merge after acceptance  

Do **not** merge FO-081 independently.
