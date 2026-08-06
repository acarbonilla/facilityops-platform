import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProjectAttachmentOwnerContext,
  buildProjectIssueAttachmentOwnerContext,
  buildProjectNoteAttachmentOwnerContext,
  buildProjectTaskAttachmentOwnerContext,
  canUploadProjectAttachment,
  canUploadProjectIssueAttachment,
  canUploadProjectNoteAttachment,
  canUploadProjectTaskAttachment,
  getProjectAttachmentSectionGuidance,
  getProjectIssueAttachmentSectionGuidance,
  getProjectNoteAttachmentSectionGuidance,
  getProjectTaskAttachmentSectionGuidance,
  isProjectAttachmentImmutable,
  isProjectIssueAttachmentImmutable,
  isProjectNoteAttachmentImmutable,
  isProjectTaskAttachmentImmutable,
  PROJECT_ATTACHMENT_OWNER_TYPE,
  PROJECT_ISSUE_ATTACHMENT_OWNER_TYPE,
  PROJECT_NOTE_ATTACHMENT_OWNER_TYPE,
  PROJECT_TASK_ATTACHMENT_OWNER_TYPE,
} from "./attachments";

test("project owner context uses project type only", () => {
  const context = buildProjectAttachmentOwnerContext("proj-1");
  assert.equal(context.owner_type, PROJECT_ATTACHMENT_OWNER_TYPE);
  assert.equal(context.owner_type, "project");
  assert.equal(context.owner_id, "proj-1");
  assert.equal("tenant_id" in context, false);
  assert.equal("uploaded_by" in context, false);
});

test("project task owner context uses project_task type", () => {
  const context = buildProjectTaskAttachmentOwnerContext("task-1");
  assert.equal(context.owner_type, PROJECT_TASK_ATTACHMENT_OWNER_TYPE);
  assert.equal(context.owner_type, "project_task");
  assert.equal(context.owner_id, "task-1");
  assert.notEqual(context.owner_type, PROJECT_ATTACHMENT_OWNER_TYPE);
});

test("project immutable statuses block uploads", () => {
  assert.equal(isProjectAttachmentImmutable("completed"), true);
  assert.equal(isProjectAttachmentImmutable("cancelled"), true);
  assert.equal(isProjectAttachmentImmutable("in_progress"), false);
  assert.equal(isProjectAttachmentImmutable("draft"), false);
});

test("project task immutable statuses block uploads", () => {
  assert.equal(isProjectTaskAttachmentImmutable("completed"), true);
  assert.equal(isProjectTaskAttachmentImmutable("cancelled"), true);
  assert.equal(isProjectTaskAttachmentImmutable("in_progress"), false);
  assert.equal(isProjectTaskAttachmentImmutable("blocked"), false);
});

test("project upload requires update permission and mutable status", () => {
  assert.equal(
    canUploadProjectAttachment({
      hasAttachmentUpload: true,
      hasProjectUpdate: true,
      projectStatus: "in_progress",
    }),
    true,
  );
  assert.equal(
    canUploadProjectAttachment({
      hasAttachmentUpload: true,
      hasProjectUpdate: false,
      projectStatus: "in_progress",
    }),
    false,
  );
  assert.equal(
    canUploadProjectAttachment({
      hasAttachmentUpload: true,
      hasProjectUpdate: true,
      projectStatus: "completed",
    }),
    false,
  );
});

test("project task upload requires task update permission and mutable status", () => {
  assert.equal(
    canUploadProjectTaskAttachment({
      hasAttachmentUpload: true,
      hasTaskUpdate: true,
      taskStatus: "in_progress",
    }),
    true,
  );
  assert.equal(
    canUploadProjectTaskAttachment({
      hasAttachmentUpload: true,
      hasTaskUpdate: false,
      taskStatus: "in_progress",
    }),
    false,
  );
  assert.equal(
    canUploadProjectTaskAttachment({
      hasAttachmentUpload: true,
      hasTaskUpdate: true,
      taskStatus: "cancelled",
    }),
    false,
  );
});

test("project attachment guidance documents internal project scope", () => {
  const guidance = getProjectAttachmentSectionGuidance();
  assert.match(guidance, /internal/i);
  assert.match(guidance, /project/i);
  assert.doesNotMatch(guidance, /\/my-requests\//);
});

test("project task attachment guidance distinguishes task scope", () => {
  const guidance = getProjectTaskAttachmentSectionGuidance();
  assert.match(guidance, /task/i);
  assert.match(guidance, /separate/i);
  assert.match(guidance, /project-level/i);
});

test("project note owner context uses project_note type", () => {
  const context = buildProjectNoteAttachmentOwnerContext("note-1");
  assert.equal(context.owner_type, PROJECT_NOTE_ATTACHMENT_OWNER_TYPE);
  assert.equal(context.owner_type, "project_note");
  assert.equal(context.owner_id, "note-1");
});

test("project issue owner context uses project_issue type", () => {
  const context = buildProjectIssueAttachmentOwnerContext("issue-1");
  assert.equal(context.owner_type, PROJECT_ISSUE_ATTACHMENT_OWNER_TYPE);
  assert.equal(context.owner_type, "project_issue");
  assert.equal(context.owner_id, "issue-1");
});

test("project note attachments are never status-immutable", () => {
  assert.equal(isProjectNoteAttachmentImmutable(), false);
});

test("project issue immutable statuses block uploads", () => {
  assert.equal(isProjectIssueAttachmentImmutable("resolved"), true);
  assert.equal(isProjectIssueAttachmentImmutable("closed"), true);
  assert.equal(isProjectIssueAttachmentImmutable("cancelled"), true);
  assert.equal(isProjectIssueAttachmentImmutable("open"), false);
  assert.equal(isProjectIssueAttachmentImmutable("investigating"), false);
});

test("project note upload requires note manage permission", () => {
  assert.equal(
    canUploadProjectNoteAttachment({
      hasAttachmentUpload: true,
      hasNoteManage: true,
    }),
    true,
  );
  assert.equal(
    canUploadProjectNoteAttachment({
      hasAttachmentUpload: true,
      hasNoteManage: false,
    }),
    false,
  );
});

test("project issue upload requires issue manage and mutable status", () => {
  assert.equal(
    canUploadProjectIssueAttachment({
      hasAttachmentUpload: true,
      hasIssueManage: true,
      issueStatus: "open",
    }),
    true,
  );
  assert.equal(
    canUploadProjectIssueAttachment({
      hasAttachmentUpload: true,
      hasIssueManage: false,
      issueStatus: "open",
    }),
    false,
  );
  assert.equal(
    canUploadProjectIssueAttachment({
      hasAttachmentUpload: true,
      hasIssueManage: true,
      issueStatus: "resolved",
    }),
    false,
  );
});

test("project note and issue attachment guidance documents scope", () => {
  assert.match(getProjectNoteAttachmentSectionGuidance(), /note/i);
  assert.match(getProjectIssueAttachmentSectionGuidance(), /issue/i);
  assert.match(getProjectIssueAttachmentSectionGuidance(), /resolved/i);
});
