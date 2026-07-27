"use client";

import { FileImage, FileText, UploadCloud } from "lucide-react";
import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from "react";

import {
  ATTACHMENT_ACCEPT_ATTRIBUTE,
  ATTACHMENT_MAX_UPLOAD_BYTES,
  type QueuedAttachmentFile,
} from "@/types/attachments";
import { cn } from "@/lib/utils";
import {
  enqueueAttachmentFiles,
  formatAttachmentBytes,
  getAttachmentTypeLabel,
  getAttachmentWorkspaceGuidance,
  getFileExtension,
  getUploadableQueueItems,
  markQueuedAttachment,
  removeQueuedAttachment,
  truncateFilename,
} from "@/lib/attachments/attachments";
import { getAttachmentMutationErrorMessage } from "@/hooks/use-attachments";
import { uploadAttachment } from "@/services/api/attachments";

export interface AttachmentUploaderProps {
  canUpload: boolean;
  disabled?: boolean;
  maxBytes?: number;
  onUploaded?: () => void;
}

export function AttachmentUploader({
  canUpload,
  disabled = false,
  maxBytes = ATTACHMENT_MAX_UPLOAD_BYTES,
  onUploaded,
}: AttachmentUploaderProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueuedAttachmentFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const guidanceId = `${inputId}-guidance`;
  const statusId = `${inputId}-status`;

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
    const { next, rejected } = enqueueAttachmentFiles(queue, files, maxBytes);
    setQueue(next);
    setBanner(
      rejected.length > 0
        ? rejected.join(" ")
        : files.length > 0
          ? `${files.length} file(s) added to the upload queue.`
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

  async function uploadOne(item: QueuedAttachmentFile) {
    setQueue((current) =>
      markQueuedAttachment(current, item.localId, {
        status: "uploading",
        errorMessage: undefined,
      }),
    );
    try {
      const uploaded = await uploadAttachment(item.file);
      setQueue((current) =>
        markQueuedAttachment(current, item.localId, {
          status: "success",
          uploadedAttachmentId: uploaded.id,
          errorMessage: undefined,
        }),
      );
      onUploaded?.();
      return true;
    } catch (error) {
      setQueue((current) =>
        markQueuedAttachment(current, item.localId, {
          status: "error",
          errorMessage: getAttachmentMutationErrorMessage(
            error,
            "Upload failed. Please try again.",
          ),
        }),
      );
      return false;
    }
  }

  async function uploadQueued() {
    if (isUploading || disabled) {
      return;
    }
    const targets = getUploadableQueueItems(queue);
    if (targets.length === 0) {
      setBanner("No valid files are ready to upload.");
      return;
    }

    setIsUploading(true);
    setBanner(null);
    let successCount = 0;
    let failureCount = 0;
    for (const item of targets) {
      const ok = await uploadOne(item);
      if (ok) {
        successCount += 1;
      } else {
        failureCount += 1;
      }
    }
    setIsUploading(false);
    if (failureCount === 0) {
      setBanner(
        successCount === 1
          ? "Upload completed successfully."
          : `${successCount} uploads completed successfully.`,
      );
    } else if (successCount === 0) {
      setBanner("All uploads failed. Review each file and retry.");
    } else {
      setBanner(
        `${successCount} upload(s) succeeded; ${failureCount} failed. Successful files were kept.`,
      );
    }
  }

  async function retryOne(localId: string) {
    const item = queue.find((entry) => entry.localId === localId);
    if (!item || isUploading || disabled) {
      return;
    }
    setIsUploading(true);
    await uploadOne(item);
    setIsUploading(false);
  }

  return (
    <section className="space-y-4" aria-labelledby={`${inputId}-title`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`${inputId}-title`} className="text-lg font-semibold text-slate-900">
            Upload attachments
          </h2>
          <p id={guidanceId} className="mt-1 text-sm text-slate-600">
            {getAttachmentWorkspaceGuidance()}
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled || isUploading || getUploadableQueueItems(queue).length === 0}
          onClick={() => void uploadQueued()}
        >
          {isUploading ? "Uploading…" : "Upload queued files"}
        </button>
      </div>

      <div
        role="button"
        tabIndex={disabled || isUploading ? -1 : 0}
        aria-controls={inputId}
        aria-describedby={`${guidanceId} ${statusId}`}
        aria-disabled={disabled || isUploading}
        aria-label="Attachment upload zone. Press Enter or Space to choose files, or drop files here."
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
            Drop files here or press Enter to browse
          </p>
          <p className="text-xs text-slate-600">
            Accepted: {ATTACHMENT_ACCEPT_ATTRIBUTE}. Max{" "}
            {formatAttachmentBytes(maxBytes)}.
          </p>
        </div>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ATTACHMENT_ACCEPT_ATTRIBUTE}
          multiple
          disabled={disabled || isUploading}
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>

      <div id={statusId} className="space-y-2" aria-live="polite">
        {banner ? (
          <p className="text-sm text-slate-700" role="status">
            {banner}
          </p>
        ) : null}

        {queue.length === 0 ? (
          <p className="text-sm text-slate-500">No files selected yet.</p>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {queue.map((item) => {
              const typeLabel = getAttachmentTypeLabel(
                item.type,
                getFileExtension(item.name),
              );
              const Icon = typeLabel === "PDF" ? FileText : FileImage;
              return (
                <li
                  key={item.localId}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex items-start gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-medium text-slate-900"
                        title={item.name}
                      >
                        {truncateFilename(item.name, 56)}
                      </p>
                      <p className="text-xs text-slate-600">
                        {typeLabel} · {formatAttachmentBytes(item.size)} ·{" "}
                        <span className="capitalize">{item.status}</span>
                      </p>
                      {item.errorMessage ? (
                        <p className="mt-1 text-xs text-red-700" role="alert">
                          {item.errorMessage}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {item.status === "error" ? (
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        disabled={isUploading || disabled}
                        onClick={() => void retryOne(item.localId)}
                        aria-label={`Retry upload for ${item.name}`}
                      >
                        Retry
                      </button>
                    ) : null}
                    {item.status !== "uploading" && item.status !== "success" ? (
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        disabled={isUploading || disabled}
                        onClick={() =>
                          setQueue((current) =>
                            removeQueuedAttachment(current, item.localId),
                          )
                        }
                        aria-label={`Remove ${item.name} from queue`}
                      >
                        Remove
                      </button>
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
}
