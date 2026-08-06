import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProjectAttachmentOwnerContext,
  canUploadProjectAttachment,
  getProjectAttachmentSectionGuidance,
  isProjectAttachmentImmutable,
  PROJECT_ATTACHMENT_OWNER_TYPE,
} from "./attachments";

test("project owner context uses project type only", () => {
  const context = buildProjectAttachmentOwnerContext("proj-1");
  assert.equal(context.owner_type, PROJECT_ATTACHMENT_OWNER_TYPE);
  assert.equal(context.owner_type, "project");
  assert.equal(context.owner_id, "proj-1");
  assert.equal("tenant_id" in context, false);
  assert.equal("uploaded_by" in context, false);
});

test("project immutable statuses block uploads", () => {
  assert.equal(isProjectAttachmentImmutable("completed"), true);
  assert.equal(isProjectAttachmentImmutable("cancelled"), true);
  assert.equal(isProjectAttachmentImmutable("in_progress"), false);
  assert.equal(isProjectAttachmentImmutable("draft"), false);
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

test("project attachment guidance documents internal project scope", () => {
  const guidance = getProjectAttachmentSectionGuidance();
  assert.match(guidance, /internal/i);
  assert.match(guidance, /project/i);
  assert.doesNotMatch(guidance, /\/my-requests\//);
});
