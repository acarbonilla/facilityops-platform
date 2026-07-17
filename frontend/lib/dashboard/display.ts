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

/**
 * Builds SystemStatus from health query state.
 *
 * Precedence:
 * 1. Pending/fetching without confirmed data → Checking
 * 2. Successful status === "ok" → Connected
 * 3. Successful non-OK response → Degraded
 * 4. Failed request → Unavailable
 * 5. Initial disabled/not-yet-run → Checking
 *
 * When previous successful data remains during a background refetch, that
 * confirmed Connected/Degraded result is preserved.
 */
export function buildDashboardSystemStatus(options: {
  health?: { status: string; service: string } | null;
  healthPending?: boolean;
  healthFetching?: boolean;
  healthFailed?: boolean;
}): SystemStatus {
  const {
    health,
    healthPending = false,
    healthFetching = false,
    healthFailed = false,
  } = options;

  if (health?.status === "ok") {
    return {
      service: health.service,
      status: health.status,
      connected: true,
      checking: false,
      message: "Backend connectivity is available.",
    };
  }

  if (health) {
    return {
      service: health.service,
      status: health.status,
      connected: false,
      checking: false,
      message: "Backend health reported a degraded or unexpected status.",
    };
  }

  const isChecking =
    healthPending || healthFetching || !healthFailed;

  if (isChecking) {
    return {
      service: "facilityops-backend",
      status: "checking",
      connected: false,
      checking: true,
      message: "Checking backend connectivity.",
    };
  }

  return {
    service: "facilityops-backend",
    status: "unavailable",
    connected: false,
    checking: false,
    message: "Backend connectivity could not be confirmed.",
  };
}

export function formatDashboardHealthLabel(status: SystemStatus): string {
  if (status.checking || status.status === "checking") {
    return "Checking";
  }
  if (status.connected) {
    return "Connected";
  }
  if (status.status === "unavailable") {
    return "Unavailable";
  }
  return "Degraded";
}
