import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInspectionAttachmentOwnerContext,
  canUploadInspectionAttachment,
  getInspectionAttachmentSectionGuidance,
  INSPECTION_ATTACHMENT_OWNER_TYPE,
  isInspectionAttachmentImmutable,
} from "./attachments";

test("inspection owner context uses inspection type only", () => {
  const context = buildInspectionAttachmentOwnerContext("insp-1");
  assert.equal(context.owner_type, INSPECTION_ATTACHMENT_OWNER_TYPE);
  assert.equal(context.owner_id, "insp-1");
  assert.equal("tenant_id" in context, false);
  assert.equal("uploaded_by" in context, false);
});

test("inspection immutable statuses block uploads", () => {
  assert.equal(isInspectionAttachmentImmutable("completed"), true);
  assert.equal(isInspectionAttachmentImmutable("verified"), true);
  assert.equal(isInspectionAttachmentImmutable("cancelled"), true);
  assert.equal(isInspectionAttachmentImmutable("in_progress"), false);
  assert.equal(isInspectionAttachmentImmutable("reopened"), false);
});

test("inspection upload requires update permission and mutable status", () => {
  assert.equal(
    canUploadInspectionAttachment({
      hasAttachmentUpload: true,
      hasInspectionUpdate: true,
      inspectionStatus: "in_progress",
    }),
    true,
  );
  assert.equal(
    canUploadInspectionAttachment({
      hasAttachmentUpload: true,
      hasInspectionUpdate: false,
      inspectionStatus: "in_progress",
    }),
    false,
  );
  assert.equal(
    canUploadInspectionAttachment({
      hasAttachmentUpload: true,
      hasInspectionUpdate: true,
      inspectionStatus: "verified",
    }),
    false,
  );
});

test("inspection guidance documents non-transfer to FM Tickets", () => {
  const guidance = getInspectionAttachmentSectionGuidance();
  assert.match(guidance, /internal/i);
  assert.match(guidance, /do not transfer/i);
  assert.doesNotMatch(guidance, /\/my-requests\//);
});
