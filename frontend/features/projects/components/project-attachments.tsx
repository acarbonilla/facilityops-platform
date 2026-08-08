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
  buildProjectAttachmentOwnerContext,
  canUploadProjectAttachment,
  getProjectAttachmentSectionGuidance,
  isProjectAttachmentImmutable,
} from "@/lib/projects/attachments";
import { ATTACHMENT_PERMISSIONS } from "@/types/attachments";

export interface ProjectAttachmentsProps {
  projectId: string;
  projectStatus: string;
}

export function ProjectAttachments({
  projectId,
  projectStatus,
}: ProjectAttachmentsProps) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const ownerContext = useMemo(
    () => buildProjectAttachmentOwnerContext(projectId),
    [projectId],
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
  const hasProjectUpdate =
    hasPermission("projects.update") || hasPermission("projects.manage");

  const canUpload = canUploadProjectAttachment({
    hasAttachmentUpload,
    hasProjectUpdate,
    projectStatus,
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
    hasAttachmentView && !permissionsLoading && Boolean(projectId),
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
      aria-labelledby="project-attachments-heading"
    >
      <div>
        <h2
          id="project-attachments-heading"
          className="text-xl font-semibold tracking-tight text-slate-950"
        >
          Attachments
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {getProjectAttachmentSectionGuidance()}
        </p>
      </div>

      {canUpload ? (
        <AttachmentUploader
          canUpload={canUpload}
          uploadOptions={uploadOptions}
          guidanceText={getProjectAttachmentSectionGuidance()}
          onUploaded={() => {
            void listQuery.refetch();
          }}
        />
      ) : (
        <p
          className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"
          role="status"
        >
          {isProjectAttachmentImmutable(projectStatus)
            ? "Uploads are unavailable because this project is completed or cancelled."
            : "Upload controls are hidden for your current permissions."}
        </p>
      )}

      {hasAttachmentView ? (
        <AttachmentList
          heading="Project attachments"
          attachments={listQuery.data?.results ?? []}
          totalCount={listQuery.data?.count}
          isLoading={listQuery.isLoading}
          isError={listQuery.isError}
          errorMessage={
            listQuery.error
              ? getAttachmentMutationErrorMessage(
                  listQuery.error,
                  "Unable to load attachments for this project.",
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
