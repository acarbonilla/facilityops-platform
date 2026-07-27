"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteAttachment,
  downloadAttachmentBlob,
  listAttachments,
  uploadAttachment,
} from "@/services/api/attachments";
import { attachmentQueryKeys } from "@/services/api/query-keys";
import type { AttachmentListParams } from "@/types/attachments";

import {
  formatAttachmentApiError,
  parseContentDispositionFilename,
} from "@/lib/attachments/attachments";

export function useAttachmentList(params?: AttachmentListParams, enabled = true) {
  return useQuery({
    queryKey: attachmentQueryKeys.list(params),
    queryFn: () => listAttachments(params),
    enabled,
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadAttachment(file),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attachmentQueryKeys.all });
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAttachment(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attachmentQueryKeys.all });
    },
  });
}

export async function triggerAttachmentDownload(
  id: string,
  fallbackFilename: string,
): Promise<void> {
  const { blob, headers } = await downloadAttachmentBlob(id);
  const filename = parseContentDispositionFilename(
    headers.get("Content-Disposition"),
    fallbackFilename,
  );
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function getAttachmentMutationErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return formatAttachmentApiError(error, fallback);
}
