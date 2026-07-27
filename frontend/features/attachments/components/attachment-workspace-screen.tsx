"use client";

import { useState } from "react";

import { PageHeader } from "@/components/common/page-header";
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
import { ATTACHMENT_PERMISSIONS } from "@/types/attachments";

export function AttachmentWorkspaceScreen() {
  const { hasPermission, permissionsLoading } = usePermissions();
  const canView = hasPermission(ATTACHMENT_PERMISSIONS.view);
  const canUpload = canShowAttachmentUpload(
    hasPermission(ATTACHMENT_PERMISSIONS.upload),
  );
  const canDownload = canShowAttachmentDownload(
    hasPermission(ATTACHMENT_PERMISSIONS.download),
  );
  const canDelete = canShowAttachmentDelete(
    hasPermission(ATTACHMENT_PERMISSIONS.delete),
  );

  const listQuery = useAttachmentList({ page_size: 50 }, canView && !permissionsLoading);
  const deleteMutation = useDeleteAttachment();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        eyebrow="FO-080 integration surface"
        title="Attachments"
        description="Reusable attachment upload, listing, download, and deletion workspace built on the FO-079 secure backend. Module embedding for FM Tickets, Maintenance, and 5S is deferred to FO-081 and FO-082."
      />

      {!permissionsLoading && !canView && !canUpload ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          You do not have attachment permissions for this workspace.
        </p>
      ) : null}

      {canUpload ? (
        <AttachmentUploader
          canUpload={canUpload}
          onUploaded={() => {
            void listQuery.refetch();
          }}
        />
      ) : (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600" role="status">
          Upload controls are hidden because your account lacks{" "}
          <code className="text-xs">attachments.upload</code>.
        </p>
      )}

      {canView ? (
        <AttachmentList
          attachments={listQuery.data?.results ?? []}
          isLoading={listQuery.isLoading || permissionsLoading}
          isError={listQuery.isError}
          errorMessage={
            listQuery.error
              ? getAttachmentMutationErrorMessage(
                  listQuery.error,
                  "Unable to load attachments.",
                )
              : undefined
          }
          canDownload={canDownload}
          canDelete={canDelete}
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
    </div>
  );
}
