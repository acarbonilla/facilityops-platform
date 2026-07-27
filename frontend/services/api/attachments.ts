import { apiBlobClient, apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";
import type { PaginatedResponse } from "./types";

import type { Attachment, AttachmentListParams } from "@/types/attachments";

export function listAttachments(
  params?: AttachmentListParams,
): Promise<PaginatedResponse<Attachment>> {
  return apiClient<PaginatedResponse<Attachment>>(API_ENDPOINTS.attachments.list, {
    method: "GET",
    query: params,
  });
}

export function getAttachment(id: string): Promise<Attachment> {
  return apiClient<Attachment>(API_ENDPOINTS.attachments.detail(id), {
    method: "GET",
  });
}

export function uploadAttachment(
  file: File,
  category?: string,
): Promise<Attachment> {
  const body = new FormData();
  body.append("file", file, file.name);
  if (category) {
    body.append("category", category);
  }
  return apiClient<Attachment>(API_ENDPOINTS.attachments.list, {
    method: "POST",
    body,
  });
}

export function deleteAttachment(id: string): Promise<Attachment> {
  return apiClient<Attachment>(API_ENDPOINTS.attachments.detail(id), {
    method: "DELETE",
  });
}

export async function downloadAttachmentBlob(id: string): Promise<{
  blob: Blob;
  headers: Headers;
}> {
  const result = await apiBlobClient(API_ENDPOINTS.attachments.download(id), {
    method: "GET",
  });
  return { blob: result.blob, headers: result.headers };
}
