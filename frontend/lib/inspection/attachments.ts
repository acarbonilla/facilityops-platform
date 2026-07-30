/** FO-082 5S Inspection attachment helpers. */

export const INSPECTION_ATTACHMENT_OWNER_TYPE = "inspection" as const;

export type InspectionAttachmentOwnerContext = {
  owner_type: typeof INSPECTION_ATTACHMENT_OWNER_TYPE;
  owner_id: string;
};

const IMMUTABLE_STATUSES = new Set(["completed", "verified", "cancelled"]);

export function buildInspectionAttachmentOwnerContext(
  inspectionId: string,
): InspectionAttachmentOwnerContext {
  return {
    owner_type: INSPECTION_ATTACHMENT_OWNER_TYPE,
    owner_id: inspectionId,
  };
}

export function isInspectionAttachmentImmutable(
  status: string | null | undefined,
): boolean {
  return Boolean(status && IMMUTABLE_STATUSES.has(status));
}

export function canUploadInspectionAttachment(options: {
  hasAttachmentUpload: boolean;
  hasInspectionUpdate: boolean;
  inspectionStatus: string | null | undefined;
}): boolean {
  if (!options.hasAttachmentUpload || !options.hasInspectionUpdate) {
    return false;
  }
  return !isInspectionAttachmentImmutable(options.inspectionStatus);
}

export function getInspectionAttachmentSectionGuidance(): string {
  return "Upload inspection evidence, non-conformance photos, and supporting PDFs. Files stay internal to the 5S module and do not transfer to generated FM Tickets.";
}
