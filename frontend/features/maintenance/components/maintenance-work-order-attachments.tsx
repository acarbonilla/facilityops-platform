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
  buildMaintenanceAttachmentOwnerContext,
  canUploadMaintenanceAttachment,
  getMaintenanceAttachmentSectionGuidance,
  isMaintenanceAttachmentImmutable,
} from "@/lib/maintenance/attachments";
import { ATTACHMENT_PERMISSIONS } from "@/types/attachments";

export interface MaintenanceWorkOrderAttachmentsProps {
  workOrderId: string;
  workOrderStatus: string;
}

export function MaintenanceWorkOrderAttachments({
  workOrderId,
  workOrderStatus,
}: MaintenanceWorkOrderAttachmentsProps) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const ownerContext = useMemo(
    () => buildMaintenanceAttachmentOwnerContext(workOrderId),
    [workOrderId],
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
  const hasWorkOrderUpdate =
    hasPermission("maintenance.update") ||
    hasPermission("maintenance.work_order.update") ||
    hasPermission("maintenance.manage");

  const canUpload = canUploadMaintenanceAttachment({
    hasAttachmentUpload,
    hasWorkOrderUpdate,
    workOrderStatus,
  });
  const uploadOptions = useMemo(
    () => ({
      owner_type: ownerContext.owner_type,
      owner_id: ownerContext.owner_id,
      visibility: "internal_only" as const,
    }),
    [ownerContext],
  );

  const listQuery = useAttachmentList(
    listParams,
    hasAttachmentView && !permissionsLoading && Boolean(workOrderId),
  );
  const deleteMutation = useDeleteAttachment();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (permissionsLoading) {
    return (
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-busy="true">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">Attachments</h2>
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
      aria-labelledby="maintenance-attachments-heading"
    >
      <div>
        <h2
          id="maintenance-attachments-heading"
          className="text-xl font-semibold tracking-tight text-slate-950"
        >
          Attachments
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {getMaintenanceAttachmentSectionGuidance()}
        </p>
      </div>

      {canUpload ? (
        <AttachmentUploader
          canUpload={canUpload}
          uploadOptions={uploadOptions}
          guidanceText={getMaintenanceAttachmentSectionGuidance()}
          onUploaded={() => {
            void listQuery.refetch();
          }}
        />
      ) : (
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600" role="status">
          {isMaintenanceAttachmentImmutable(workOrderStatus)
            ? "Uploads are unavailable because this work order is completed, cancelled, or closed."
            : "Upload controls are hidden for your current permissions."}
        </p>
      )}

      {hasAttachmentView ? (
        <AttachmentList
          heading="Work order attachments"
          attachments={listQuery.data?.results ?? []}
          totalCount={listQuery.data?.count}
          isLoading={listQuery.isLoading}
          isError={listQuery.isError}
          errorMessage={
            listQuery.error
              ? getAttachmentMutationErrorMessage(
                  listQuery.error,
                  "Unable to load attachments for this work order.",
                )
              : undefined
          }
          canDownload={hasAttachmentDownload}
          canDelete={hasAttachmentDelete}
          canUpload={canUpload}
          showVisibility={false}
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
