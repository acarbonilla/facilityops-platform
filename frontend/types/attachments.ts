export type AttachmentCategory = "image_evidence" | "document" | "other";
export type AttachmentStatus = "active" | "retired";

/** Safe attachment metadata returned by FO-079 APIs. */
export interface Attachment {
  id: string;
  original_filename: string;
  display_filename: string;
  validated_content_type: string;
  extension: string;
  size_bytes: number;
  category: AttachmentCategory;
  status: AttachmentStatus;
  uploader_email: string;
  created_at: string;
  updated_at: string;
  download_url: string;
}

export type AttachmentListParams = {
  page?: number;
  page_size?: number;
};

export const ATTACHMENT_PERMISSIONS = {
  view: "attachments.view",
  upload: "attachments.upload",
  download: "attachments.download",
  delete: "attachments.delete",
} as const;

/** Aligns with backend ATTACHMENT_MAX_UPLOAD_BYTES default (10 MiB). */
export const ATTACHMENT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_ACCEPTED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".pdf",
] as const;

export const ATTACHMENT_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const ATTACHMENT_ACCEPT_ATTRIBUTE = ATTACHMENT_ACCEPTED_EXTENSIONS.join(",");

export type QueuedAttachmentStatus =
  | "queued"
  | "uploading"
  | "success"
  | "error"
  | "rejected";

export interface QueuedAttachmentFile {
  localId: string;
  file: File;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  status: QueuedAttachmentStatus;
  errorMessage?: string;
  uploadedAttachmentId?: string;
}
