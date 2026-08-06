import { ApiError } from "@/services/api/types";
import type {
  ProjectTimelineEventCategory,
  ProjectTimelineListFilters,
  ProjectTimelineListParams,
} from "@/types/projects";

import { formatProjectLabel } from "./display";

export const PROJECT_TIMELINE_CATEGORY_LABELS: Record<
  ProjectTimelineEventCategory,
  string
> = {
  project: "Project",
  task: "Task",
  issue: "Issue",
  note: "Note",
  attachment: "Attachment",
  comment: "Comment",
  status: "Status",
  assignment: "Assignment",
  dependency: "Dependency",
  checklist: "Checklist",
};

export const DEFAULT_PROJECT_TIMELINE_LIST_FILTERS: ProjectTimelineListFilters =
  {
    search: "",
    category: "",
    eventType: "",
    actor: "",
    dateFrom: "",
    dateTo: "",
    sort: "-timestamp",
    pageSize: 20,
  };

export function formatProjectTimelineCategoryLabel(
  category: string,
): string {
  if (category in PROJECT_TIMELINE_CATEGORY_LABELS) {
    return PROJECT_TIMELINE_CATEGORY_LABELS[
      category as ProjectTimelineEventCategory
    ];
  }
  return formatProjectLabel(category);
}

export function serializeProjectTimelineListParams(
  filters: ProjectTimelineListFilters,
  page: number,
  debouncedSearch?: string,
): ProjectTimelineListParams {
  const search = (debouncedSearch ?? filters.search).trim();
  const category = (filters.category || undefined) as
    | ProjectTimelineEventCategory
    | undefined;

  return {
    page,
    page_size: filters.pageSize,
    search: search || undefined,
    category,
    event_type: filters.eventType.trim() || undefined,
    actor: filters.actor || undefined,
    date_from: filters.dateFrom || undefined,
    date_to: filters.dateTo || undefined,
    ordering: filters.sort || undefined,
  };
}

export function formatProjectTimelineError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session expired or authentication is required.";
    }
    if (error.status === 403) {
      return "Your account does not have permission to view this timeline.";
    }
    if (error.status === 404) {
      return "The requested timeline could not be found.";
    }
    if (error.status >= 500) {
      return "The backend failed while loading timeline data.";
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function canViewProjectTimeline(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.timeline.view") ||
    hasPermission("projects.view") ||
    hasPermission("projects.manage")
  );
}

export function formatTimelineMetadataValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
