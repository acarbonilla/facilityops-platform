"use client";

import { FileImage, UploadCloud, X } from "lucide-react";
import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  type DragEvent,
  type KeyboardEvent,
} from "react";

import {
  ATTACHMENT_MAX_UPLOAD_BYTES,
  type QueuedAttachmentFile,
} from "@/types/attachments";
import { cn } from "@/lib/utils";
import {
  formatAttachmentBytes,
  getUploadableQueueItems,
  markQueuedAttachment,
  removeQueuedAttachment,
  truncateFilename,
} from "@/lib/attachments/attachments";
import {
  enqueueTicketCreateImages,
  FM_TICKET_IMAGE_ACCEPT_ATTRIBUTE,
  getQueuedImageCount,
  getTicketCreateImageGuidance,
} from "@/lib/fm-tickets/create-image-staging";
import { getAttachmentMutationErrorMessage } from "@/hooks/use-attachments";
import { uploadAttachment } from "@/services/api/attachments";
import type { AttachmentUploadOptions } from "@/types/attachments";

export type TicketCreateImageStagingHandle = {
  getQueue: () => QueuedAttachmentFile[];
  getUploadableFiles: () => QueuedAttachmentFile[];
  hasRejected: () => boolean;
  uploadAll: (options: AttachmentUploadOptions) => Promise<string[]>;
};

export interface TicketCreateImageStagingProps {
  canUpload: boolean;
  disabled?: boolean;
  maxBytes?: number;
  guidanceText?: string;
  onQueueChange?: (queue: QueuedAttachmentFile[]) => void;
}

export const TicketCreateImageStaging = forwardRef<
  TicketCreateImageStagingHandle,
  TicketCreateImageStagingProps
