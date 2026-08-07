import { ApiError } from "@/services/api/types";
import type {
  ProjectProgressSnapshotSource,
  ProjectProgressTrend,
} from "@/types/projects";

import { formatProjectCompletion, formatProjectLabel } from "./display";

export const PROJECT_PROGRESS_SOURCE_LABELS: Record<
  ProjectProgressSnapshotSource,
  string
> = {
  task_created: "Task created",
  task_progress_changed: "Task progress changed",
  task_status_changed: "Task status changed",
  task_cancelled: "Task cancelled",
  task_deleted: "Task deleted",
  task_restored: "Task restored",
  manual_recalculation: "Manual recalculation",
  migration_rebuild: "Migration rebuild",
};

export const PROJECT_PROGRESS_TREND_LABELS: Record<ProjectProgressTrend, string> =
  {
    increased: "Increased",
    decreased: "Decreased",
    unchanged: "Unchanged",
  };

export function parseProgressPercent(
  value?: string | number | null,
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return numeric;
}

export function clampProgressPercent(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

export function formatProgressPercent(
  value?: string | number | null,
): string {
  return formatProjectCompletion(value);
}

export function formatProgressTrendLabel(
  trend?: string | null,
): string {
  if (!trend) {
    return PROJECT_PROGRESS_TREND_LABELS.unchanged;
  }
  if (trend in PROJECT_PROGRESS_TREND_LABELS) {
    return PROJECT_PROGRESS_TREND_LABELS[trend as ProjectProgressTrend];
  }
  return formatProjectLabel(trend);
}

export function formatProgressSourceLabel(source?: string | null): string {
  if (!source) {
    return "—";
  }
  if (source in PROJECT_PROGRESS_SOURCE_LABELS) {
    return PROJECT_PROGRESS_SOURCE_LABELS[
      source as ProjectProgressSnapshotSource
    ];
  }
  return formatProjectLabel(source);
}

export function formatScheduleElapsedLabel(
  value?: string | number | null,
): string {
  if (value === null || value === undefined || value === "") {
    return "Schedule elapsed not available";
  }
  const parsed = parseProgressPercent(value);
  if (parsed === null) {
    return "Schedule elapsed not available";
  }
  return `Schedule elapsed ${formatProgressPercent(parsed)}`;
}

export interface ProgressSparklinePoint {
  x: number;
  y: number;
}

export interface ProgressSparklineGeometry {
  points: string;
  coordinates: ProgressSparklinePoint[];
  values: number[];
  width: number;
  height: number;
}

/** Build SVG polyline points for completion history (oldest → newest). */
export function buildProgressSparklinePoints(
  percentages: Array<string | number | null | undefined>,
  width = 160,
  height = 36,
  padding = 2,
): ProgressSparklineGeometry {
  const values = percentages
    .map((value) => parseProgressPercent(value))
    .filter((value): value is number => value !== null)
    .map(clampProgressPercent);

  if (values.length === 0) {
    return {
      points: "",
      coordinates: [],
      values: [],
      width,
      height,
    };
  }

  const usableWidth = Math.max(width - padding * 2, 1);
  const usableHeight = Math.max(height - padding * 2, 1);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const coordinates = values.map((value, index) => {
    const x =
      values.length === 1
        ? padding + usableWidth / 2
        : padding + (index / (values.length - 1)) * usableWidth;
    const y = padding + usableHeight - ((value - min) / span) * usableHeight;
    return { x, y };
  });

  return {
    points: coordinates.map((point) => `${point.x},${point.y}`).join(" "),
    coordinates,
    values,
    width,
    height,
  };
}

export function formatProjectProgressError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session expired or authentication is required.";
    }
    if (error.status === 403) {
      return "Your account does not have permission for this progress action.";
    }
    if (error.status === 404) {
      return "The requested project progress could not be found.";
    }
    if (error.status >= 500) {
      return "The backend failed while loading project progress.";
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export function canViewProjectProgress(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.progress.view") ||
    hasPermission("projects.view") ||
    hasPermission("projects.manage")
  );
}

export function canRecalculateProjectProgress(
  hasPermission: (code: string) => boolean,
) {
  return (
    hasPermission("projects.progress.recalculate") ||
    hasPermission("projects.manage")
  );
}
