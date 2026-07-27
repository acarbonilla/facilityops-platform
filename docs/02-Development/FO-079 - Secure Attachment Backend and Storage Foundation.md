# FO-079 - Secure Attachment Backend and Storage Foundation

## Status

Manual acceptance **passed** on **2026-07-27**. Branch reconciled with merged
FO-078D (`main` at `87c842381eb1a1f4c24173361adab12d180fcb26`). Final automated
validation recorded below. PR #45 Ready for Review; **not yet merged**.

FO-080 through FO-088 (frontend upload UI, module integrations, AI) have **not**
started.

## Business objective

Establish the secure, reusable backend and storage foundation for attachments and
operational evidence across FacilityOps (FM Tickets, Maintenance, 5S, future AI),
without implementing frontend upload UI or AI processing.

## Discovery findings

- No shared attachment app previously existed.
- `MaintenanceAttachment` and `InspectionAttachment` are metadata-only CharField
  path tables with no binary storage.
- `MEDIA_ROOT` / `MEDIA_URL` existed but no `STORAGES`, FileField, or upload parsers.
- Conventions: `BaseModel` (UUID, timestamps, soft-delete, audit UUID fields),
  tenant FK scoping, RBAC via `seed_rbac`, service-layer writes, DRF ViewSets.

## Confirmed scope

- Shared `Attachment` model and `AttachmentHistory` audit model
- Local private storage abstraction with future S3 backend selector
- Upload validation (extension, MIME, signatures, size, empty, dangerous names)
- SHA-256 checksum storage
- No-op virus-scan interface
- Service layer: create / get / list / download / delete
- Secure download headers (`Content-Disposition: attachment`, `nosniff`)
- Soft-delete lifecycle with deferred physical cleanup
- RBAC permissions and tenant/ownership isolation
- Foundation APIs under `/api/attachments/`
- Focused automated tests and documentation

## Excluded scope

- Frontend upload/preview UI
- Module-specific FM Ticket / Maintenance / 5S linkage (later FO-081/FO-082)
- AI analysis, OCR, thumbnails, EXIF
- Real S3 implementation, ZIP export, versioning, email attachments

## Architecture

```text
API ViewSet  →  services.py  →  validation / scanning / storage / audit
                     ↓
              Attachment model (metadata)
                     ↓
         LocalAttachmentStorage (private_media)
```

Business modules must call the service layer; they must not touch the filesystem.

## Data model

`Attachment` (`BaseModel`):

| Field | Notes |
| --- | --- |
| `id` | UUID PK |
| `tenant` | Server-derived; never client-trusted |
| `uploaded_by` | Server-derived actor |
| `original_filename` / `display_filename` | Normalized client name for display |
| `storage_key` | Opaque server-generated object key (unique) |
| `declared_content_type` | Browser-supplied (untrusted alone) |
| `validated_content_type` | Signature-validated type |
| `extension` | Normalized extension |
| `size_bytes` | Bytes |
| `checksum_sha256` | Hex digest; duplicates not blocked in FO-079 |
| `category` | `image_evidence` / `document` / `other` |
| `status` | `active` / `retired` |
| Soft-delete + audit UUID fields | From `BaseModel` |

`AttachmentHistory`: upload / download / delete events with actor, tenant, metadata.

## Storage abstraction

- Interface: `AttachmentStorageBackend` (`save` / `open` / `exists` / `delete`)
- Default: `LocalAttachmentStorage` under `ATTACHMENT_STORAGE_ROOT`
- Future: `ATTACHMENT_STORAGE_BACKEND=s3` selects placeholder that fails closed
  until implemented
- Keys: `attachments/YYYY/MM/{uuid}.{ext}` — no tenant names, emails, or original
  filenames
- Internal keys never returned in API responses

## Local-development storage

- Secure default works without cloud credentials
- Files stored under `backend/private_media/attachments` by default
- Not publicly URL-served; downloads are API-mediated only

## Production-storage compatibility

- Env-driven backend selection and reserved S3 settings
- No public bucket requirement
- No permanent public object URLs
- Short-lived signed URL TTL setting reserved for later

## Tenant-isolation model

- Upload always uses `actor.tenant`
- List/get/download scoped by tenant
- Cross-tenant UUID access returns generic **404**
- Employee-only users (`uses_employee_requester_scope`) see only their uploads
- Operational users with permissions see tenant-wide attachments

## Permission model

| Code | Purpose |
| --- | --- |
| `attachments.upload` | Upload |
| `attachments.view` | Metadata list/retrieve |
| `attachments.download` | Download |
| `attachments.delete` | Soft delete |

Seeded for system_admin, facility_manager, technician (subset), employee, viewer
(read/download).

## Upload / download / validation / lifecycle

1. Authorize upload → validate file → virus-scan hook → generate key/checksum →
   store bytes → create DB row transactionally → orphan cleanup on DB failure
2. Download: resolve in scope → authorize → stream bytes with safe headers →
   audit download
3. Soft delete sets `is_deleted`, `status=retired`; repeated delete is idempotent;
   physical delete deferred for evidence retention

### Validation allowlist

- `image/jpeg` (`.jpg`/`.jpeg`), `image/png`, `image/webp`, `application/pdf`
- Rejects executables, scripts, HTML/SVG, archives, macro-enabled docs
- Max size: `ATTACHMENT_MAX_UPLOAD_BYTES` (default 10 MiB)

## Malware-scanning boundary