>(function TicketCreateImageStaging(
  {
    canUpload,
    disabled = false,
    maxBytes = ATTACHMENT_MAX_UPLOAD_BYTES,
    guidanceText,
    onQueueChange,
  },
  ref,
) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueuedAttachmentFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const guidanceId = `${inputId}-guidance`;
  const statusId = `${inputId}-status`;

  useEffect(() => {
    onQueueChange?.(queue);
  }, [queue, onQueueChange]);

  useEffect(() => {
    const nextUrls: Record<string, string> = {};
    for (const item of queue) {
      if (item.status === "rejected") {
        continue;
      }
      nextUrls[item.localId] = URL.createObjectURL(item.file);
    }
    setPreviewUrls((previous) => {
      for (const url of Object.values(previous)) {
        URL.revokeObjectURL(url);
      }
      return nextUrls;
    });
    return () => {
      for (const url of Object.values(nextUrls)) {
        URL.revokeObjectURL(url);
      }
    };
  }, [queue]);

  useImperativeHandle(
    ref,
    () => ({
      getQueue: () => queue,
      getUploadableFiles: () => getUploadableQueueItems(queue),
      hasRejected: () => queue.some((item) => item.status === "rejected"),
      uploadAll: async (options: AttachmentUploadOptions) => {
        const targets = getUploadableQueueItems(queue);
        if (targets.length === 0) {
          return [];
        }
        setIsUploading(true);
        setBanner(null);
        const uploadedIds: string[] = [];
        let failureCount = 0;
        for (const item of targets) {
          setQueue((current) =>
            markQueuedAttachment(current, item.localId, {
              status: "uploading",
              errorMessage: undefined,
            }),
          );
          try {
            const uploaded = await uploadAttachment(item.file, {
              ...options,
              category: options.category ?? "image_evidence",
            });
            uploadedIds.push(uploaded.id);
            setQueue((current) =>
              markQueuedAttachment(current, item.localId, {
                status: "success",
                uploadedAttachmentId: uploaded.id,
                errorMessage: undefined,
              }),
            );
          } catch (error) {
            failureCount += 1;
            setQueue((current) =>
              markQueuedAttachment(current, item.localId, {
                status: "error",
                errorMessage: getAttachmentMutationErrorMessage(
                  error,
                  "Upload failed. Please try again.",
                ),
              }),
            );
          }
        }
        setIsUploading(false);
        if (failureCount > 0) {
          setBanner(
            uploadedIds.length === 0
              ? "Image upload failed. Fix the errors and submit again."
              : `${uploadedIds.length} image(s) uploaded; ${failureCount} failed.`,
          );
          throw new Error("One or more image uploads failed.");
        }
        setBanner(
          uploadedIds.length === 1
            ? "Image uploaded successfully."
            : `${uploadedIds.length} images uploaded successfully.`,
        );
        return uploadedIds;
      },
    }),
    [queue],
  );

  if (!canUpload) {
    return null;
  }

  function openPicker() {
    if (disabled || isUploading) {
      return;
    }
    inputRef.current?.click();
  }

  function handleFiles(fileList: FileList | File[] | null) {
    if (!fileList || disabled || isUploading) {
      return;
    }
    const files = Array.from(fileList);
    const { next, rejected } = enqueueTicketCreateImages(queue, files, maxBytes);
    setQueue(next);
    setBanner(
      rejected.length > 0
        ? rejected.join(" ")
        : files.length > 0
          ? `${files.length} image(s) ready for submission.`
          : null,
    );
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    handleFiles(event.dataTransfer.files);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled && !isUploading) {
      setDragActive(true);
    }
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  }

  function onZoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPicker();
    }
  }

  const imageCount = getQueuedImageCount(queue);

  return (
    <section className="space-y-4" aria-labelledby={`${inputId}-title`}>
      <div>
        <h2 id={`${inputId}-title`} className="text-lg font-semibold text-slate-900">
          Upload images
        </h2>
        <p id={guidanceId} className="mt-1 text-sm text-slate-600">
          {guidanceText ?? getTicketCreateImageGuidance(maxBytes)}
        </p>
        <p className="mt-1 text-xs text-slate-500" aria-live="polite">
          {imageCount === 0
            ? "No images selected."
            : `${imageCount} image${imageCount === 1 ? "" : "s"} selected.`}
        </p>
      </div>

      <div
        role="button"
        tabIndex={disabled || isUploading ? -1 : 0}
        aria-controls={inputId}
        aria-describedby={`${guidanceId} ${statusId}`}
        aria-disabled={disabled || isUploading}
        aria-label="Image upload zone. Press Enter or Space to choose images, or drop images here."
        className={cn(
          "rounded-xl border-2 border-dashed p-6 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700",
          dragActive
            ? "border-blue-600 bg-blue-50"
            : "border-slate-300 bg-slate-50 hover:border-blue-400",
          (disabled || isUploading) && "cursor-not-allowed opacity-60",
        )}
        onClick={openPicker}
        onKeyDown={onZoneKeyDown}
        onDragEnter={onDragOver}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <UploadCloud className="h-8 w-8 text-blue-700" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-900">
            Drop images here or press Enter to browse
          </p>
          <p className="text-xs text-slate-600">
            Accepted: {FM_TICKET_IMAGE_ACCEPT_ATTRIBUTE}. Max{" "}
            {formatAttachmentBytes(maxBytes)}.
          </p>
        </div>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          accept={FM_TICKET_IMAGE_ACCEPT_ATTRIBUTE}
          multiple
          disabled={disabled || isUploading}
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      <div id={statusId} className="space-y-3" aria-live="polite">
        {banner ? (
          <p className="text-sm text-slate-700" role="status">
            {banner}
          </p>
        ) : null}

        {queue.length === 0 ? null : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {queue.map((item) => {
              const previewUrl = previewUrls[item.localId];
              return (
                <li
                  key={item.localId}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  <div className="relative aspect-video bg-slate-100">
                    {previewUrl && item.status !== "rejected" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                      <img
                        alt=""
                        className="h-full w-full object-cover"
                        src={previewUrl}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <FileImage className="h-8 w-8 text-slate-400" aria-hidden="true" />
                      </div>
                    )}
                    {item.status !== "uploading" && item.status !== "success" ? (
                      <button
                        type="button"
                        className="absolute right-2 top-2 rounded-md bg-white/90 p-1.5 text-slate-700 shadow-sm hover:bg-white disabled:opacity-60"
                        disabled={isUploading || disabled}
                        onClick={(event) => {
                          event.stopPropagation();
                          setQueue((current) =>
                            removeQueuedAttachment(current, item.localId),
                          );
                        }}
                        aria-label={`Remove ${item.name}`}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-1 p-3">
                    <p
                      className="truncate text-sm font-medium text-slate-900"
                      title={item.name}
                    >
                      {truncateFilename(item.name, 40)}
                    </p>
                    <p className="text-xs text-slate-600">
                      {formatAttachmentBytes(item.size)} ·{" "}
                      <span className="capitalize">
                        {item.status === "queued" ? "Ready" : item.status}
                      </span>
                    </p>
                    {item.errorMessage ? (
                      <p className="text-xs text-red-700" role="alert">
                        {item.errorMessage}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
});
