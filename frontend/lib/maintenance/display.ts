import { ApiError } from "@/services/api/types";
import type {
  MaintenanceAssignment,
  MaintenanceCompletion,
  MaintenanceEscalation,
  MaintenanceHistory,
  MaintenanceStatusHistory,
  MaintenanceTimelineEvent,
} from "@/types/maintenance";

export function formatMaintenanceLabel(
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

export function formatDateTime(
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

export function formatDate(
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
  }).format(parsed);
}

export function formatPersonLabel(
  email?: string | null,
  fallback = "Unassigned",
): string {
  return email || fallback;
}

export function formatLocationLabel(parts: Array<string | null | undefined>): string {
  const visibleParts = parts.filter(Boolean) as string[];
  return visibleParts.length > 0 ? visibleParts.join(" / ") : "Not assigned";
}

export function formatFileSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) {
    return "Not available";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDurationHours(hours?: string | number | null): string {
  if (hours === null || hours === undefined || hours === "") {
    return "Not available";
  }

  const numeric = typeof hours === "number" ? hours : Number(hours);
  if (Number.isNaN(numeric)) {
    return String(hours);
  }

  return `${numeric.toFixed(2)} h`;
}

export function formatResponseTime(
  requestedAt?: string | null,
  respondedAt?: string | null,
): string {
  if (!requestedAt || !respondedAt) {
    return "Not available";
  }

  const start = new Date(requestedAt).getTime();
  const end = new Date(respondedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return "Not available";
  }

  const totalMinutes = Math.round((end - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes} min`;
  }
  return `${hours}h ${minutes}m`;
}

export function formatRemainingTime(
  targetAt?: string | null,
  completedAt?: string | null,
): string {
  if (!targetAt) {
    return "Not available";
  }

  const target = new Date(targetAt).getTime();
  const reference = completedAt
    ? new Date(completedAt).getTime()
    : Date.now();
  if (Number.isNaN(target) || Number.isNaN(reference)) {
    return "Not available";
  }

  const differenceMinutes = Math.round((target - reference) / 60000);
  const absoluteMinutes = Math.abs(differenceMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  const prefix = differenceMinutes >= 0 ? "Remaining" : "Over by";

  if (hours === 0) {
    return `${prefix} ${minutes} min`;
  }

  return `${prefix} ${hours}h ${minutes}m`;
}

export function calculateTaskCompletionPercent(
  status: "pending" | "in_progress" | "completed" | "cancelled",
): string {
  if (status === "completed") {
    return "100%";
  }
  if (status === "in_progress") {
    return "50%";
  }
  return "0%";
}

const MAINTENANCE_FORM_API_FIELD_LABELS: Record<string, string> = {
  tenant: "Tenant",
  organization: "Organization",
  department: "Department",
  building: "Building",
  floor: "Floor",
  area: "Area",
  asset: "Asset",
  title: "Title",
  description: "Description",
  priority: "Priority",
  due_at: "Due date",
  scheduled_start_at: "Estimated start date",
  scheduled_end_at: "Estimated completion date",
  non_field_errors: "Form",
};

export function formatMaintenanceApiFieldLabel(field: string): string {
  return (
    MAINTENANCE_FORM_API_FIELD_LABELS[field] ??
    formatMaintenanceLabel(field, field)
  );
}

export function formatMaintenanceValidationMessages(
  errors: Record<string, string[]>,
): string[] {
  return Object.entries(errors).flatMap(([field, messages]) =>
    messages
      .filter((message) => Boolean(message?.trim()))
      .map(
        (message) => `${formatMaintenanceApiFieldLabel(field)}: ${message}`,
      ),
  );
}

export function formatMaintenanceError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session expired or authentication is required.";
    }
    if (error.status === 403) {
      return "Your account does not have permission to view this maintenance data.";
    }
    if (error.status === 404) {
      return "The requested maintenance work order could not be found.";
    }
    if (error.status >= 500) {
      return "The backend failed while loading maintenance data.";
    }

    const validationMessages = formatMaintenanceValidationMessages(
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

export function buildMaintenanceTimeline(
  historyEntries: MaintenanceHistory[],
  statusHistory: MaintenanceStatusHistory[],
  assignments: MaintenanceAssignment[],
  escalations: MaintenanceEscalation[],
  completionRecord?: MaintenanceCompletion | null,
): MaintenanceTimelineEvent[] {
  const events: MaintenanceTimelineEvent[] = [
    ...historyEntries.map((item) => ({
      id: `history-${item.id}`,
      type: "history" as const,
      title: formatMaintenanceLabel(item.action, "System event"),
      description: item.description,
      actor: formatPersonLabel(item.actor_email, "System"),
      occurred_at: item.created_at,
      metadata: item.metadata,
    })),
    ...statusHistory.map((item) => ({
      id: `status-${item.id}`,
      type: "status" as const,
      title: `Workflow ${formatMaintenanceLabel(item.action)}`,
      description: `${formatMaintenanceLabel(item.from_status, "None")} to ${formatMaintenanceLabel(item.to_status)}`,
      actor: formatPersonLabel(item.changed_by_email, "System"),
      occurred_at: item.changed_at,
      metadata:
        item.reason || item.note
          ? {
              action: formatMaintenanceLabel(item.action),
              reason: item.reason || "Not provided",
              note: item.note || "Not provided",
            }
          : undefined,
    })),
    ...assignments.map((item) => ({
      id: `assignment-${item.id}`,
      type: "assignment" as const,
      title: item.is_active ? "Assignment updated" : "Assignment removed",
      description: item.note || "Assignment event recorded.",
      actor: formatPersonLabel(item.assigned_by_email, "System"),
      occurred_at: item.assigned_at,
      metadata: item.assigned_to_email
        ? { assigned_to: item.assigned_to_email }
        : undefined,
    })),
    ...escalations.map((item) => ({
      id: `escalation-${item.id}`,
      type: "escalation" as const,
      title: `Escalation ${formatMaintenanceLabel(item.level)}`,
      description: item.reason,
      actor: formatPersonLabel(item.escalated_by_email, "System"),
      occurred_at: item.created_at,
      metadata: item.escalated_to_email
        ? { escalated_to: item.escalated_to_email }
        : undefined,
    })),
  ];

  if (completionRecord) {
    events.push({
      id: `completion-${completionRecord.id}`,
      type: "completion",
      title: "Work order completed",
      description:
        completionRecord.resolution_summary ||
        completionRecord.completion_notes ||
        "Completion recorded.",
      actor: formatPersonLabel(completionRecord.completed_by_email, "System"),
      occurred_at: completionRecord.completed_at,
    });
  }

  return events.sort(
    (left, right) =>
      new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime(),
  );
}
