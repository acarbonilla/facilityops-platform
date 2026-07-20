import { ApiError } from "@/services/api/types";
import type { MyRequestDetail } from "@/types/my-requests";
import {
  MY_REQUEST_ATTACHMENT_GUIDANCE,
  MY_REQUEST_COMMENTS_GUIDANCE,
  MY_REQUEST_STATUS_GUIDANCE,
} from "@/types/my-requests";
import type { FmTicketStatus } from "@/types/fm-tickets";

const REQUESTER_STATUS_LABELS: Record<FmTicketStatus, string> = {
  draft: "Draft",
  open: "Submitted",
  assigned: "Assigned to facilities",
  in_progress: "In progress",
  on_hold: "On hold",
  resolved: "Resolved",
  closed: "Closed",
  cancelled: "Cancelled",
};

export function formatRequesterStatusLabel(
  status?: string | null,
  fallback = "Unknown",
): string {
  if (!status) {
    return fallback;
  }

  if (status in REQUESTER_STATUS_LABELS) {
    return REQUESTER_STATUS_LABELS[status as FmTicketStatus];
  }

  return status
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRequesterCategoryLabel(
  category?: string | null,
  fallback = "Not provided",
): string {
  if (!category) {
    return fallback;
  }

  if (category.toLowerCase() === "hvac") {
    return "HVAC";
  }

  return category
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRequesterDateTime(
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

export function formatRequesterLocation(parts: Array<string | null | undefined>): string {
  const visible = parts.filter(Boolean) as string[];
  return visible.length > 0 ? visible.join(" / ") : "Location not specified";
}

export function getAttachmentGuidanceText(): string {
  return MY_REQUEST_ATTACHMENT_GUIDANCE;
}

export function getCommentsGuidanceText(): string {
  return MY_REQUEST_COMMENTS_GUIDANCE;
}

export function getStatusGuidanceText(): string {
  return MY_REQUEST_STATUS_GUIDANCE;
}

/** Confirm My Requests never depends on Master Data settings.view. */
export function myRequestsRequiresSettingsView(): boolean {
  return false;
}

const SAFE_DETAIL_FIELDS = [
  "id",
  "ticket_number",
  "title",
  "description",
  "status",
  "category",
  "priority",
  "organization",
  "organization_name",
  "building",
  "building_name",
  "floor",
  "floor_name",
  "area",
  "area_name",
  "asset",
  "asset_name",
  "reported_at",
  "resolved_at",
  "closed_at",
  "created_at",
  "updated_at",
] as const;

export type SafeMyRequestDetailField = (typeof SAFE_DETAIL_FIELDS)[number];

export function mapSafeMyRequestDetailFields(
  detail: MyRequestDetail,
): Record<SafeMyRequestDetailField, string | null> {
  return {
    id: detail.id,
    ticket_number: detail.ticket_number,
    title: detail.title,
    description: detail.description,
    status: detail.status,
    category: detail.category,
    priority: detail.priority,
    organization: detail.organization,
    organization_name: detail.organization_name,
    building: detail.building,
    building_name: detail.building_name,
    floor: detail.floor,
    floor_name: detail.floor_name,
    area: detail.area,
    area_name: detail.area_name,
    asset: detail.asset,
    asset_name: detail.asset_name,
    reported_at: detail.reported_at,
    resolved_at: detail.resolved_at,
    closed_at: detail.closed_at,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
  };
}

export function getSafeMyRequestDetailFieldNames(): readonly string[] {
  return SAFE_DETAIL_FIELDS;
}

function formatFieldLabel(field: string): string {
  return field
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function mapMyRequestFieldValidationErrors(
  error: unknown,
): Record<string, string> {
  if (!(error instanceof ApiError) || error.status !== 400) {
    return {};
  }

  const errors = error.details?.errors;
  if (!errors) {
    return {};
  }

  const mapped: Record<string, string> = {};
  for (const [field, messages] of Object.entries(errors)) {
    if (!messages?.length) {
      continue;
    }
    mapped[field] = messages.join(" ");
  }
  return mapped;
}

export function formatMyRequestError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  switch (error.status) {
    case 400: {
      const fieldErrors = mapMyRequestFieldValidationErrors(error);
      const messages = Object.entries(fieldErrors).map(
        ([field, message]) => `${formatFieldLabel(field)}: ${message}`,
      );
      if (messages.length > 0) {
        return messages.join(" ");
      }
      return error.details?.message ?? "Check the submitted values and try again.";
    }
    case 401:
      return "Your session has expired. Sign in again before retrying.";
    case 403:
      return "You do not have permission to perform this request action.";
    case 404:
      return getGenericMyRequestNotFoundMessage();
    case 0:
      return "The backend service could not be reached. Check your connection and retry.";
    default:
      return error.details?.message ?? error.message ?? fallback;
  }
}

export function formatMyRequestOptionsError(
  error: unknown,
): string {
  return formatMyRequestError(
    error,
    "Request options could not be loaded. Retry to continue.",
  );
}

export function getGenericMyRequestNotFoundMessage(): string {
  return "This request could not be found.";
}

export function isGenericMyRequestNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
