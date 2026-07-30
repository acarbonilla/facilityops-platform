/** FO-082 Maintenance Work Order attachment helpers. */

export const MAINTENANCE_ATTACHMENT_OWNER_TYPE = "maintenance_work_order" as const;

export type MaintenanceAttachmentOwnerContext = {
  owner_type: typeof MAINTENANCE_ATTACHMENT_OWNER_TYPE;
  owner_id: string;
};

const IMMUTABLE_STATUSES = new Set(["completed", "cancelled", "closed"]);

export function buildMaintenanceAttachmentOwnerContext(
  workOrderId: string,
): MaintenanceAttachmentOwnerContext {
  return {
    owner_type: MAINTENANCE_ATTACHMENT_OWNER_TYPE,
    owner_id: workOrderId,
  };
}

export function isMaintenanceAttachmentImmutable(
  status: string | null | undefined,
): boolean {
  return Boolean(status && IMMUTABLE_STATUSES.has(status));
}

export function canUploadMaintenanceAttachment(options: {
  hasAttachmentUpload: boolean;
  hasWorkOrderUpdate: boolean;
  workOrderStatus: string | null | undefined;
}): boolean {
  if (!options.hasAttachmentUpload || !options.hasWorkOrderUpdate) {
    return false;
  }
  return !isMaintenanceAttachmentImmutable(options.workOrderStatus);
}

export function getMaintenanceAttachmentSectionGuidance(): string {
  return "Upload repair evidence, equipment photos, and service documents for this work order. Files are internal-only and are not visible to Employee Requesters.";
}
