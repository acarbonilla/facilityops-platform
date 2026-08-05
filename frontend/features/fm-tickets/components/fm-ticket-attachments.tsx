"use client";

import { useMemo, useState } from "react";

import { AttachmentList } from "@/features/attachments/components/attachment-list";
import { AttachmentUploader } from "@/features/attachments/components/attachment-uploader";
import {
  getAttachmentMutationErrorMessage,
  useAttachmentList,
  useDeleteAttachment,
} from "@/hooks/use-attachments";
import { usePermissions } from "@/hooks/use-permissions";
import {
  canShowAttachmentDelete,
  canShowAttachmentDownload,
  canShowAttachmentUpload,
} from "@/lib/attachments/attachments";
import {
  buildFmTicketAttachmentOwnerContext,
  canUploadFmTicketAttachment,
  getFmTicketAttachmentSectionGuidance,
  resolveFmTicketUploadVisibility,
  type FmTicketAttachmentAudience,
} from "@/lib/fm-tickets/attachments";
import { ATTACHMENT_PERMISSIONS, type AttachmentVisibility } from "@/types/attachments";

export interface FmTicketAttachmentsProps {
  ticketId: string;
  ticketStatus: string;
  audience: FmTicketAttachmentAudience;
  /** Internal uploads may request requester-visible sharing. */
  defaultVisibility?: AttachmentVisibility;
  /** FO-097: notified after successful uploads (attachment IDs). */
  onUploaded?: (uploadedIds: string[]) => void;
}

export function FmTicketAttachments({
  ticketId,
  ticketStatus,
  audience,
  defaultVisibility,
  onUploaded,
}: FmTicketAttachmentsProps) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const [selectedVisibility, setSelectedVisibility] = useState<AttachmentVisibility>(
    defaultVisibility ?? "internal_only",
  );
  const ownerContext = useMemo(
    () => buildFmTicketAttachmentOwnerContext(ticketId),
    [ticketId],
  );
  const listParams = useMemo(
    () => ({
      owner_type: ownerContext.owner_type,
      owner_id: ownerContext.owner_id,
      page_size: 50,
    }),
    [ownerContext],
  );

  const hasAttachmentView = hasPermission(ATTACHMENT_PERMISSIONS.view);
  const hasAttachmentUpload = canShowAttachmentUpload(
    hasPermission(ATTACHMENT_PERMISSIONS.upload),
  );
  const hasAttachmentDownload = canShowAttachmentDownload(
    hasPermission(ATTACHMENT_PERMISSIONS.download),
  );
  const hasAttachmentDelete = canShowAttachmentDelete(
    hasPermission(ATTACHMENT_PERMISSIONS.delete),
  );
  const hasTicketUpdate =
    hasPermission("fm_tickets.update") || hasPermission("fm_tickets.manage");

  const canUpload = canUploadFmTicketAttachment({
    audience,
    hasAttachmentUpload,
    hasTicketUpdate,
    ticketStatus,
  });

  const visibility = resolveFmTicketUploadVisibility(
    audience,
    audience === "internal" ? selectedVisibility : defaultVisibility,
  );
  const uploadOptions = useMemo(
    () => ({
      owner_type: ownerContext.owner_type,
      owner_id: ownerContext.owner_id,
      visibility,
    }),
    [ownerContext, visibility],
  );

  const listQuery = useAttachmentList(
    listParams,
    hasAttachmentView && !permissionsLoading && Boolean(ticketId),
  );
  const deleteMutation = useDeleteAttachment();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (permissionsLoading) {
    return (
      <section
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        aria-busy="true"
      >
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Attachments
        </h2>
        <p className="text-sm text-slate-600">Checking attachment permissions…</p>
      </section>
    );
  }

  if (!hasAttachmentView && !canUpload) {
    return null;
  }

  return (
    <section
      className="space-y-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      aria-labelledby="fm-ticket-attachments-heading"
    >
      <div>
        <h2
          id="fm-ticket-attachments-heading"
          className="text-xl font-semibold tracking-tight text-slate-950"
        >
          Attachments
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {getFmTicketAttachmentSectionGuidance(audience)}
        </p>
      </div>

      {canUpload && audience === "internal" ? (
        <div className="max-w-sm space-y-1">
          <label
            className="block text-sm font-medium text-slate-800"
            htmlFor="fm-ticket-attachment-visibility"
          >
            Upload visibility
          </label>
          <select
            id="fm-ticket-attachment-visibility"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            value={selectedVisibility}
            onChange={(event) =>
              setSelectedVisibility(event.target.value as AttachmentVisibility)
            }
          >
            <option value="internal_only">Internal only</option>
            <option value="requester_visible">Requester visible</option>
          </select>
        </div>
      ) : null}

      {canUpload ? (
        <AttachmentUploader
          canUpload={canUpload}
          uploadOptions={uploadOptions}
          guidanceText={getFmTicketAttachmentSectionGuidance(audience)}
          onUploaded={(uploadedIds) => {
            void listQuery.refetch();
            onUploaded?.(uploadedIds);
          }}
        />
      ) : (
        <p
          className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"
          role="status"
        >
          {ticketStatus === "closed" || ticketStatus === "cancelled"
            ? "Uploads are unavailable because this ticket is closed or cancelled."
            : "Upload controls are hidden for your current permissions."}
        </p>
      )}

      {hasAttachmentView ? (
        <AttachmentList
          heading="Ticket attachments"
          attachments={listQuery.data?.results ?? []}
          totalCount={listQuery.data?.count}
          isLoading={listQuery.isLoading}
          isError={listQuery.isError}
          errorMessage={
            listQuery.error
              ? getAttachmentMutationErrorMessage(
                  listQuery.error,
                  "Unable to load attachments for this ticket.",
                )
              : undefined
          }
          canDownload={hasAttachmentDownload}
          canDelete={hasAttachmentDelete}
          canUpload={canUpload}
          showVisibility={audience === "internal"}
          hideUploaderEmail={audience === "requester"}
          isDeletingId={deletingId}
          onRefresh={() => {
            void listQuery.refetch();
          }}
          onDelete={async (attachment) => {
            setDeletingId(attachment.id);
            try {
              await deleteMutation.mutateAsync(attachment.id);
            } finally {
              setDeletingId(null);
            }
          }}
        />
      ) : null}
    </section>
  );
}
