import { ApiError } from "@/services/api/types";
import type { SystemStatus } from "@/types/dashboard";

export function formatDashboardSummaryError(
  error: unknown,
  fallback = "Foundation metrics could not be loaded.",
): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session expired or authentication is required.";
    }
    if (error.status === 403) {
      return "Your account could not access foundation metrics.";
    }
    if (error.status >= 500) {
      return "The dashboard service failed while loading foundation metrics.";
    }

    const message = error.message?.trim();
    if (message) {
      return message;
    }

    return fallback;
  }

  if (error instanceof Error) {
    const message = error.message?.trim();
    if (message) {
      return message;
    }
  }

  return fallback;
}

export function isDashboardUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function buildDashboardSystemStatus(options: {
  health?: { status: string; service: string } | null;
  healthFailed?: boolean;
}): SystemStatus {
  const { health, healthFailed = false } = options;

  if (health?.status === "ok") {
    return {
      service: health.service,
      status: health.status,
      connected: true,
      message: "Backend connectivity is available.",
    };
  }

  if (health) {
    return {
      service: health.service,
      status: health.status,
      connected: false,
      message: "Backend health reported a degraded or unexpected status.",
    };
  }

  return {
    service: "facilityops-backend",
    status: healthFailed ? "unavailable" : "unknown",
    connected: false,
    message: "Backend connectivity could not be confirmed.",
  };
}

export function formatDashboardHealthLabel(status: SystemStatus): string {
  if (status.connected) {
    return "Connected";
  }
  if (status.status === "unavailable" || status.status === "unknown") {
    return "Unavailable";
  }
  return "Degraded";
}
