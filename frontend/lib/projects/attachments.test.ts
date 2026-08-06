import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProjectAttachmentOwnerContext,
  buildProjectTaskAttachmentOwnerContext,
  canUploadProjectAttachment,
  canUploadProjectTaskAttachment,
  getProjectAttachmentSectionGuidance,
  getProjectTaskAttachmentSectionGuidance,
  isProjectAttachmentImmutable,
  isProjectTaskAttachmentImmutable,
  PROJECT_ATTACHMENT_OWNER_TYPE,
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
