import {
  ATTACHMENT_ACCEPTED_EXTENSIONS,
  ATTACHMENT_ACCEPTED_MIME_TYPES,
  ATTACHMENT_MAX_UPLOAD_BYTES,
  type QueuedAttachmentFile,
} from "@/types/attachments";

export function getFileExtension(filename: string): string {
  const basename = filename.replace(/\\/g, "/").split("/").pop() ?? filename;
  const index = basename.lastIndexOf(".");
  if (index <= 0) {
    return "";
  }
  return basename.slice(index).toLowerCase();
}

export function buildQueuedFileIdentity(file: {
  name: string;
  size: number;
  lastModified: number;
}): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export type AttachmentPreflightResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateAttachmentFile(
  file: { name: string; size: number; type?: string },
  maxBytes: number = ATTACHMENT_MAX_UPLOAD_BYTES,
): AttachmentPreflightResult {
  if (!file.name || !file.name.trim()) {
    return { ok: false, message: "A filename is required." };
  }
  if (file.size <= 0) {
    return { ok: false, message: "Empty files cannot be uploaded." };
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      message: `File exceeds the maximum size of ${formatAttachmentBytes(maxBytes)}.`,
    };
  }

  const extension = getFileExtension(file.name);
  if (
    !(ATTACHMENT_ACCEPTED_EXTENSIONS as readonly string[]).includes(extension)
  ) {
    return {
      ok: false,
      message:
        "Unsupported file type. Accepted types: JPEG, PNG, WEBP, and PDF.",
    };
  }

  const mime = (file.type ?? "").toLowerCase();
  if (
    mime &&
    !(ATTACHMENT_ACCEPTED_MIME_TYPES as readonly string[]).includes(mime)
  ) {
    return {
      ok: false,
      message:
        "Unsupported file type. Accepted types: JPEG, PNG, WEBP, and PDF.",
    };
  }

  return { ok: true };
}

export function formatAttachmentBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function formatAttachmentDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function getAttachmentTypeLabel(contentType: string, extension: string): string {
  const mime = contentType.toLowerCase();
  if (mime.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp"].includes(extension)) {
    return "Image";
  }
  if (mime === "application/pdf" || extension === ".pdf") {
    return "PDF";
  }
  return "File";
}

export function isImageAttachment(contentType: string, extension: string): boolean {
  return getAttachmentTypeLabel(contentType, extension) === "Image";
}

export function truncateFilename(filename: string, maxLength = 48): string {
  if (filename.length <= maxLength) {
    return filename;
  }
  const extension = getFileExtension(filename);
  const keep = Math.max(8, maxLength - extension.length - 3);
  const base = filename.slice(0, filename.length - extension.length);
  return `${base.slice(0, keep)}…${extension}`;
}

export function enqueueAttachmentFiles(
  existing: QueuedAttachmentFile[],
  incoming: File[],
  maxBytes: number = ATTACHMENT_MAX_UPLOAD_BYTES,
): { next: QueuedAttachmentFile[]; rejected: string[] } {
  const known = new Set(
    existing.map((item) =>
      buildQueuedFileIdentity({
        name: item.name,
        size: item.size,
        lastModified: item.lastModified,
      }),
    ),
  );
  const next = [...existing];
  const rejected: string[] = [];

  for (const file of incoming) {
    const identity = buildQueuedFileIdentity(file);
    if (known.has(identity)) {
      rejected.push(`${file.name}: already in the upload queue.`);
      continue;
    }

    const preflight = validateAttachmentFile(file, maxBytes);
    const localId = identity;
    known.add(identity);

    if (!preflight.ok) {
      next.push({
        localId,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        status: "rejected",
        errorMessage: preflight.message,
      });
      rejected.push(`${file.name}: ${preflight.message}`);
      continue;
    }

    next.push({
      localId,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      status: "queued",
    });
  }

  return { next, rejected };
}

export function removeQueuedAttachment(
  queue: QueuedAttachmentFile[],
  localId: string,
): QueuedAttachmentFile[] {
  return queue.filter((item) => item.localId !== localId);
}

export function markQueuedAttachment(
  queue: QueuedAttachmentFile[],
  localId: string,
  patch: Partial<QueuedAttachmentFile>,
): QueuedAttachmentFile[] {
  return queue.map((item) =>
    item.localId === localId ? { ...item, ...patch } : item,
  );
}

export function getUploadableQueueItems(
  queue: QueuedAttachmentFile[],
): QueuedAttachmentFile[] {
  return queue.filter(
    (item) => item.status === "queued" || item.status === "error",
  );
}

export function parseContentDispositionFilename(
  header: string | null,
  fallback: string,
): string {
  if (!header) {
    return fallback;
  }
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim().replace(/"/g, ""));
    } catch {
      return utfMatch[1].trim().replace(/"/g, "") || fallback;
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(header);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim() || fallback;
  }
  return fallback;
}

export function formatAttachmentApiError(
  error: unknown,
  fallback: string,
): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
}

export function canShowAttachmentUpload(hasUploadPermission: boolean): boolean {
  return hasUploadPermission;
}

export function canShowAttachmentDelete(hasDeletePermission: boolean): boolean {
  return hasDeletePermission;
}

export function canShowAttachmentDownload(
  hasDownloadPermission: boolean,
): boolean {
  return hasDownloadPermission;
}

export function getAttachmentWorkspaceGuidance(): string {
  return [
    `Accepted files: JPEG, PNG, WEBP, and PDF.`,
    `Maximum size: ${formatAttachmentBytes(ATTACHMENT_MAX_UPLOAD_BYTES)}.`,
    "Files are validated again by the server. Private storage paths are never shown.",
  ].join(" ");
}

export function formatAttachmentVisibilityLabel(
  visibility: string | null | undefined,
): string {
  if (visibility === "requester_visible") {
    return "Requester visible";
  }
  return "Internal only";
}

export function buildAttachmentListOwnerParams(owner: {
  owner_type: string;
  owner_id: string;
  page_size?: number;
}) {
  return {
    owner_type: owner.owner_type,
    owner_id: owner.owner_id,
    page_size: owner.page_size ?? 50,
  };
}
