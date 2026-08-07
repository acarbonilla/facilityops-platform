import type { ProjectTaskStatus } from "@/types/projects";

/** FO-111: Paused maps to backend `on_hold`. */
export const TECHNICIAN_PAUSED_STATUS: ProjectTaskStatus = "on_hold";

export type TechnicianExecutionAction =
  | "start"
  | "pause"
  | "resume"
  | "complete"
  | "progress"
  | "report_blocker";

export function formatTechnicianTaskStatusLabel(
  status: ProjectTaskStatus | string,
): string {
  if (status === "on_hold") {
    return "Paused";
  }
  const labels: Record<string, string> = {
    not_started: "Not started",
    in_progress: "In progress",
    blocked: "Blocked",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return labels[status] || status.replaceAll("_", " ");
}

export function getAvailableTechnicianActions(
  status: ProjectTaskStatus | string,
  options: {
    isAssignedToCurrentUser: boolean;
    canUpdate: boolean;
    isDependencyReady: boolean;
  },
): TechnicianExecutionAction[] {
  const { isAssignedToCurrentUser, canUpdate, isDependencyReady } = options;
  if (!isAssignedToCurrentUser || !canUpdate) {
    return [];
  }
  if (status === "cancelled" || status === "completed") {
    return [];
  }

  const actions: TechnicianExecutionAction[] = ["progress", "report_blocker"];

  if (status === "not_started") {
    if (isDependencyReady) {
      actions.unshift("start");
    }
    return actions;
  }
  if (status === "in_progress") {
    actions.unshift("pause", "complete");
    return actions;
  }
  if (status === "on_hold" || status === "blocked") {
    if (isDependencyReady) {
      actions.unshift("resume");
    }
    actions.push("complete");
    return actions;
  }
  return actions;
}

export function canTechnicianEditFullTaskForm(input: {
  usesWorkspaceMode: boolean;
  hasPermission: (code: string) => boolean;
}): boolean {
  if (input.usesWorkspaceMode) {
    return false;
  }
  return (
    input.hasPermission("projects.tasks.update") ||
    input.hasPermission("projects.tasks.manage") ||
    input.hasPermission("projects.manage")
  );
}

export function canTechnicianExecuteAssignedTask(input: {
  usesWorkspaceMode: boolean;
  isAssignedToCurrentUser: boolean;
  hasPermission: (code: string) => boolean;
}): boolean {
  if (!input.isAssignedToCurrentUser) {
    return false;
  }
  if (
    !(
      input.hasPermission("projects.tasks.update") ||
      input.hasPermission("projects.tasks.manage") ||
      input.hasPermission("projects.manage")
    )
  ) {
    return false;
  }
  return input.usesWorkspaceMode || true;
}

export function clampTechnicianProgressInput(raw: string | number): number {
  const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function describeProgressRule(status: ProjectTaskStatus | string): string {
  if (status === "not_started") {
    return "Not started tasks stay at 0% until work begins.";
  }
  if (status === "completed") {
    return "Completed tasks are locked at 100%.";
  }
  if (status === "in_progress") {
    return "In progress: keep progress between 1% and 99%, or set 100% to complete.";
  }
  if (status === "on_hold") {
    return "Paused tasks keep their last progress until resumed or completed.";
  }
  return "Progress must stay between 0% and 100%.";
}
