import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFmTicketAttachmentOwnerContext,
  canDeleteFmTicketAttachmentControl,
  canUploadFmTicketAttachment,
  FM_TICKET_ATTACHMENT_OWNER_TYPE,
  getFmTicketAttachmentSectionGuidance,
  isFmTicketAttachmentImmutable,
  resolveFmTicketUploadVisibility,
} from "./attachments";

test("owner context uses fm_ticket type and ticket id only", () => {
  const context = buildFmTicketAttachmentOwnerContext(
    "11111111-1111-1111-1111-111111111111",
  );
  assert.equal(context.owner_type, FM_TICKET_ATTACHMENT_OWNER_TYPE);
  assert.equal(context.owner_id, "11111111-1111-1111-1111-111111111111");
  assert.equal("tenant_id" in context, false);
  assert.equal("uploaded_by" in context, false);
});

test("immutable statuses block uploads", () => {
  assert.equal(isFmTicketAttachmentImmutable("closed"), true);
  assert.equal(isFmTicketAttachmentImmutable("cancelled"), true);
  assert.equal(isFmTicketAttachmentImmutable("open"), false);
  assert.equal(isFmTicketAttachmentImmutable("resolved"), false);
});

test("internal upload requires attachment upload and ticket update", () => {
  assert.equal(
    canUploadFmTicketAttachment({
      audience: "internal",
      hasAttachmentUpload: true,
      hasTicketUpdate: true,
      ticketStatus: "open",
    }),
    true,
  );
  assert.equal(
    canUploadFmTicketAttachment({
      audience: "internal",
      hasAttachmentUpload: true,
      hasTicketUpdate: false,
      ticketStatus: "open",
    }),
    false,
  );
  assert.equal(
    canUploadFmTicketAttachment({
      audience: "internal",
      hasAttachmentUpload: false,
      hasTicketUpdate: true,
      ticketStatus: "open",
    }),
    false,
  );
});

test("requester upload allowed on mutable ticket with upload permission", () => {
  assert.equal(
    canUploadFmTicketAttachment({
      audience: "requester",
      hasAttachmentUpload: true,
      hasTicketUpdate: false,
      ticketStatus: "open",
    }),
    true,
  );
  assert.equal(
    canUploadFmTicketAttachment({
      audience: "requester",
      hasAttachmentUpload: true,
      hasTicketUpdate: false,
      ticketStatus: "closed",
    }),
    false,
  );
});

test("visibility defaults conservatively for internal and forces requester_visible", () => {
  assert.equal(resolveFmTicketUploadVisibility("internal"), "internal_only");
  assert.equal(
    resolveFmTicketUploadVisibility("internal", "requester_visible"),
    "requester_visible",
  );
  assert.equal(
    resolveFmTicketUploadVisibility("requester", "internal_only"),
    "requester_visible",
  );
});

test("delete control respects audience capability and immutability", () => {
  assert.equal(
    canDeleteFmTicketAttachmentControl({
      audience: "internal",
      hasAttachmentDelete: true,
      hasTicketUpdate: true,
      ticketStatus: "open",
      attachmentCanDelete: true,
    }),
    true,
  );
  assert.equal(
    canDeleteFmTicketAttachmentControl({
      audience: "requester",
      hasAttachmentDelete: true,
      hasTicketUpdate: false,
      ticketStatus: "open",
      attachmentCanDelete: false,
    }),
    false,
  );
  assert.equal(
    canDeleteFmTicketAttachmentControl({
      audience: "requester",
      hasAttachmentDelete: true,
      hasTicketUpdate: false,
      ticketStatus: "open",
      attachmentCanDelete: true,
    }),
    true,
  );
  assert.equal(
    canDeleteFmTicketAttachmentControl({
      audience: "internal",
      hasAttachmentDelete: true,
      hasTicketUpdate: true,
      ticketStatus: "cancelled",
      attachmentCanDelete: true,
    }),
    false,
  );
});

test("guidance text differs for requester and internal audiences", () => {
  const requester = getFmTicketAttachmentSectionGuidance("requester");
  const internal = getFmTicketAttachmentSectionGuidance("internal");
  assert.match(requester, /requester-visible|shared with you/i);
  assert.match(internal, /operational|requester-visible/i);
  assert.doesNotMatch(requester, /\/fm-tickets\//);
  assert.doesNotMatch(requester, /storage/i);
});

test("list params never invent tenant or uploader ids", () => {
  const context = buildFmTicketAttachmentOwnerContext("ticket-1");
  const listParams = {
    ...context,
    page_size: 50,
  };
  assert.deepEqual(Object.keys(listParams).sort(), [
    "owner_id",
    "owner_type",
    "page_size",
  ]);
});
