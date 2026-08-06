import { ApiError } from "@/services/api/types";
import type {
  ProjectIssueSeverity,
  ProjectIssueStatus,
} from "@/types/projects";

import { formatProjectLabel } from "./display";

export const PROJECT_ISSUE_SEVERITY_LABELS: Record<
  ProjectIssueSeverity,
  string
> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const PROJECT_ISSUE_STATUS_LABELS: Record<ProjectIssueStatus, string> =
  {
    open: "Open",
    investigating: "Investigating",
    blocked: "Blocked",
    resolved: "Resolved",
    closed: "Closed",
    cancelled: "Cancelled",
  };

export function formatProjectIssueSeverityLabel(
  severity: ProjectIssueSeverity,
): string {
  return (
    PROJECT_ISSUE_SEVERITY_LABELS[severity] ?? formatProjectLabel(severity)
  );
}

export function formatProjectIssueStatusLabel(
  status: ProjectIssueStatus,
): string {
  return PROJECT_ISSUE_STATUS_LABELS[status] ?? formatProjectLabel(status);
}

const PROJECT_ISSUE_FORM_API_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  severity: "Severity",
  status: "Status",
  owner: "Owner",
  due_date: "Due date",
  body: "Comment",
  is_internal: "Internal comment",
  non_field_errors: "Form",
};

export function formatProjectIssueApiFieldLabel(field: string): string {
  return (
    PROJECT_ISSUE_FORM_API_FIELD_LABELS[field] ??
    formatProjectLabel(field, field)
  );
}

export function formatProjectIssueValidationMessages(
  errors: Record<string, string[]>,
): string[] {
  return Object.entries(errors).flatMap(([field, messages]) =>
    messages
      .filter((message) => Boolean(message?.trim()))
      .map(
        (message) => `${formatProjectIssueApiFieldLabel(field)}: ${message}`,
      ),
  );
}

export function formatProjectIssueError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session expired or authentication is required.";
    }
    if (error.status === 403) {
      return "Your account does not have permission to manage this issue.";
    }
    if (error.status === 404) {
      return "The requested issue could not be found.";
    }
    if (error.status >= 500) {
      return "The backend failed while loading issue data.";
    }

    const validationMessages = formatProjectIssueValidationMessages(
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

export function getProjectIssueListLayoutClasses() {
  return {
    tableWrapper: "hidden md:block",
    cardsWrapper: "space-y-3 md:hidden",
  };
}

export function canViewProjectIssues(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.issues.view") ||
    hasPermission("projects.view") ||
    hasPermission("projects.manage") ||
    hasPermission("projects.issues.manage")
  );
}

export function canManageProjectIssues(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.issues.manage") ||
    hasPermission("projects.manage")
  );
}

export function canCommentOnProjectIssue(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.issues.comment") ||
    hasPermission("projects.issues.manage") ||
    hasPermission("projects.manage")
  );
}
