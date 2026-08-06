import { ApiError } from "@/services/api/types";
import type { ProjectPriority, ProjectStatus } from "@/types/projects";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Draft",
  planned: "Planned",
  in_progress: "In Progress",
  on_hold: "On Hold",
  delayed: "Delayed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PROJECT_PRIORITY_LABELS: Record<ProjectPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export function formatProjectLabel(
  value?: string | null,
  fallback = "Not available",
): string {
  if (!value) {
    return fallback;
  }

  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatProjectStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUS_LABELS[status] ?? formatProjectLabel(status);
}

export function formatProjectPriorityLabel(priority: ProjectPriority): string {
  return PROJECT_PRIORITY_LABELS[priority] ?? formatProjectLabel(priority);
}

export function formatProjectDate(
  value?: string | null,
  fallback = "Not set",
): string {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(parsed);
}

export function formatProjectDateTime(
  value?: string | null,
  fallback = "Not available",
): string {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function formatProjectCompletion(
  value?: string | number | null,
): string {
  if (value === null || value === undefined || value === "") {
    return "0%";
  }

  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }

  const formatted = Number.isInteger(numeric)
    ? String(numeric)
    : String(Number(numeric.toFixed(2)));
  return `${formatted}%`;
}

export function formatPersonLabel(
  email?: string | null,
  fallback = "Unassigned",
): string {
  return email || fallback;
}

const PROJECT_FORM_API_FIELD_LABELS: Record<string, string> = {
  organization: "Organization",
  building: "Building",
  project_code: "Project code",
  name: "Name",
  description: "Description",
  project_manager: "Project manager",
  status: "Status",
  priority: "Priority",
  planned_start_date: "Planned start date",
  planned_end_date: "Planned end date",
  actual_start_date: "Actual start date",
  actual_end_date: "Actual end date",
  completion_percentage: "Completion",
  non_field_errors: "Form",
};

export function formatProjectApiFieldLabel(field: string): string {
  return (
    PROJECT_FORM_API_FIELD_LABELS[field] ?? formatProjectLabel(field, field)
  );
}

export function formatProjectValidationMessages(
  errors: Record<string, string[]>,
): string[] {
  return Object.entries(errors).flatMap(([field, messages]) =>
    messages
      .filter((message) => Boolean(message?.trim()))
      .map(
        (message) => `${formatProjectApiFieldLabel(field)}: ${message}`,
      ),
  );
}

export function formatProjectError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session expired or authentication is required.";
    }
    if (error.status === 403) {
      return "Your account does not have permission to view this project data.";
    }
    if (error.status === 404) {
      return "The requested project could not be found.";
    }
    if (error.status >= 500) {
      return "The backend failed while loading project data.";
    }

    const validationMessages = formatProjectValidationMessages(
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

/** Responsive list layout: table on md+, cards on small screens. */
export function getProjectListLayoutClasses() {
  return {
    tableWrapper: "hidden md:block",
    cardsWrapper: "space-y-3 md:hidden",
  };
}

export function canCreateProject(hasPermission: (code: string) => boolean) {
  return (
    hasPermission("projects.create") || hasPermission("projects.manage")
  );
}

export function canUpdateProject(hasPermission: (code: string) => boolean) {
  return (
    hasPermission("projects.update") || hasPermission("projects.manage")
  );
}

export function canDeleteProject(hasPermission: (code: string) => boolean) {
  return (
    hasPermission("projects.delete") || hasPermission("projects.manage")
  );
}
