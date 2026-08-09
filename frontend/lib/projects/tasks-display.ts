import { ApiError } from "@/services/api/types";
import type {
  ProjectTaskPriority,
  ProjectTaskStatus,
  ProjectTaskSummary,
} from "@/types/projects";

import {
  formatProjectCompletion,
  formatProjectDate,
  formatProjectLabel,
} from "./display";

/** Desktop/mobile Task list column header (FO-117). */
export const PROJECT_TASK_LIST_SCHEDULE_COLUMN_HEADER = "Planned schedule";

/**
 * Compact calendar day for Task Planned Schedule cells.
 * Prefer short month + day (Aug 9) over raw ISO strings.
 */
function formatScheduleDayLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(parsed);
    }
  }

  const formatted = formatProjectDate(value, "");
  return formatted || value.trim();
}

export const PROJECT_TASK_STATUS_LABELS: Record<ProjectTaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  blocked: "Blocked",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PROJECT_TASK_PRIORITY_LABELS: Record<
  ProjectTaskPriority,
  string
> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function formatProjectTaskStatusLabel(
  status: ProjectTaskStatus,
): string {
  return PROJECT_TASK_STATUS_LABELS[status] ?? formatProjectLabel(status);
}

export function formatProjectTaskPriorityLabel(
  priority: ProjectTaskPriority,
): string {
  return PROJECT_TASK_PRIORITY_LABELS[priority] ?? formatProjectLabel(priority);
}

export function formatProjectTaskProgress(
  value?: string | number | null,
): string {
  return formatProjectCompletion(value);
}

/**
 * FO-114 / FO-117: concise planned-schedule label for list/detail/Gantt surfaces.
 *
 * - Unscheduled when both dates are empty
 * - Same-day non-milestone → single day (not "Aug 9 – Aug 9")
 * - Multi-day → "Aug 9 – Aug 10"
 * - Explicit milestone → "Milestone · Aug 14"
 * - Partial legacy data → "Incomplete schedule" (no silent normalization)
 */
export function formatTaskPlannedScheduleLabel(input: {
  planned_start?: string | null;
  planned_end?: string | null;
  is_milestone?: boolean;
}): string {
  const start = input.planned_start?.trim() || "";
  const end = input.planned_end?.trim() || "";
  if (!start && !end) {
    return "Unscheduled";
  }
  if (Boolean(start) !== Boolean(end)) {
    return "Incomplete schedule";
  }
  if (input.is_milestone) {
    return `Milestone · ${formatScheduleDayLabel(start || end)}`;
  }
  const startLabel = formatScheduleDayLabel(start);
  const endLabel = formatScheduleDayLabel(end);
  if (start === end) {
    return startLabel;
  }
  return `${startLabel} – ${endLabel}`;
}

/** Project-level schedule context for Task list header (FO-117). */
export function formatProjectScheduleContextLabel(input: {
  planned_start_date?: string | null;
  planned_end_date?: string | null;
}): string {
  const start = input.planned_start_date?.trim() || "";
  const end = input.planned_end_date?.trim() || "";
  if (!start && !end) {
    return "Not set";
  }
  if (start && end) {
    return `${formatProjectDate(start)} – ${formatProjectDate(end)}`;
  }
  if (start) {
    return `Starts ${formatProjectDate(start)}`;
  }
  return `Ends ${formatProjectDate(end)}`;
}

export function isTaskScheduleUnscheduled(input: {
  planned_start?: string | null;
  planned_end?: string | null;
}): boolean {
  return !input.planned_start && !input.planned_end;
}

export function formatProjectTaskSummaryCounts(
  summary?: ProjectTaskSummary | null,
): Array<{ label: string; value: number }> {
  const counts = summary ?? {
    total: 0,
    not_started: 0,
    in_progress: 0,
    blocked: 0,
    on_hold: 0,
    completed: 0,
    cancelled: 0,
  };

  return [
    { label: "Total", value: counts.total },
    { label: "Not started", value: counts.not_started },
    { label: "In progress", value: counts.in_progress },
    { label: "Blocked", value: counts.blocked },
    { label: "On hold", value: counts.on_hold },
    { label: "Completed", value: counts.completed },
    { label: "Cancelled", value: counts.cancelled },
  ];
}

export function isTaskRelatedHistoryAction(action: string): boolean {
  const normalized = action.toLowerCase();
  return (
    normalized.includes("task") ||
    normalized.includes("checklist") ||
    normalized.includes("comment") ||
    normalized.includes("assign") ||
    normalized.includes("dependency")
  );
}

const PROJECT_TASK_FORM_API_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  description: "Description",
  person_in_charge: "Person in charge",
  status: "Status",
  priority: "Priority",
  planned_start: "Planned start",
  planned_end: "Planned end",
  actual_start: "Actual start",
  actual_end: "Actual end",
  progress_percentage: "Progress",
  sequence: "Sequence",
  is_milestone: "Milestone",
  non_field_errors: "Form",
  task_schedule_dependency_conflict: "Schedule dependency",
  task_ids: "Task order",
  text: "Checklist text",
  body: "Comment",
  is_internal: "Internal comment",
};

export function formatProjectTaskApiFieldLabel(field: string): string {
  return (
    PROJECT_TASK_FORM_API_FIELD_LABELS[field] ??
    formatProjectLabel(field, field)
  );
}

export function formatProjectTaskValidationMessages(
  errors: Record<string, string[]>,
): string[] {
  return Object.entries(errors).flatMap(([field, messages]) =>
    messages
      .filter((message) => Boolean(message?.trim()))
      .map(
        (message) => `${formatProjectTaskApiFieldLabel(field)}: ${message}`,
      ),
  );
}

export function formatProjectTaskError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session expired or authentication is required.";
    }
    if (error.status === 403) {
      return "Your account does not have permission to manage this task.";
    }
    if (error.status === 404) {
      return "The requested task could not be found.";
    }
    if (error.status >= 500) {
      return "The backend failed while loading task data.";
    }

    const validationMessages = formatProjectTaskValidationMessages(
      error.details?.errors ?? {},
    );
    if (validationMessages.length > 0) {
      return validationMessages.join(" ");
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function getProjectTaskListLayoutClasses() {
  return {
    tableWrapper: "hidden md:block",
    cardsWrapper: "space-y-3 md:hidden",
  };
}

export function canViewProjectTasks(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.tasks.view") ||
    hasPermission("projects.view") ||
    hasPermission("projects.manage") ||
    hasPermission("projects.tasks.manage")
  );
}

export function canCreateProjectTask(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.tasks.create") ||
    hasPermission("projects.manage") ||
    hasPermission("projects.tasks.manage")
  );
}

export function canUpdateProjectTask(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.tasks.update") ||
    hasPermission("projects.manage") ||
    hasPermission("projects.tasks.manage")
  );
}

export function canDeleteProjectTask(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.tasks.delete") ||
    hasPermission("projects.manage") ||
    hasPermission("projects.tasks.manage")
  );
}

export function canAssignProjectTask(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.tasks.assign") ||
    hasPermission("projects.manage") ||
    hasPermission("projects.tasks.manage")
  );
}

export function canCommentOnProjectTask(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.tasks.comment") ||
    hasPermission("projects.tasks.update") ||
    hasPermission("projects.manage") ||
    hasPermission("projects.tasks.manage")
  );
}
