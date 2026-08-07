/** FO-112 Technician My Work dashboard helpers. */

import type {
  MyWorkAssignedTask,
  MyWorkDashboard,
  MyWorkSummary,
  ProjectTaskStatus,
} from "@/types/projects";

import {
  formatTechnicianTaskStatusLabel,
  getAvailableTechnicianActions,
  type TechnicianExecutionAction,
} from "./execution";
import { usesProjectWorkspaceMode } from "./workspace";

export const MY_WORK_ROUTE = "/my-work";
export const MY_WORK_TASKS_ROUTE = "/my-work/tasks";

export function canAccessMyWorkNav(input: {
  roles?: readonly string[] | null;
  hasPermission: (code: string) => boolean;
}): boolean {
  if (
    !(
      input.hasPermission("projects.view") ||
      input.hasPermission("projects.manage") ||
      input.hasPermission("projects.tasks.view")
    )
  ) {
    return false;
  }
  // Primary audience: Technician workspace users.
  return usesProjectWorkspaceMode(input);
}

export function summarizeMyWorkCards(summary: MyWorkSummary | null | undefined) {
  const s = summary ?? {
    my_projects: 0,
    my_assigned_tasks: 0,
    in_progress: 0,
    overdue: 0,
    due_today: 0,
    due_this_week: 0,
    blocked_or_paused: 0,
    status_blocked: 0,
    paused: 0,
    dependency_blocked: 0,
    completed_recently: 0,
    unscheduled: 0,
    upcoming: 0,
  };
  return [
    { id: "projects", label: "My Projects", value: s.my_projects },
    { id: "assigned", label: "My Assigned Tasks", value: s.my_assigned_tasks },
    { id: "in_progress", label: "In Progress", value: s.in_progress },
    { id: "overdue", label: "Overdue", value: s.overdue },
    { id: "due_today", label: "Due Today", value: s.due_today },
    { id: "due_week", label: "Due This Week", value: s.due_this_week },
    { id: "blocked", label: "Blocked / Paused", value: s.blocked_or_paused },
    {
      id: "completed",
      label: "Completed Recently",
      value: s.completed_recently,
    },
  ];
}

export function formatBlockReasonLabel(reason: string | null | undefined): string {
  if (reason === "status_blocked") {
    return "Blocked by status";
  }
  if (reason === "waiting_predecessor") {
    return "Waiting for predecessor";
  }
  if (reason === "paused") {
    return "Paused";
  }
  return "Clear";
}

export function formatMyWorkProgress(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  if (!Number.isFinite(n)) {
    return "0%";
  }
  return `${Math.round(n)}%`;
}

export function formatDelayDaysLabel(days: number | null | undefined): string {
  const n = days ?? 0;
  if (n <= 0) {
    return "On schedule";
  }
  if (n === 1) {
    return "1 day overdue";
  }
  return `${n} days overdue`;
}

export function getMyWorkQuickActions(
  task: Pick<
    MyWorkAssignedTask,
    "status" | "is_dependency_ready"
  >,
  options: {
    isAssignedToCurrentUser: boolean;
    canUpdate: boolean;
  },
): TechnicianExecutionAction[] {
  return getAvailableTechnicianActions(task.status as ProjectTaskStatus, {
    isAssignedToCurrentUser: options.isAssignedToCurrentUser,
    canUpdate: options.canUpdate,
    isDependencyReady: task.is_dependency_ready,
  }).filter((action) =>
    action === "start" || action === "pause" || action === "resume",
  );
}

export function emptyMyWorkMessage(
  section:
    | "projects"
    | "today"
    | "overdue"
    | "upcoming"
    | "assigned"
    | "unscheduled"
    | "completed"
    | "blocked",
): { title: string; message: string } {
  switch (section) {
    case "projects":
      return {
        title: "No assigned Project work",
        message: "You don't have any assigned Project work yet.",
      };
    case "today":
      return {
        title: "Nothing scheduled today",
        message: "No Project tasks are scheduled for today.",
      };
    case "overdue":
      return {
        title: "No overdue tasks",
        message: "You're up to date. No overdue Project tasks.",
      };
    case "upcoming":
      return {
        title: "No upcoming tasks",
        message: "No upcoming assigned tasks.",
      };
    case "unscheduled":
      return {
        title: "No unscheduled work",
        message: "All assigned tasks have planned dates.",
      };
    case "completed":
      return {
        title: "No recent completions",
        message: "No assigned tasks were completed in the last 14 days.",
      };
    case "blocked":
      return {
        title: "No blocked or paused work",
        message: "No assigned tasks are blocked or paused.",
      };
    default:
      return {
        title: "No assigned tasks",
        message: "You don't have any assigned Project tasks yet.",
      };
  }
}

export function isMyWorkDashboard(payload: unknown): payload is MyWorkDashboard {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "summary" in payload &&
      "assigned_tasks" in payload,
  );
}

export { formatTechnicianTaskStatusLabel };
