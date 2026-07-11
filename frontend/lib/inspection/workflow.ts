import type {
  InspectionAssignPayload,
  InspectionStatus,
  InspectionWorkflowAction,
} from "@/types/inspection";
import { normalizeOptionalUserId } from "@/lib/users/directory";

const ACTIONS_BY_STATUS: Record<InspectionStatus, InspectionWorkflowAction[]> = {
  draft: [
    {
      key: "assign",
      label: "Assign",
      description:
        "Assign an inspector and/or supervisor and move the inspection into the scheduled queue.",
      to_status: "scheduled",
      permission: "inspection.assign",
      requiresDialog: true,
    },
    {
      key: "cancel",
      label: "Cancel",
      description: "Cancel this draft inspection with a required reason.",
      to_status: "cancelled",
      permission: "inspection.update",
      requiresDialog: true,
    },
  ],
  scheduled: [
    {
      key: "start",
      label: "Start",
      description: "Begin the inspection and move it into active execution.",
      to_status: "in_progress",
      permission: "inspection.update",
      requiresDialog: true,
    },
    {
      key: "cancel",
      label: "Cancel",
      description: "Cancel this scheduled inspection with a required reason.",
      to_status: "cancelled",
      permission: "inspection.update",
      requiresDialog: true,
    },
  ],
  in_progress: [
    {
      key: "complete",
      label: "Complete",
      description:
        "Complete the inspection after all checklist items are scored and marked pass/fail.",
      to_status: "completed",
      permission: "inspection.complete",
      requiresDialog: true,
    },
    {
      key: "cancel",
      label: "Cancel",
      description: "Cancel this inspection with a required reason.",
      to_status: "cancelled",
      permission: "inspection.update",
      requiresDialog: true,
    },
  ],
  completed: [
    {
      key: "verify",
      label: "Verify",
      description:
        "Verify the completed inspection after backend corrective-action rules are satisfied.",
      to_status: "verified",
      permission: "inspection.verify",
      requiresDialog: true,
    },
    {
      key: "reopen",
      label: "Reopen",
      description: "Reopen this completed inspection and start a new workflow cycle.",
      to_status: "reopened",
      permission: "inspection.update",
      requiresDialog: true,
    },
  ],
  verified: [
    {
      key: "reopen",
      label: "Reopen",
      description: "Reopen this verified inspection when follow-up inspection work is needed.",
      to_status: "reopened",
      permission: "inspection.update",
      requiresDialog: true,
    },
  ],
  cancelled: [
    {
      key: "reopen",
      label: "Reopen",
      description: "Reopen this cancelled inspection when cancellation was incorrect.",
      to_status: "reopened",
      permission: "inspection.update",
      requiresDialog: true,
    },
  ],
  reopened: [
    {
      key: "assign",
      label: "Assign",
      description:
        "Update the inspector and/or supervisor while keeping the inspection in the reopened cycle.",
      to_status: "reopened",
      permission: "inspection.assign",
      requiresDialog: true,
    },
    {
      key: "start",
      label: "Start",
      description: "Restart work on this reopened inspection.",
      to_status: "in_progress",
      permission: "inspection.update",
      requiresDialog: true,
    },
    {
      key: "cancel",
      label: "Cancel",
      description: "Cancel this reopened inspection with a required reason.",
      to_status: "cancelled",
      permission: "inspection.update",
      requiresDialog: true,
    },
  ],
};

export function getInspectionWorkflowActions(status: InspectionStatus) {
  return ACTIONS_BY_STATUS[status] ?? [];
}

export function buildInspectionAssignPayload(
  inspector?: string | null,
  supervisor?: string | null,
  note?: string,
): InspectionAssignPayload | null {
  const normalizedInspector = normalizeOptionalUserId(inspector);
  const normalizedSupervisor = normalizeOptionalUserId(supervisor);

  if (!normalizedInspector && !normalizedSupervisor) {
    return null;
  }

  return {
    inspector: normalizedInspector,
    supervisor: normalizedSupervisor,
    note: note?.trim() || undefined,
  };
}
