/** FO-103/FO-104/FO-106 Project Management attachment helpers. */

export const PROJECT_ATTACHMENT_OWNER_TYPE = "project" as const;
export const PROJECT_TASK_ATTACHMENT_OWNER_TYPE = "project_task" as const;
export const PROJECT_NOTE_ATTACHMENT_OWNER_TYPE = "project_note" as const;
export const PROJECT_ISSUE_ATTACHMENT_OWNER_TYPE = "project_issue" as const;

export type ProjectAttachmentOwnerContext = {
  owner_type: typeof PROJECT_ATTACHMENT_OWNER_TYPE;
  owner_id: string;
};

export type ProjectTaskAttachmentOwnerContext = {
  owner_type: typeof PROJECT_TASK_ATTACHMENT_OWNER_TYPE;
  owner_id: string;
};

export type ProjectNoteAttachmentOwnerContext = {
  owner_type: typeof PROJECT_NOTE_ATTACHMENT_OWNER_TYPE;
  owner_id: string;
};

export type ProjectIssueAttachmentOwnerContext = {
  owner_type: typeof PROJECT_ISSUE_ATTACHMENT_OWNER_TYPE;
  owner_id: string;
};

const IMMUTABLE_STATUSES = new Set(["completed", "cancelled"]);
const ISSUE_IMMUTABLE_STATUSES = new Set(["resolved", "closed", "cancelled"]);

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

export function buildProjectNoteAttachmentOwnerContext(
  noteId: string,
): ProjectNoteAttachmentOwnerContext {
  return {
    owner_type: PROJECT_NOTE_ATTACHMENT_OWNER_TYPE,
    owner_id: noteId,
  };
}

export function buildProjectIssueAttachmentOwnerContext(
  issueId: string,
): ProjectIssueAttachmentOwnerContext {
  return {
    owner_type: PROJECT_ISSUE_ATTACHMENT_OWNER_TYPE,
    owner_id: issueId,
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

export function isProjectNoteAttachmentImmutable(): boolean {
  return false;
}

export function isProjectIssueAttachmentImmutable(
  status: string | null | undefined,
): boolean {
  return Boolean(status && ISSUE_IMMUTABLE_STATUSES.has(status));
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

export function canUploadProjectNoteAttachment(options: {
  hasAttachmentUpload: boolean;
  hasNoteManage: boolean;
}): boolean {
  if (!options.hasAttachmentUpload || !options.hasNoteManage) {
    return false;
  }
  return !isProjectNoteAttachmentImmutable();
}

export function canUploadProjectIssueAttachment(options: {
  hasAttachmentUpload: boolean;
  hasIssueManage: boolean;
  issueStatus: string | null | undefined;
}): boolean {
  if (!options.hasAttachmentUpload || !options.hasIssueManage) {
    return false;
  }
  return !isProjectIssueAttachmentImmutable(options.issueStatus);
}

export function getProjectAttachmentSectionGuidance(): string {
  return "Upload project plans, drawings, photos, and supporting documents. Files stay internal to the project record.";
}

export function getProjectTaskAttachmentSectionGuidance(): string {
  return "Upload task evidence, checklists, photos, and supporting documents. Files stay internal to this task and are separate from project-level attachments.";
}

export function getProjectNoteAttachmentSectionGuidance(): string {
  return "Upload supporting files for this note. Files stay internal to the note and are separate from project-level attachments.";
}

export function getProjectIssueAttachmentSectionGuidance(): string {
  return "Upload evidence and supporting documents for this issue. Files stay internal to the issue and are unavailable after the issue is resolved, closed, or cancelled.";
}