**Current controls:** allowlist, signature checks, filename sanitization,
attachment disposition, nosniff, private storage, fail-closed validation.

**Residual risk:** MIME/extension/signature checks are not full malware scanning.

**Future hook:** `apps.attachments.scanning.AttachmentVirusScanner` /
`NoOpAttachmentVirusScanner`.

## API contracts

| Method | Path | Permission |
| --- | --- | --- |
| POST | `/api/attachments/` | `attachments.upload` |
| GET | `/api/attachments/` | `attachments.view` |
| GET | `/api/attachments/{id}/` | `attachments.view` |
| GET | `/api/attachments/{id}/download/` | `attachments.download` |
| DELETE | `/api/attachments/{id}/` | `attachments.delete` |

Safe response fields only (no `storage_key`, no checksum exposure).

## Migration details

- `apps/attachments/migrations/0001_attachment_foundation.py`
- Creates `Attachment` and `AttachmentHistory` with intended indexes/constraints
- No migration conflict with FO-078D (FO-078D introduced no migrations)
- `makemigrations --check --dry-run`: no additional changes

## Dependency details

No new third-party dependencies. Validation uses the Python standard library.

## Reconciliation with FO-078D

| Field | Value |
| --- | --- |
| Method | Normal merge of `origin/main` into `feature/attachment-foundation` |
| Main at reconcile | `87c842381eb1a1f4c24173361adab12d180fcb26` (PR #44 merged) |
| Conflicts | `docs/development/project-status.md`, `docs/development/work-tree.md` |
| Resolution | Preserved FO-079 attachment trackers and FO-078D merged status |
| Production code conflicts | None |
| FO-078D routing preserved | Yes (`notification_service` + focused tests present) |
| Force-push | Not used |

## Manual acceptance evidence

| Field | Value |
| --- | --- |
| Result | **Passed** (26/26) |
| Acceptance date | **2026-07-27** |
| Environment | Local development (`config.settings.development`, PostgreSQL with applied `attachments.0001_attachment_foundation`, isolated temp `ATTACHMENT_STORAGE_ROOT`) |
| Executor | Codex/Cursor implementation engineer under Product Owner merge-lifecycle authorization |
| Test data | Isolated tenants `fo079-a-*` / `fo079-b-*` and `fo079-*@example.com` users only; cleaned after acceptance |
| Defects found | None |
| Defects corrected | None |
| FO-080 included | No |

### Acceptance scenarios and results

1. Authorized JPEG upload — **PASS**
2. Authorized PNG / WEBP / PDF upload — **PASS**
3. Original filename preserved for display — **PASS** (`evidence.jpg`)
4. Stored filename UUID-based (no original filename) — **PASS**
5. SHA-256 checksum generated — **PASS**
6. File size and MIME metadata stored — **PASS**
7. Empty files rejected — **PASS**
8. Oversized files rejected — **PASS**
9. Unsupported MIME types rejected — **PASS**
10. Invalid extension/signature combinations rejected — **PASS**
11. Executable, script, archive, and dangerous filename attempts rejected/normalized — **PASS**
12. Authorized attachment listing — **PASS**
13. Authorized attachment retrieval — **PASS**
14. Authorized download — **PASS**
15. Download response uses safe headers — **PASS** (`Content-Disposition: attachment`, `nosniff`)
16. Unauthorized access returns generic 404 — **PASS**
17. Employee cannot access another Employee’s attachment — **PASS**
18. Cross-tenant access denied — **PASS**
19. Soft-deleted attachment cannot be retrieved or downloaded — **PASS**
20. Authorized deletion succeeds — **PASS**
21. Upload history created — **PASS**
22. Download history created — **PASS**
23. Delete history created — **PASS**
24. Storage remains private with no public URL/path exposure — **PASS**
25. S3 selection fails closed (not implemented) — **PASS** (`AttachmentStorageError`)
26. Existing FM Ticket / Maintenance / 5S / notification / requester workflows remain functional; FO-078D routing intact — **PASS**

## Test coverage

Focused `apps.attachments.tests.test_attachments` covers upload success/failure
modes, download headers, unauthorized/cross-tenant 404s, soft-delete,
idempotent delete, SHA-256, storage abstraction, orphan cleanup, and API safety.

## Final validation results

| Gate | Result |
| --- | --- |
| Focused attachment tests | **19 passed** |
| Related FO-078D / Employee / tenant isolation | Passed (combined focused related suite **71 passed**) |
| Full backend `--parallel 4 --noinput` | **710 passed** |
| Full frontend (`npm test -- --run`) | **268 passed** |
| ESLint | Passed |
| TypeScript (`tsc --noEmit`) | Passed |
| Production build | Passed |
| Django check | **Passed** (0 issues) |
| Migration drift | Attachment `0001` only; `--check` clean |
| Migration plan | No unexpected pending operations beyond FO-079 migration |
| Dependencies | **None added** |
| Private media / secrets committed | **No** |
| `git diff --check` | Clean |

## Known limitations

- Module association (ticket/WO/inspection) deferred
- Physical storage cleanup deferred after soft delete
- S3 backend not implemented
- No malware vendor integration

## Deferred FO-080 through FO-088

Frontend upload components, module evidence integrations, AI provider foundation,
and related polish remain out of scope.

## PR / merge status

- Branch: `feature/attachment-foundation`
- PR: [#45](https://github.com/acarbonilla/facilityops-platform/pull/45)
- Status: Ready for Review; **unmerged** until merge step completes
- FO-080: **not included**
