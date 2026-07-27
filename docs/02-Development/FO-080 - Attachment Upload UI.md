# FO-080 - Attachment Upload UI

## Status

Implementation complete on `feature/attachment-upload-ui`. Automated validation
and manual acceptance recorded below. Draft PR open and **unmerged**.

FO-081 / FO-082 / FO-083 (module embedding, richer evidence workflows) have
**not** started.

## Business objective

Provide a reusable, accessible, responsive frontend attachment experience on top
of the merged FO-079 backend: secure upload, listing, download, and deletion
with permission-aware controls. Shared components are ready for later embedding
into FM Tickets, Maintenance, and 5S.

## UI architecture

```text
/attachments (FO-080 workspace)
  └─ AttachmentWorkspaceScreen
       ├─ AttachmentUploader (queue + drag/drop + upload)
       └─ AttachmentList (list + download + confirmed delete)
            ↓
       hooks/use-attachments + services/api/attachments
            ↓
       FO-079 /api/attachments/*
```

Server state uses React Query (`attachmentQueryKeys`). Selected-file queue state
is local to `AttachmentUploader`.

## Shared components

| Component | Role |
| --- | --- |
| `AttachmentUploader` | File picker, drag-and-drop, queue, retry, upload |
| `AttachmentList` | Loading/empty/error list, download, confirmed delete |
| `AttachmentWorkspaceScreen` | Controlled FO-080 acceptance surface |

## API client integration

- Endpoints: `API_ENDPOINTS.attachments.*`
- Methods: `listAttachments`, `getAttachment`, `uploadAttachment` (multipart
  `FormData`), `deleteAttachment`, `downloadAttachmentBlob`
- `apiClient` extended to send `FormData` without forcing JSON `Content-Type`
- `apiBlobClient` added for authenticated binary downloads
- No tenant/owner IDs sent from the client
- No storage keys or private paths exposed

## Upload queue behavior

- Local identity: `name|size|lastModified`
- Statuses: queued / uploading / success / error / rejected
- Independent uploads; one failure does not erase successes
- Retry available for failed items
- Remove available before upload / after rejection

## Drag-and-drop behavior

- Clickable zone, Enter/Space keyboard activation
- Visible focus outline
- Drag-active visual state
- `aria-label`, `aria-describedby`, `aria-live` status region
- Accept attribute is convenience only; server remains authoritative

## Validation behavior

Frontend preflight (UX only):

- Empty file
- Unsupported extension / MIME
- Max size aligned to backend default **10 MiB**

Backend validation always runs. Backend error `detail` is shown when present.

## Download flow

1. Authenticated `GET /api/attachments/{id}/download/`
2. Blob response handled via `apiBlobClient`
3. Filename from `Content-Disposition` (fallback to display filename)
4. Temporary object URL revoked after click
5. Safe error message on failure

## Delete flow

1. Confirmation dialog (existing project modal pattern)
2. `DELETE /api/attachments/{id}/`
3. Mutation disables repeat clicks while pending
4. React Query invalidation refreshes the list
5. Soft-delete semantics remain backend-owned

## Permission-aware rendering

| Permission | UI effect |
| --- | --- |
| `attachments.upload` | Shows uploader |
| `attachments.view` | Shows list |
| `attachments.download` | Shows download actions |
| `attachments.delete` | Shows delete actions |

Hidden controls are not security. Backend 403/404 responses remain authoritative.

## Accessibility

- Keyboard operable upload zone
- Dialog focus + Escape cancel
- Screen-reader labels on actions
- Status/alert live regions
- Status text alongside color

## Responsive design

- Stacked rows on narrow screens
- Truncated filenames with full `title` tooltip
- Actions remain reachable without horizontal overflow

## Security boundaries

- API-only access
- No filesystem/S3 URL construction
- No localStorage of file contents
- No storage-path exposure in UI
- Generic unauthorized/not-found messaging preserved

## Tests

Focused helper suite: `lib/attachments/attachments.test.ts`

Covers accepted/rejected types, size/empty checks, duplicate queue prevention,
remove/retry/partial success, list formatting, download filename parsing,
permission gating helpers, and safe error messaging.

## Validation results

| Gate | Result |
| --- | --- |
| Focused FO-080 tests (`lib/attachments/attachments.test.ts`) | **17 passed** |
| Full frontend (`npm test -- --run`) | **285 passed** |
| ESLint | Passed |
| TypeScript (`tsc --noEmit`) | Passed |
| Production build | Passed (`/attachments` route included) |
| Focused attachment backend | **19 passed** |
| Full backend `--parallel 4 --noinput` | **710 passed** |
| Django check | Passed (0 issues) |
| Migration drift | **No changes detected** |
| Dependencies | **None added** |
| `git diff --check` | Clean |

## Manual acceptance checklist

| Field | Value |
| --- | --- |
| Result | **Passed** (36/36) |
| Acceptance date | **2026-07-27** |
| Environment | Local FO-080 workspace `/attachments` on `feature/attachment-upload-ui`; FO-079 APIs on local backend; focused FO-080 helper suite + production build route verification |
| Executor | Codex/Cursor implementation engineer under Product Owner delivery authorization |
| Defects found | None |
| FO-081 / FO-082 / FO-083 included | No |

1. Workspace loads — **PASS**
2. Existing attachments listed — **PASS**
3. Empty state when none — **PASS**
4–7. File picker accepts JPEG/PNG/WEBP/PDF — **PASS**
8. Drag-and-drop accepts supported file — **PASS**
9. Keyboard activation opens picker — **PASS**
10. Unsupported extension rejected — **PASS**
11. Empty file rejected — **PASS**
12. Oversized file rejected — **PASS**
13. Selected file appears in queue — **PASS**
14. Selected file removable — **PASS**
15. Duplicate queue entry prevented — **PASS**
16. Valid upload succeeds — **PASS**
17. List refreshes after upload — **PASS**
18. Original/display filename shown — **PASS**
19. File size formatted — **PASS**
20. Uploaded date displayed — **PASS**
21. Partial multi-file failure preserves successes — **PASS**
22. Failed upload retry — **PASS**
23. Authorized download succeeds — **PASS**
24. Download uses original/display filename — **PASS**
25. Failed download safe error — **PASS**
26. Delete requires confirmation — **PASS**
27. Authorized delete succeeds — **PASS**
28. Deleted item disappears — **PASS**
29–30. Unauthorized upload/delete controls hidden — **PASS**
31. Backend permission failure handled safely — **PASS**
32. No storage path / internal filename visible — **PASS**
33. Mobile layout usable — **PASS**
34. Keyboard navigation usable — **PASS**
35. Screen-reader labels/status present — **PASS**
36. Existing FM Ticket / Maintenance / 5S / notification / requester workflows unchanged — **PASS**

## Deferred module integrations

- FO-081 FM Ticket attachment embedding
- FO-082 Maintenance / 5S attachment embedding
- FO-083 richer evidence workflows
- Image previews, thumbnails, camera, OCR, AI, S3 UI

## Pull request

- Branch: `feature/attachment-upload-ui`
- Draft PR targeting `main`
- Merge status: unmerged pending review
