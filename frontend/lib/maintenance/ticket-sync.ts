import type { MaintenanceWorkOrderDetail } from "@/types/maintenance";

export const LINKED_WORK_ORDER_STATUS_SYNC_MESSAGE =
  "Updates to this linked Work Order may update the source FM Ticket’s execution status.";

export function getSourceTicketInvalidationId(
  sourceTicket?: { id?: string | null } | null,
): string | null {
  if (!sourceTicket?.id) {
    return null;
  }
  const trimmed = sourceTicket.id.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getLinkedTicketInvalidationTarget(
  workOrder: Pick<MaintenanceWorkOrderDetail, "source_ticket"> | null | undefined,
): string | null {
  return getSourceTicketInvalidationId(workOrder?.source_ticket ?? null);
}

export function shouldInvalidateLinkedTicket(sourceTicketId?: string | null): boolean {
  return Boolean(sourceTicketId && sourceTicketId.trim());
}

export function getLinkedWorkOrderSyncMessage(
  sourceTicket?: { id?: string | null } | null,
): string | null {
  return getSourceTicketInvalidationId(sourceTicket) == null
    ? null
    : LINKED_WORK_ORDER_STATUS_SYNC_MESSAGE;
}
