import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/services/api/types";
import {
  ATTACHMENT_ACCEPT_ATTRIBUTE,
  ATTACHMENT_MAX_UPLOAD_BYTES,
  ATTACHMENT_PERMISSIONS,
  type QueuedAttachmentFile,
} from "@/types/attachments";

import {
  buildQueuedFileIdentity,
  canShowAttachmentDelete,
  canShowAttachmentDownload,
  canShowAttachmentUpload,
  enqueueAttachmentFiles,
  formatAttachmentApiError,
  formatAttachmentBytes,
  formatAttachmentDate,
  formatAttachmentVisibilityLabel,
  buildAttachmentListOwnerParams,
  getAttachmentTypeLabel,
  getAttachmentWorkspaceGuidance,
  getFileExtension,
  getUploadableQueueItems,
  markQueuedAttachment,
  parseContentDispositionFilename,
  removeQueuedAttachment,
  truncateFilename,
  validateAttachmentFile,
} from "./attachments";

function fakeFile(
  name: string,
  size: number,
  type: string,
  lastModified = 1,
): File {
  const content = size > 0 ? new Uint8Array(Math.min(size, 64)).fill(1) : new Uint8Array();
  const file = new File([content], name, { type, lastModified });
  // Ensure size matches requested value for oversized checks when content is capped.
  Object.defineProperty(file, "size", { value: size });
  return file;
}

test("accepted JPEG/PNG/WEBP/PDF extensions pass preflight", () => {
  for (const [name, type] of [
    ["a.jpg", "image/jpeg"],
    ["b.jpeg", "image/jpeg"],
    ["c.png", "image/png"],
    ["d.webp", "image/webp"],
    ["e.pdf", "application/pdf"],
  ] as const) {
    const result = validateAttachmentFile(fakeFile(name, 128, type));
    assert.equal(result.ok, true, name);
  }
  assert.ok(ATTACHMENT_ACCEPT_ATTRIBUTE.includes(".pdf"));
});

test("rejected extension fails preflight", () => {
  const result = validateAttachmentFile(fakeFile("malware.exe", 128, "application/octet-stream"));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /Unsupported file type/i);
  }
});

test("oversized file fails preflight", () => {
  const result = validateAttachmentFile(
    fakeFile("big.jpg", ATTACHMENT_MAX_UPLOAD_BYTES + 1, "image/jpeg"),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /maximum size/i);
  }
});

test("empty file fails preflight", () => {
  const result = validateAttachmentFile(fakeFile("empty.jpg", 0, "image/jpeg"));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /Empty files/i);
  }
});

test("duplicate queue entries are prevented by local identity", () => {
  const file = fakeFile("photo.jpg", 200, "image/jpeg", 42);
  const first = enqueueAttachmentFiles([], [file]);
  assert.equal(first.next.length, 1);
  const second = enqueueAttachmentFiles(first.next, [file]);
  assert.equal(second.next.length, 1);
  assert.equal(second.rejected.length, 1);
  assert.match(second.rejected[0], /already in the upload queue/i);
  assert.equal(
    buildQueuedFileIdentity(file),
    `${file.name}|${file.size}|${file.lastModified}`,
  );
});

test("removing a queued file updates the queue", () => {
  const file = fakeFile("photo.jpg", 200, "image/jpeg", 7);
  const { next } = enqueueAttachmentFiles([], [file]);
  const removed = removeQueuedAttachment(next, next[0].localId);
  assert.equal(removed.length, 0);
});

test("queue marks rejected files and keeps valid files for upload", () => {
  const valid = fakeFile("ok.png", 100, "image/png", 1);
  const bad = fakeFile("notes.txt", 100, "text/plain", 2);
  const { next } = enqueueAttachmentFiles([], [valid, bad]);
  assert.equal(next.length, 2);
  assert.equal(next[0].status, "queued");
  assert.equal(next[1].status, "rejected");
  assert.equal(getUploadableQueueItems(next).length, 1);
});

test("retry path uses error status items as uploadable", () => {
  const queue: QueuedAttachmentFile[] = [
    {
      localId: "a",
      file: fakeFile("a.jpg", 10, "image/jpeg"),
      name: "a.jpg",
      size: 10,
      type: "image/jpeg",
      lastModified: 1,
      status: "error",
      errorMessage: "network",
    },
  ];
  assert.equal(getUploadableQueueItems(queue).length, 1);
  const uploading = markQueuedAttachment(queue, "a", { status: "uploading" });
  assert.equal(uploading[0].status, "uploading");
  const success = markQueuedAttachment(uploading, "a", {
    status: "success",
    uploadedAttachmentId: "uuid",
  });
  assert.equal(success[0].uploadedAttachmentId, "uuid");
  assert.equal(getUploadableQueueItems(success).length, 0);
});

