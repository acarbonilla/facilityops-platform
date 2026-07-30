/** FO-084 create-flow image staging helpers (reuse attachment validation). */

import {
  ATTACHMENT_MAX_UPLOAD_BYTES,
  type QueuedAttachmentFile,
} from "@/types/attachments";
import {
  enqueueAttachmentFiles,
  formatAttachmentBytes,
  getFileExtension,
  getUploadableQueueItems,
  validateAttachmentFile,
  type AttachmentPreflightResult,
} from "@/lib/attachments/attachments";

export const FM_TICKET_IMAGE_ACCEPTED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

export const FM_TICKET_IMAGE_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const FM_TICKET_IMAGE_ACCEPT_ATTRIBUTE =
  FM_TICKET_IMAGE_ACCEPTED_EXTENSIONS.join(",");

export function validateTicketCreateImageFile(
  file: { name: string; size: number; type?: string },
  maxBytes: number = ATTACHMENT_MAX_UPLOAD_BYTES,
): AttachmentPreflightResult {
  const base = validateAttachmentFile(file, maxBytes);
  if (!base.ok) {
    // Soften message for image-only create staging.
    if (base.message.includes("Unsupported file type")) {
      return {
        ok: false,
        message:
          "Unsupported image type. Accepted types: JPEG, PNG, and WEBP.",
      };
    }
    return base;
  }

  const extension = getFileExtension(file.name);
  if (
    !(FM_TICKET_IMAGE_ACCEPTED_EXTENSIONS as readonly string[]).includes(
      extension,
    )
  ) {
    return {
      ok: false,
      message:
        "Unsupported image type. Accepted types: JPEG, PNG, and WEBP.",
    };
  }

  const mime = (file.type ?? "").toLowerCase();
  if (
    mime &&
    !(FM_TICKET_IMAGE_ACCEPTED_MIME_TYPES as readonly string[]).includes(mime)
  ) {
    return {
      ok: false,
      message:
        "Unsupported image type. Accepted types: JPEG, PNG, and WEBP.",
    };
  }

  return { ok: true };
}

export function enqueueTicketCreateImages(
  existing: QueuedAttachmentFile[],
  incoming: File[],
  maxBytes: number = ATTACHMENT_MAX_UPLOAD_BYTES,
): { next: QueuedAttachmentFile[]; rejected: string[] } {
  // Reuse identity/dedupe from attachment helpers, then re-validate images.
  const staged = enqueueAttachmentFiles(existing, incoming, maxBytes);
  const next: QueuedAttachmentFile[] = [];
  const rejected = [...staged.rejected];

  for (const item of staged.next) {
    if (item.status === "rejected") {
      const imageCheck = validateTicketCreateImageFile(item.file, maxBytes);
      if (!imageCheck.ok) {
        next.push({
          ...item,
          status: "rejected",
          errorMessage: imageCheck.message,
        });
        continue;
      }
      next.push(item);
      continue;
    }

    const imageCheck = validateTicketCreateImageFile(item.file, maxBytes);
    if (!imageCheck.ok) {
      next.push({
        ...item,
        status: "rejected",
        errorMessage: imageCheck.message,
      });
      rejected.push(`${item.name}: ${imageCheck.message}`);
      continue;
    }
    next.push(item);
  }

  return { next, rejected };
}

export function getTicketCreateImageGuidance(
  maxBytes: number = ATTACHMENT_MAX_UPLOAD_BYTES,
): string {
  return [
    "Optional images for AI-assisted review.",
    `Accepted: JPEG, PNG, WEBP. Max ${formatAttachmentBytes(maxBytes)} each.`,
    "Images upload when you submit the ticket. AI analysis runs in the background afterward.",
  ].join(" ");
}

export function getQueuedImageCount(queue: QueuedAttachmentFile[]): number {
  return queue.filter((item) => item.status !== "rejected").length;
}

export function hasPendingOrRejectedImages(
  queue: QueuedAttachmentFile[],
): boolean {
  return (
    getUploadableQueueItems(queue).length > 0 ||
    queue.some((item) => item.status === "rejected")
  );
}

export function buildTicketCreateSuccessHref(
  basePath: string,
  options?: { aiQueued?: boolean },
): string {
  const params = new URLSearchParams();
  params.set("created", "1");
  if (options?.aiQueued) {
    params.set("ai_queued", "1");
  }
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}${params.toString()}`;
}

export function readAiQueuedFromSearch(
  search: string | null | undefined,
): boolean {
  if (!search) {
    return false;
  }
  const params = new URLSearchParams(
    search.startsWith("?") ? search : `?${search}`,
  );
  return params.get("ai_queued") === "1";
}

export function readTicketCreatedFromSearch(
  search: string | null | undefined,
): boolean {
  if (!search) {
    return false;
  }
  const params = new URLSearchParams(
    search.startsWith("?") ? search : `?${search}`,
  );
  return params.get("created") === "1";
}
