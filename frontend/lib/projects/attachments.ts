/** FO-103/FO-104 Project Management attachment helpers. */

export const PROJECT_ATTACHMENT_OWNER_TYPE = "project" as const;
export const PROJECT_TASK_ATTACHMENT_OWNER_TYPE = "project_task" as const;

export type ProjectAttachmentOwnerContext = {
  owner_type: typeof PROJECT_ATTACHMENT_OWNER_TYPE;
  owner_id: string;
};

export type ProjectTaskAttachmentOwnerContext = {
  owner_type: typeof PROJECT_TASK_ATTACHMENT_OWNER_TYPE;
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

export function buildProjectTaskAttachmentOwnerContext(
  taskId: string,
): ProjectTaskAttachmentOwnerContext {
  return {
    owner_type: PROJECT_TASK_ATTACHMENT_OWNER_TYPE,
    owner_id: taskId,
  };
}

export function isProjectAttachmentImmutable(
  status: string | null | undefined,
): boolean {
  return Boolean(status && IMMUTABLE_STATUSES.has(status));
}

export function isProjectTaskAttachmentImmutable(
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

export function canUploadProjectTaskAttachment(options: {
  hasAttachmentUpload: boolean;
  hasTaskUpdate: boolean;
  taskStatus: string | null | undefined;
}): boolean {
  if (!options.hasAttachmentUpload || !options.hasTaskUpdate) {
    return false;
  }
  return !isProjectTaskAttachmentImmutable(options.taskStatus);
}

export function getProjectAttachmentSectionGuidance(): string {
  return "Upload project plans, drawings, photos, and supporting documents. Files stay internal to the project record.";
}

export function getProjectTaskAttachmentSectionGuidance(): string {
  return "Upload task evidence, checklists, photos, and supporting documents. Files stay internal to this task and are separate from project-level attachments.";
}
