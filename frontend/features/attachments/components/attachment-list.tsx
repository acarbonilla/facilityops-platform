"use client";

import { FileImage, FileText, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import type { Attachment } from "@/types/attachments";
import {
  formatAttachmentBytes,
  formatAttachmentDate,
  getAttachmentTypeLabel,
  isImageAttachment,
  truncateFilename,
} from "@/lib/attachments/attachments";
import {
  getAttachmentMutationErrorMessage,
  triggerAttachmentDownload,
} from "@/hooks/use-attachments";

export interface AttachmentListProps {
  attachments: Attachment[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  canDownload: boolean;
  canDelete: boolean;
  isDeletingId?: string | null;
  onRefresh?: () => void;
  onDelete?: (attachment: Attachment) => Promise<void>;
}

export function AttachmentList({
  attachments,
  isLoading = false,
  isError = false,
  errorMessage,
  canDownload,
  canDelete,
  isDeletingId = null,
  onRefresh,
  onDelete,
}: AttachmentListProps) {
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pendingDelete) {
      return;
    }
    cancelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isDeletingId) {
        setPendingDelete(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pendingDelete, isDeletingId]);

  async function handleDownload(attachment: Attachment) {
    setActionError(null);
    setActionStatus(null);
    setDownloadingId(attachment.id);
    try {
      await triggerAttachmentDownload(
        attachment.id,
        attachment.display_filename || attachment.original_filename,
      );
      setActionStatus(`Download started for ${attachment.display_filename}.`);
    } catch (error) {
      setActionError(
        getAttachmentMutationErrorMessage(
          error,
          "Download failed. You may not have access to this file.",
        ),
      );
    } finally {
      setDownloadingId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || !onDelete) {
      return;
    }
    setActionError(null);
    setActionStatus(null);
    try {
      await onDelete(pendingDelete);
      setActionStatus(`Deleted ${pendingDelete.display_filename}.`);
      setPendingDelete(null);
    } catch (error) {
      setActionError(
        getAttachmentMutationErrorMessage(
          error,
          "Delete failed. Refresh and try again if you still have access.",
        ),
      );
    }
  }

  if (isLoading) {
    return (
      <LoadingState
        title="Loading attachments"
        message="Fetching authorized attachment metadata."
      />
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Unable to load attachments"
        message={errorMessage ?? "The attachment list could not be loaded."}
        action={
          onRefresh ? (
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={onRefresh}
            >
              Retry
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="attachment-list-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="attachment-list-title" className="text-lg font-semibold text-slate-900">
            Attachment library
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Showing files you are authorized to view. Storage paths are never displayed.
          </p>
        </div>
        {onRefresh ? (
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onRefresh}
            aria-label="Refresh attachment list"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        ) : null}
      </div>

      <div aria-live="polite" className="space-y-2">
        {actionStatus ? (
          <p className="text-sm text-emerald-800" role="status">
            {actionStatus}
          </p>
        ) : null}
        {actionError ? (
          <p className="text-sm text-red-700" role="alert">
            {actionError}
          </p>
        ) : null}
      </div>

      {attachments.length === 0 ? (
        <EmptyState
          title="No attachments yet"
          message="Upload a JPEG, PNG, WEBP, or PDF to populate this library."
        />
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {attachments.map((attachment) => {
            const typeLabel = getAttachmentTypeLabel(
              attachment.validated_content_type,
              attachment.extension,
            );
            const Icon = isImageAttachment(
              attachment.validated_content_type,
              attachment.extension,
            )
              ? FileImage
              : FileText;
            const deleting = isDeletingId === attachment.id;
            const downloading = downloadingId === attachment.id;
            return (
              <li
                key={attachment.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-medium text-slate-900"
                      title={attachment.display_filename}
                    >
                      {truncateFilename(attachment.display_filename, 56)}
                    </p>
                    <p className="text-xs text-slate-600">
                      {typeLabel} · {formatAttachmentBytes(attachment.size_bytes)} ·{" "}
                      {formatAttachmentDate(attachment.created_at)}
                      {attachment.uploader_email
                        ? ` · ${attachment.uploader_email}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {canDownload ? (
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      disabled={downloading || Boolean(isDeletingId)}
                      onClick={() => void handleDownload(attachment)}
                      aria-label={`Download ${attachment.display_filename}`}
                    >
                      {downloading ? "Downloading…" : "Download"}
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      className="rounded-md border border-red-300 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      disabled={Boolean(isDeletingId)}
                      onClick={() => {
                        setActionError(null);
                        setPendingDelete(attachment);
                      }}
                      aria-label={`Delete ${attachment.display_filename}`}
                    >
                      {deleting ? "Deleting…" : "Delete"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="attachment-delete-title"
            aria-describedby="attachment-delete-description"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"
          >
            <h3
              id="attachment-delete-title"
              className="text-lg font-semibold text-slate-900"
            >
              Delete attachment?
            </h3>
            <p id="attachment-delete-description" className="mt-2 text-sm text-slate-600">
              Soft-delete{" "}
              <span className="font-medium text-slate-900">
                {pendingDelete.display_filename}
              </span>
              ? It will no longer appear in authorized lists.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                ref={cancelRef}
                type="button"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                disabled={Boolean(isDeletingId)}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
                disabled={Boolean(isDeletingId)}
                onClick={() => void confirmDelete()}
              >
                {isDeletingId ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
