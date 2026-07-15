import type {
  MaintenanceWorkOrderStatus,
  MaintenanceWorkflowAction,
} from "@/types/maintenance";

export const MAINTENANCE_WORKFLOW_SUCCESS_MESSAGES = {
  submit: "Work order submitted successfully.",
  start: "Work order started successfully.",
  hold: "Work order placed on hold successfully.",
  resume: "Work order resumed successfully.",
  complete: "Work order completed successfully.",
  cancel: "Work order cancelled successfully.",
  reopen: "Work order reopened successfully.",
  assign: "Work order assigned successfully.",
  reassign: "Work order reassigned successfully.",
  unassign: "Work order unassigned successfully.",
} as const;

export type MaintenanceWorkflowSuccessKey =
  keyof typeof MAINTENANCE_WORKFLOW_SUCCESS_MESSAGES;

export function getMaintenanceWorkflowSuccessMessage(
  action: MaintenanceWorkflowSuccessKey,
): string {
  return MAINTENANCE_WORKFLOW_SUCCESS_MESSAGES[action];
}

const ACTIONS_BY_STATUS: Record<
  MaintenanceWorkOrderStatus,
  MaintenanceWorkflowAction[]
> = {
  draft: [
    {
      key: "submit",
      label: "Submit",
      description: "Move this draft work order into the active open queue.",
      to_status: "open",
      permission: "maintenance.submit",
      requiresDialog: true,
    },
  ],
  open: [
    {
      key: "cancel",
      label: "Cancel",
      description: "Cancel the work order with a required reason.",
      to_status: "cancelled",
      permission: "maintenance.cancel",
      requiresDialog: true,
    },
  ],
  assigned: [
    {
      key: "start",
      label: "Start",
      description: "Begin maintenance execution and move to in progress.",
      to_status: "in_progress",
      permission: "maintenance.start",
      requiresDialog: true,
    },
    {
      key: "cancel",
      label: "Cancel",
      description: "Cancel the assigned work order with a required reason.",
      to_status: "cancelled",
      permission: "maintenance.cancel",
      requiresDialog: true,
    },
  ],
  in_progress: [
    {
      key: "hold",
      label: "Hold",
      description: "Pause the work order and capture the hold reason.",
      to_status: "on_hold",
      permission: "maintenance.hold",
      requiresDialog: true,
    },
    {
      key: "complete",
      label: "Complete",
      description: "Complete the work order with completion details.",
      to_status: "completed",
      permission: "maintenance.complete",
      requiresDialog: true,
    },
    {
      key: "cancel",
      label: "Cancel",
      description: "Cancel the in-progress work order with a required reason.",
      to_status: "cancelled",
      permission: "maintenance.cancel",
      requiresDialog: true,
    },
  ],
  on_hold: [
    {
      key: "resume",
      label: "Resume",
      description: "Resume work from the on-hold state.",
      to_status: "in_progress",
      permission: "maintenance.resume",
      requiresDialog: true,
    },
  ],
  completed: [
    {
      key: "reopen",
      label: "Reopen",
      description: "Reopen the completed work order when the issue returns.",
      to_status: "reopened",
      permission: "maintenance.reopen",
      requiresDialog: true,
    },
  ],
  cancelled: [
    {
      key: "reopen",
      label: "Reopen",
      description: "Reopen the cancelled work order when cancellation was incorrect.",
      to_status: "reopened",
      permission: "maintenance.reopen",
      requiresDialog: true,
    },
  ],
  reopened: [],
  closed: [],
};

export function getMaintenanceWorkflowActions(status: MaintenanceWorkOrderStatus) {
  return ACTIONS_BY_STATUS[status] ?? [];
}
