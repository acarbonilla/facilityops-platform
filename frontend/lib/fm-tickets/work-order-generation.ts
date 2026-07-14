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

export function canGenerateWorkOrderFromTicket(
  ticket: Pick<
    FmTicketDetail,
    "status" | "assignee" | "asset" | "linked_work_order"
  >,
): boolean {
  if (ticket.linked_work_order) {
    return false;
  }
  if (!ticket.assignee) {
    return false;
  }
  if (!ticket.asset) {
    return false;
  }
  return WORK_ORDER_GENERATION_ELIGIBLE_STATUSES.includes(ticket.status);
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
