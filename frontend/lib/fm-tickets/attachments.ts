/** FO-081 FM Ticket attachment owner context and capability helpers. */

import type { AttachmentVisibility } from "@/types/attachments";

export const FM_TICKET_ATTACHMENT_OWNER_TYPE = "fm_ticket" as const;

export type FmTicketAttachmentAudience = "internal" | "requester";

export type FmTicketAttachmentOwnerContext = {
  owner_type: typeof FM_TICKET_ATTACHMENT_OWNER_TYPE;
  owner_id: string;
};

const IMMUTABLE_STATUSES = new Set(["closed", "cancelled"]);

export function buildFmTicketAttachmentOwnerContext(
  ticketId: string,
): FmTicketAttachmentOwnerContext {
  return {
    owner_type: FM_TICKET_ATTACHMENT_OWNER_TYPE,
    owner_id: ticketId,
  };
}

export function isFmTicketAttachmentImmutable(
  status: string | null | undefined,
): boolean {
  return Boolean(status && IMMUTABLE_STATUSES.has(status));
}

export function resolveFmTicketUploadVisibility(
  audience: FmTicketAttachmentAudience,
  requested?: AttachmentVisibility | null,
): AttachmentVisibility {
  if (audience === "requester") {
    return "requester_visible";
  }
  if (requested === "requester_visible" || requested === "internal_only") {
    return requested;
  }
  return "internal_only";
}

export function canUploadFmTicketAttachment(options: {
  audience: FmTicketAttachmentAudience;
  hasAttachmentUpload: boolean;
  hasTicketUpdate: boolean;
  ticketStatus: string | null | undefined;
}): boolean {
  if (!options.hasAttachmentUpload) {
    return false;
  }
  if (isFmTicketAttachmentImmutable(options.ticketStatus)) {
    return false;
  }
  if (options.audience === "internal") {
    return options.hasTicketUpdate;
  }
  return true;
}

export function canDeleteFmTicketAttachmentControl(options: {
  audience: FmTicketAttachmentAudience;
  hasAttachmentDelete: boolean;
  hasTicketUpdate: boolean;
  ticketStatus: string | null | undefined;
  attachmentCanDelete?: boolean | null;
}): boolean {
  if (!options.hasAttachmentDelete) {
    return false;
  }
  if (isFmTicketAttachmentImmutable(options.ticketStatus)) {
    return false;
  }
  if (options.audience === "internal" && !options.hasTicketUpdate) {
    return false;
  }
  if (typeof options.attachmentCanDelete === "boolean") {
    return options.attachmentCanDelete;
  }
  // Without per-item capability, requesters keep delete hidden by default.
  return options.audience === "internal";
}

export function getFmTicketAttachmentSectionGuidance(
  audience: FmTicketAttachmentAudience,
): string {
  if (audience === "requester") {
    return "Upload photos or PDFs that help describe your request. Only files shared with you are listed here.";
  }
  return "Upload operational evidence for this FM ticket. Mark files requester-visible only when the requester should see them.";
}
