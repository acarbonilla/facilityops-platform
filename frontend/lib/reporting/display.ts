import { ApiError } from "@/services/api/types";
import type { ReportingOperationalOverview } from "@/types/reporting";

const numberFormatter = new Intl.NumberFormat("en-US");
const scoreFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  assigned: "Assigned",
  in_progress: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
  closed: "Closed",
  resolved: "Resolved",
  draft: "Draft",
  scheduled: "Scheduled",
  verified: "Verified",
  submitted: "Submitted",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
  urgent: "Urgent",
};

const CATEGORY_LABELS: Record<string, string> = {
  hvac: "HVAC",
  electrical: "Electrical",
  plumbing: "Plumbing",
  general: "General",
  cleaning: "Cleaning",
  safety: "Safety",
  other: "Other",
};

const FIELD_LABELS: Record<string, string> = {
  date_from: "Date From",
  date_to: "Date To",
  building: "Building",
  organization: "Organization",
  ticket_status: "Ticket Status",
  ticket_priority: "Ticket Priority",
  work_order_status: "Work Order Status",
  work_order_priority: "Work Order Priority",
  inspection_status: "Inspection Status",
  status: "Status",
  priority: "Priority",
  non_field_errors: "Filters",
};

export function formatReportingMachineLabel(
  value?: string | null,
  fallback = "Unknown",
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

export function formatReportingStatusLabel(value?: string | null): string {
  if (!value) {
    return "Unknown";
  }
  return STATUS_LABELS[value] ?? formatReportingMachineLabel(value, value);
}

export function formatReportingPriorityLabel(value?: string | null): string {
  if (!value) {
    return "Unknown";
  }
  return PRIORITY_LABELS[value] ?? formatReportingMachineLabel(value, value);
}

export function formatReportingCategoryLabel(value?: string | null): string {
  if (!value) {
    return "Unknown";
  }
  return CATEGORY_LABELS[value] ?? formatReportingMachineLabel(value, value);
}

export function formatReportingNumber(
  value?: number | null,
  fallback = "—",
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return numberFormatter.format(value);
}

export function formatReportingAverageScore(
  value?: number | null,
  emptyLabel = "No scored inspections",
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return emptyLabel;
  }
  return scoreFormatter.format(value);
}

export function formatReportingPeriod(
  dateFrom?: string | null,
  dateTo?: string | null,
  fallback = "Period unavailable",
): string {
  if (!dateFrom || !dateTo) {
    return fallback;
  }

  const from = formatReportingInstant(dateFrom);
  const to = formatReportingInstant(dateTo);
  return `${from} – ${to}`;
}

export function formatReportingInstant(
  value?: string | null,
  fallback = "Unavailable",
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

export function formatReportingEmptyValue(
  value?: string | number | null,
  fallback = "—",
): string {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
}

export function isReportingOverviewEmpty(
  overview: ReportingOperationalOverview,
): boolean {
  return (
    overview.tickets.total === 0 &&
    overview.work_orders.total === 0 &&
    overview.inspections.total === 0
  );
}

export function formatReportingCountEntries(
  counts: Record<string, number>,
  labelFormatter: (key: string) => string = formatReportingMachineLabel,
): Array<{ key: string; label: string; count: number }> {
  return Object.entries(counts)
    .map(([key, count]) => ({
      key,
      label: labelFormatter(key),
      count,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function formatReportingFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? formatReportingMachineLabel(field, field);
}

export function formatReportingValidationMessages(
  errors: Record<string, string[]>,
): string[] {
  return Object.entries(errors).flatMap(([field, messages]) =>
    messages
      .filter((message) => Boolean(message?.trim()))
      .map((message) => `${formatReportingFieldLabel(field)}: ${message}`),
  );
}

export function formatReportingError(
  error: unknown,
  fallback = "The reporting overview could not be loaded.",
): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session expired or authentication is required.";
    }
    if (error.status === 403) {
      return "Your account does not have permission to view reporting data.";
    }
    if (error.status === 404) {
      return (
        error.message ||
        "The selected organization or building could not be found."
      );
    }
    if (error.status >= 500) {
      return "The reporting service failed while loading the overview.";
    }

    const validationMessages = formatReportingValidationMessages(
      error.details?.errors ?? {},
    );
    if (validationMessages.length > 0) {
      return validationMessages.join(" ");
    }

    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

export function isReportingFilterResetRecommended(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }

  if (error.status === 404) {
    return true;
  }

  if (error.status !== 400) {
    return false;
  }

  const fields = Object.keys(error.details?.errors ?? {});
  return fields.some((field) => field === "building" || field === "organization");
}
