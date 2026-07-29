import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMaintenanceAttachmentOwnerContext,
  canUploadMaintenanceAttachment,
  getMaintenanceAttachmentSectionGuidance,
  isMaintenanceAttachmentImmutable,
  MAINTENANCE_ATTACHMENT_OWNER_TYPE,
} from "./attachments";

test("maintenance owner context uses maintenance_work_order only", () => {
  const context = buildMaintenanceAttachmentOwnerContext("wo-1");
  assert.equal(context.owner_type, MAINTENANCE_ATTACHMENT_OWNER_TYPE);
  assert.equal(context.owner_id, "wo-1");
  assert.equal("tenant_id" in context, false);
  assert.equal("uploaded_by" in context, false);
});

test("maintenance immutable statuses block uploads", () => {
  assert.equal(isMaintenanceAttachmentImmutable("completed"), true);
  assert.equal(isMaintenanceAttachmentImmutable("cancelled"), true);
  assert.equal(isMaintenanceAttachmentImmutable("closed"), true);
  assert.equal(isMaintenanceAttachmentImmutable("in_progress"), false);
  assert.equal(isMaintenanceAttachmentImmutable("reopened"), false);
});

test("maintenance upload requires update permission and mutable status", () => {
  assert.equal(
    canUploadMaintenanceAttachment({
      hasAttachmentUpload: true,
      hasWorkOrderUpdate: true,
      workOrderStatus: "in_progress",
    }),
    true,
  );
  assert.equal(
    canUploadMaintenanceAttachment({
      hasAttachmentUpload: true,
      hasWorkOrderUpdate: false,
      workOrderStatus: "in_progress",
    }),
    false,
  );
  assert.equal(
    canUploadMaintenanceAttachment({
      hasAttachmentUpload: true,
      hasWorkOrderUpdate: true,
      workOrderStatus: "completed",
    }),
    false,
  );
});

test("maintenance guidance keeps requester isolation messaging", () => {
  const guidance = getMaintenanceAttachmentSectionGuidance();
  assert.match(guidance, /internal-only/i);
  assert.match(guidance, /Employee Requesters/i);
  assert.doesNotMatch(guidance, /\/my-requests\//);
});
