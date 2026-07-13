import { ApiError } from "@/services/api/types";
import type {
  NotificationListFilters,
  NotificationListParams,
  NotificationSeverity,
} from "@/types/notifications";

const SEVERITY_STYLES: Record<NotificationSeverity, string> = {
  info: "bg-blue-100 text-blue-800",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  error: "bg-rose-100 text-rose-800",
};

export function formatUnreadBadgeCount(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }

  if (count > 99) {
    return "99+";
  }

  return String(count);
}

export function formatNotificationSeverityLabel(
  severity: NotificationSeverity,
): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function getNotificationSeverityStyles(
  severity: NotificationSeverity,
): string {
  return SEVERITY_STYLES[severity];
}

export function formatNotificationSourceModule(
  value?: string | null,
): string | null {
  if (!value?.trim()) {
    return null;
  }

  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatNotificationTimestamp(
  value?: string | null,
  now: Date = new Date(),
): string {
  if (!value) {
    return "Unknown time";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const diffMs = parsed.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (Math.abs(diffMinutes) < 1) {
    return "Just now";
  }

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) {
    return formatter.format(diffDays, "day");
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function getSafeNotificationTargetUrl(
  value?: string | null,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith("/")) {
    return null;
  }

  if (trimmed.startsWith("//")) {
    return null;
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return null;
  }

  if (trimmed.includes("\\")) {
    return null;
  }

  if (containsAsciiControlCharacters(trimmed)) {
    return null;
  }

  const decodedPath = getDecodedPathForValidation(trimmed);
  if (decodedPath === null || isUnsafeDecodedPath(decodedPath)) {
    return null;
  }

  const suffixIndex = trimmed.search(/[?#]/);
  if (suffixIndex !== -1) {
    const suffix = trimmed.slice(suffixIndex);
    if (suffix.includes("\\") || containsAsciiControlCharacters(suffix)) {
      return null;
    }
  }

  return trimmed;
}

const ASCII_CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

function containsAsciiControlCharacters(value: string): boolean {
  return ASCII_CONTROL_CHARACTER_PATTERN.test(value);
}

function isUnsafeDecodedPath(value: string): boolean {
  if (!value.startsWith("/")) {
    return true;
  }

  if (value.startsWith("//")) {
    return true;
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
    return true;
  }

  if (value.includes("\\")) {
    return true;
  }

  if (containsAsciiControlCharacters(value)) {
    return true;
  }

  return false;
}

function decodePathComponent(value: string): string | null {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return null;
  }
}

function getDecodedPathForValidation(value: string): string | null {
  const suffixIndex = value.search(/[?#]/);
  const pathOnly = suffixIndex === -1 ? value : value.slice(0, suffixIndex);

  let decoded = pathOnly;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const next = decodePathComponent(decoded);
    if (next === null) {
      return null;
    }

    if (next === decoded) {
      break;
    }

    decoded = next;
  }

  return decoded;
}

export function buildNotificationListParams(
  filters: NotificationListFilters,
  page: number,
): NotificationListParams {
  const params: NotificationListParams = {
    page,
    page_size: filters.pageSize,
    ordering: "-created_at",
  };

  if (filters.readState === "read") {
    params.is_read = true;
  } else if (filters.readState === "unread") {
    params.is_read = false;
  }

  if (filters.severity) {
    params.severity = filters.severity;
  }

  const sourceModule = filters.sourceModule.trim();
  if (sourceModule) {
    params.source_module = sourceModule;
  }

  return params;
}

export function hasActiveNotificationFilters(
  filters: NotificationListFilters,
): boolean {
  return (
    filters.readState !== "" ||
    filters.severity !== "" ||
    filters.sourceModule.trim() !== ""
  );
}

export function formatNotificationError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session expired or authentication is required.";
    }
    if (error.status === 403) {
      return "Your account cannot access these notifications.";
    }
    if (error.status === 404) {
      return "The requested notification could not be found.";
    }
    if (error.status >= 500) {
      return "The backend failed while loading notifications.";
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
