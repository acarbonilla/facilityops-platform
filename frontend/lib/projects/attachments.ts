/** FO-103 Project Management attachment helpers. */

export const PROJECT_ATTACHMENT_OWNER_TYPE = "project" as const;

export type ProjectAttachmentOwnerContext = {
  owner_type: typeof PROJECT_ATTACHMENT_OWNER_TYPE;
  owner_id: string;
};

const IMMUTABLE_STATUSES = new Set(["completed", "cancelled"]);

export function buildProjectAttachmentOwnerContext(
  projectId: string,
): ProjectAttachmentOwnerContext {
  return {
    owner_type: PROJECT_ATTACHMENT_OWNER_TYPE,
    owner_id: projectId,
  };
}

export function isProjectAttachmentImmutable(
  status: string | null | undefined,
): boolean {
  return Boolean(status && IMMUTABLE_STATUSES.has(status));
}

export function canUploadProjectAttachment(options: {
  hasAttachmentUpload: boolean;
  hasProjectUpdate: boolean;
  projectStatus: string | null | undefined;
}): boolean {
  if (!options.hasAttachmentUpload || !options.hasProjectUpdate) {
    return false;
  }
  return !isProjectAttachmentImmutable(options.projectStatus);
}

export function getProjectAttachmentSectionGuidance(): string {
  return "Upload project plans, drawings, photos, and supporting documents. Files stay internal to the project record.";
}
