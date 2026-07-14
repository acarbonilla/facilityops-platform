import type {
  FmTicketDetail,
  FmTicketStatus,
  LinkedMaintenanceWorkOrderSummary,
} from "@/types/fm-tickets";

export const WORK_ORDER_GENERATION_ELIGIBLE_STATUSES: FmTicketStatus[] = [
  "assigned",
  "in_progress",
];

export const WORK_ORDER_GENERATION_EXPLANATION =
  "Creating an FM Ticket does not automatically create a Work Order. A coordinator generates one when maintenance execution is required.";

export const WORK_ORDER_GENERATION_CONFIRMATION =
  "Generate a maintenance work order from this ticket? This action creates one linked work order and cannot be undone from this screen.";

export type WorkOrderGenerationDisabledReason =
  | "missing_assignee"
  | "missing_asset"
  | "invalid_status"
  | "already_linked"
  | "missing_permission";

export function getWorkOrderGenerationDisabledReason(
  ticket: Pick<
    FmTicketDetail,
    "status" | "assignee" | "asset" | "linked_work_order"
  >,
  canManageGeneration = true,
): WorkOrderGenerationDisabledReason | null {
  if (!canManageGeneration) {
    return "missing_permission";
  }
  if (ticket.linked_work_order) {
    return "already_linked";
  }
  if (!ticket.assignee) {
    return "missing_assignee";
  }
  if (!ticket.asset) {
    return "missing_asset";
  }
  if (!WORK_ORDER_GENERATION_ELIGIBLE_STATUSES.includes(ticket.status)) {
    return "invalid_status";
  }
  return null;
}

export function formatWorkOrderGenerationDisabledReason(
  reason: WorkOrderGenerationDisabledReason | null,
): string | null {
  switch (reason) {
    case "missing_assignee":
      return "Assign a technician first.";
    case "missing_asset":
      return "Add an asset first.";
    case "invalid_status":
      return "Ticket must be Assigned or In Progress.";
    case "already_linked":
      return "A Work Order is already linked.";
    case "missing_permission":
      return "You do not have permission to generate a Work Order.";
    default:
      return null;
  }
}

export function canGenerateWorkOrderFromTicket(
  ticket: Pick<
    FmTicketDetail,
    "status" | "assignee" | "asset" | "linked_work_order"
  >,
  canManageGeneration = true,
): boolean {
  return getWorkOrderGenerationDisabledReason(ticket, canManageGeneration) === null;
}

export function getGenerateWorkOrderActionLabel(
  ticket: Pick<FmTicketDetail, "linked_work_order">,
): string {
  if (ticket.linked_work_order) {
    return "Work order linked";
  }
  return "Generate Work Order";
}

export function formatGenerateWorkOrderSuccess(
  workOrder: LinkedMaintenanceWorkOrderSummary,
): string {
  return `Work order ${workOrder.work_order_number} created successfully.`;
}

export function formatGenerateWorkOrderError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Unable to generate a work order from this ticket right now.";
}

export function buildMaintenanceWorkOrderDetailPath(workOrderId: string): string {
  return `/maintenance/work-orders/${workOrderId}`;
}

export function buildFmTicketDetailPath(ticketId: string): string {
  return `/fm-tickets/${ticketId}`;
}