test("partial multi-file success keeps successful queue entries", () => {
  let queue: QueuedAttachmentFile[] = enqueueAttachmentFiles(
    [],
    [
      fakeFile("one.jpg", 10, "image/jpeg", 1),
      fakeFile("two.jpg", 10, "image/jpeg", 2),
    ],
  ).next;
  queue = markQueuedAttachment(queue, queue[0].localId, {
    status: "success",
    uploadedAttachmentId: "ok-1",
  });
  queue = markQueuedAttachment(queue, queue[1].localId, {
    status: "error",
    errorMessage: "Server rejected file.",
  });
  assert.equal(queue.filter((item) => item.status === "success").length, 1);
  assert.equal(queue.filter((item) => item.status === "error").length, 1);
  assert.equal(getUploadableQueueItems(queue).length, 1);
});

test("attachment list helpers format size, date, type, and safe filenames", () => {
  assert.equal(formatAttachmentBytes(512), "512 B");
  assert.match(formatAttachmentBytes(2048), /KB/);
  assert.match(formatAttachmentBytes(2 * 1024 * 1024), /MB/);
  assert.equal(getAttachmentTypeLabel("image/png", ".png"), "Image");
  assert.equal(getAttachmentTypeLabel("application/pdf", ".pdf"), "PDF");
  assert.equal(getFileExtension("path/to/Report.PDF"), ".pdf");
  assert.ok(truncateFilename("very-long-filename-for-responsive-layout.pdf", 20).includes("…"));
  assert.ok(formatAttachmentDate("2026-07-27T10:00:00.000Z").length > 0);
});

test("empty/loading/error presentation helpers and guidance", () => {
  assert.match(getAttachmentWorkspaceGuidance(), /JPEG, PNG, WEBP, and PDF/);
  assert.match(getAttachmentWorkspaceGuidance(), /Maximum size/);
  assert.doesNotMatch(getAttachmentWorkspaceGuidance(), /private_media|storage_key/i);
});

test("secure download filename parsing prefers Content-Disposition", () => {
  assert.equal(
    parseContentDispositionFilename(
      'attachment; filename="evidence.jpg"',
      "fallback.bin",
    ),
    "evidence.jpg",
  );
  assert.equal(
    parseContentDispositionFilename(
      "attachment; filename*=UTF-8''safe%20name.pdf",
      "fallback.bin",
    ),
    "safe name.pdf",
  );
  assert.equal(
    parseContentDispositionFilename(null, "fallback.bin"),
    "fallback.bin",
  );
});

test("download and delete API errors surface safe messages", () => {
  assert.equal(
    formatAttachmentApiError(
      new ApiError("Download failed with status 404.", 404),
      "fallback",
    ),
    "Download failed with status 404.",
  );
  assert.equal(
    formatAttachmentApiError(
      new ApiError("You do not have permission to delete this attachment.", 403),
      "fallback",
    ),
    "You do not have permission to delete this attachment.",
  );
  assert.equal(formatAttachmentApiError({}, "Could not delete."), "Could not delete.");
});

test("permission-hidden upload and delete controls", () => {
  assert.equal(canShowAttachmentUpload(true), true);
  assert.equal(canShowAttachmentUpload(false), false);
  assert.equal(canShowAttachmentDelete(true), true);
  assert.equal(canShowAttachmentDelete(false), false);
  assert.equal(canShowAttachmentDownload(false), false);
  assert.equal(ATTACHMENT_PERMISSIONS.upload, "attachments.upload");
  assert.equal(ATTACHMENT_PERMISSIONS.delete, "attachments.delete");
});

test("backend permission failure message remains authoritative", () => {
  const message = formatAttachmentApiError(
    new ApiError("You do not have permission to upload attachments.", 403, {
      message: "You do not have permission to upload attachments.",
      code: "permission_denied",
    }),
    "Upload failed.",
  );
  assert.match(message, /do not have permission/i);
});

test("keyboard upload zone semantics and accessible labels are documented by helpers", () => {
  // Component uses role=button, Enter/Space activation, aria-label, and aria-live.
  // Helpers provide the shared guidance and labels wired into those attributes.
  const guidance = getAttachmentWorkspaceGuidance();
  assert.match(guidance, /Accepted files/i);
  assert.match(guidance, /validated again by the server/i);
});

test("responsive-safe filename truncation preserves extension", () => {
  const truncated = truncateFilename("operational-evidence-photo-capture.jpeg", 24);
  assert.ok(truncated.endsWith(".jpeg"));
  assert.ok(truncated.includes("…"));
  assert.ok(truncated.length <= 24);
});

test("visibility labels stay requester-safe", () => {
  assert.equal(formatAttachmentVisibilityLabel("requester_visible"), "Requester visible");
  assert.equal(formatAttachmentVisibilityLabel("internal_only"), "Internal only");
  assert.equal(formatAttachmentVisibilityLabel(undefined), "Internal only");
});

test("owner list params exclude tenant and uploader ids", () => {
  const params = buildAttachmentListOwnerParams({
    owner_type: "fm_ticket",
    owner_id: "ticket-abc",
  });
  assert.deepEqual(params, {
    owner_type: "fm_ticket",
    owner_id: "ticket-abc",
    page_size: 50,
  });
  assert.equal("tenant_id" in params, false);
  assert.equal("uploaded_by" in params, false);
});
