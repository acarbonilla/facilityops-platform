/**
 * FO-105 Gantt helpers — lightweight CSS/SVG chart math (no third-party Gantt library).
 */

export type GanttZoomScale = "day" | "week" | "month";

export interface GanttDateRange {
  start: Date;
  end: Date;
}

export interface GanttBarPosition {
  leftPercent: number;
  widthPercent: number;
}

/** Max visible span (inclusive day count) per zoom to keep the chart usable. */
export const GANTT_MAX_VISIBLE_DAYS: Record<GanttZoomScale, number> = {
  day: 366,
  week: 730,
  month: 1095,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseGanttDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : startOfUtcDay(value);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(Date.UTC(year, month, day));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : startOfUtcDay(parsed);
}

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(startOfUtcDay(date).getTime() + days * MS_PER_DAY);
}

export function diffUtcDays(start: Date, end: Date): number {
  return Math.round(
    (startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) / MS_PER_DAY,
  );
}

export function inclusiveDaySpan(range: GanttDateRange): number {
  return Math.max(1, diffUtcDays(range.start, range.end) + 1);
}

export function getZoomStepDays(zoom: GanttZoomScale): number {
  switch (zoom) {
    case "day":
      return 7;
    case "week":
      return 28;
    case "month":
      return 90;
    default:
      return 7;
  }
}

export function getPixelsPerDay(zoom: GanttZoomScale): number {
  switch (zoom) {
    case "day":
      return 28;
    case "week":
      return 10;
    case "month":
      return 4;
    default:
      return 28;
  }
}

export function clampGanttRange(
  range: GanttDateRange,
  zoom: GanttZoomScale,
): GanttDateRange {
  const start = startOfUtcDay(range.start);
  let end = startOfUtcDay(range.end);
  if (end < start) {
    end = start;
  }
  const maxDays = GANTT_MAX_VISIBLE_DAYS[zoom];
  const span = inclusiveDaySpan({ start, end });
  if (span <= maxDays) {
    return { start, end };
  }
  return { start, end: addUtcDays(start, maxDays - 1) };
}

export function shiftGanttRange(
  range: GanttDateRange,
  zoom: GanttZoomScale,
  direction: -1 | 1,
): GanttDateRange {
  const step = getZoomStepDays(zoom) * direction;
  return clampGanttRange(
    {
      start: addUtcDays(range.start, step),
      end: addUtcDays(range.end, step),
    },
    zoom,
  );
}

export function jumpGanttRangeToToday(
  range: GanttDateRange,
  zoom: GanttZoomScale,
  today: Date = new Date(),
): GanttDateRange {
  const span = inclusiveDaySpan(range);
  const center = startOfUtcDay(today);
  const halfBefore = Math.floor((span - 1) / 2);
  const start = addUtcDays(center, -halfBefore);
  const end = addUtcDays(start, span - 1);
  return clampGanttRange({ start, end }, zoom);
}

export function fitGanttRangeToProject(options: {
  plannedStart?: string | null;
  plannedEnd?: string | null;
  taskStarts?: Array<string | null | undefined>;
  taskEnds?: Array<string | null | undefined>;
  /** FO-115B: include actual execution extent so late bars are not clipped. */
  actualStarts?: Array<string | null | undefined>;
  actualEnds?: Array<string | null | undefined>;
  /** Include today when any active task has started (open-ended actual bar). */
  includeTodayForActive?: boolean;
  zoom: GanttZoomScale;
  today?: Date;
  paddingDays?: number;
}): GanttDateRange {
  const today = startOfUtcDay(options.today ?? new Date());
  const candidates: Date[] = [];

  const projectStart = parseGanttDate(options.plannedStart);
  const projectEnd = parseGanttDate(options.plannedEnd);
  if (projectStart) candidates.push(projectStart);
  if (projectEnd) candidates.push(projectEnd);

  for (const value of options.taskStarts ?? []) {
    const parsed = parseGanttDate(value);
    if (parsed) candidates.push(parsed);
  }
  for (const value of options.taskEnds ?? []) {
    const parsed = parseGanttDate(value);
    if (parsed) candidates.push(parsed);
  }
  for (const value of options.actualStarts ?? []) {
    const parsed = parseGanttDate(value);
    if (parsed) candidates.push(parsed);
  }
  for (const value of options.actualEnds ?? []) {
    const parsed = parseGanttDate(value);
    if (parsed) candidates.push(parsed);
  }
  if (options.includeTodayForActive) {
    candidates.push(today);
  }

  if (candidates.length === 0) {
    const padding = options.paddingDays ?? 14;
    return clampGanttRange(
      {
        start: addUtcDays(today, -padding),
        end: addUtcDays(today, padding),
      },
      options.zoom,
    );
  }

  let min = candidates[0]!;
  let max = candidates[0]!;
  for (const date of candidates) {
    if (date < min) min = date;
    if (date > max) max = date;
  }

  const padding = options.paddingDays ?? 2;
  return clampGanttRange(
    {
      start: addUtcDays(min, -padding),
      end: addUtcDays(max, padding),
    },
    options.zoom,
  );
}

export function computeBarPosition(
  range: GanttDateRange,
  plannedStart: string | null | undefined,
  plannedEnd: string | null | undefined,
): GanttBarPosition | null {
  const start = parseGanttDate(plannedStart);
  const end = parseGanttDate(plannedEnd ?? plannedStart);
  if (!start || !end) {
    return null;
  }

  const rangeStart = startOfUtcDay(range.start);
  const rangeEnd = startOfUtcDay(range.end);
  const span = inclusiveDaySpan({ start: rangeStart, end: rangeEnd });

  const barStart = start < rangeStart ? rangeStart : start;
  const barEnd = end > rangeEnd ? rangeEnd : end;
  if (barEnd < rangeStart || barStart > rangeEnd) {
    return null;
  }

  const offsetDays = diffUtcDays(rangeStart, barStart);
  const durationDays = Math.max(1, diffUtcDays(barStart, barEnd) + 1);

  return {
    leftPercent: (offsetDays / span) * 100,
    widthPercent: (durationDays / span) * 100,
  };
}

export function computeTodayMarkerPercent(
  range: GanttDateRange,
  today: Date = new Date(),
): number | null {
  const day = startOfUtcDay(today);
  const rangeStart = startOfUtcDay(range.start);
  const rangeEnd = startOfUtcDay(range.end);
  if (day < rangeStart || day > rangeEnd) {
    return null;
  }
  const span = inclusiveDaySpan({ start: rangeStart, end: rangeEnd });
  // Place marker at the start of "today" within the inclusive span.
  return (diffUtcDays(rangeStart, day) / span) * 100;
}

export function formatDelayLabel(options: {
  isDelayed: boolean;
  isCompletedLate?: boolean;
  delayDays?: number | null;
}): string {
  const days = Math.max(0, Math.round(options.delayDays ?? 0));
  if (options.isDelayed) {
    if (days <= 0) {
      return "Delayed";
    }
    return days === 1 ? "Delayed 1 day" : `Delayed ${days} days`;
  }
  if (options.isCompletedLate) {
    if (days <= 0) {
      return "Completed late";
    }
    return days === 1
      ? "Completed 1 day late"
      : `Completed ${days} days late`;
  }
  return "On schedule";
}

export function buildTimelineTicks(
  range: GanttDateRange,
  zoom: GanttZoomScale,
): Array<{ date: Date; label: string; leftPercent: number }> {
  const start = startOfUtcDay(range.start);
  const end = startOfUtcDay(range.end);
  const span = inclusiveDaySpan({ start, end });
  const ticks: Array<{ date: Date; label: string; leftPercent: number }> = [];

  let cursor = start;
  while (cursor <= end) {
    const offset = diffUtcDays(start, cursor);
    ticks.push({
      date: cursor,
      label: formatTickLabel(cursor, zoom),
      leftPercent: (offset / span) * 100,
    });

    if (zoom === "day") {
      cursor = addUtcDays(cursor, 1);
    } else if (zoom === "week") {
      cursor = addUtcDays(cursor, 7);
    } else {
      cursor = addUtcMonths(cursor, 1);
    }

    if (ticks.length > 400) {
      break;
    }
  }

  return ticks;
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

function formatTickLabel(date: Date, zoom: GanttZoomScale): string {
  if (zoom === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(date);
  }
  if (zoom === "week") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function timelineWidthPx(
  range: GanttDateRange,
  zoom: GanttZoomScale,
): number {
  return inclusiveDaySpan(range) * getPixelsPerDay(zoom);
}

/** FO-115: readable viewport caption for controls. */
export function formatGanttViewportLabel(range: GanttDateRange): string {
  const start = startOfUtcDay(range.start);
  const end = startOfUtcDay(range.end);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const startLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
    timeZone: "UTC",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(end);
  return `${startLabel} – ${endLabel}`;
}

export function isUtcWeekend(date: Date): boolean {
  const day = startOfUtcDay(date).getUTCDay();
  return day === 0 || day === 6;
}

export function rezoomPreservingFocal(
  range: GanttDateRange,
  toZoom: GanttZoomScale,
): GanttDateRange {
  const span = inclusiveDaySpan(range);
  const focal = addUtcDays(range.start, Math.floor((span - 1) / 2));
  const defaultSpan =
    toZoom === "day" ? 21 : toZoom === "week" ? 84 : 180;
  const half = Math.floor((defaultSpan - 1) / 2);
  return clampGanttRange(
    {
      start: addUtcDays(focal, -half),
      end: addUtcDays(focal, defaultSpan - 1 - half),
    },
    toZoom,
  );
}

export interface GanttHeaderCell {
  date: Date;
  label: string;
  subLabel?: string;
  leftPercent: number;
  widthPercent: number;
  isWeekend?: boolean;
}

export interface GanttHeaderBand {
  label: string;
  leftPercent: number;
  widthPercent: number;
}

/** FO-115 rich calendar header: month bands + day/week/month cells. */
export function buildRichTimelineHeader(
  range: GanttDateRange,
  zoom: GanttZoomScale,
): { bands: GanttHeaderBand[]; cells: GanttHeaderCell[] } {
  const start = startOfUtcDay(range.start);
  const end = startOfUtcDay(range.end);
  const span = inclusiveDaySpan({ start, end });
  const cells: GanttHeaderCell[] = [];
  const bands: GanttHeaderBand[] = [];

  if (zoom === "day") {
    let cursor = start;
    while (cursor <= end) {
      const offset = diffUtcDays(start, cursor);
      cells.push({
        date: cursor,
        label: String(cursor.getUTCDate()),
        subLabel: new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          timeZone: "UTC",
        }).format(cursor),
        leftPercent: (offset / span) * 100,
        widthPercent: (1 / span) * 100,
        isWeekend: isUtcWeekend(cursor),
      });
      cursor = addUtcDays(cursor, 1);
      if (cells.length > 400) break;
    }
  } else if (zoom === "week") {
    let cursor = start;
    while (cursor <= end) {
      const offset = diffUtcDays(start, cursor);
      const weekEnd = addUtcDays(cursor, 6);
      const clippedEnd = weekEnd > end ? end : weekEnd;
      const days = diffUtcDays(cursor, clippedEnd) + 1;
      cells.push({
        date: cursor,
        label: formatWeekRangeLabel(cursor, clippedEnd),
        leftPercent: (offset / span) * 100,
        widthPercent: (days / span) * 100,
      });
      cursor = addUtcDays(cursor, 7);
      if (cells.length > 200) break;
    }
  } else {
    let cursor = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
    );
    if (cursor < start) {
      // start mid-month
    }
    while (cursor <= end) {
      const monthStart = cursor < start ? start : cursor;
      const nextMonth = addUtcMonths(cursor, 1);
      const monthEndExclusive = nextMonth;
      const monthEnd =
        monthEndExclusive > end
          ? end
          : addUtcDays(monthEndExclusive, -1);
      if (monthEnd < start) {
        cursor = nextMonth;
        continue;
      }
      const clippedStart = monthStart < start ? start : monthStart;
      const clippedEnd = monthEnd > end ? end : monthEnd;
      const offset = diffUtcDays(start, clippedStart);
      const days = diffUtcDays(clippedStart, clippedEnd) + 1;
      cells.push({
        date: clippedStart,
        label: new Intl.DateTimeFormat("en-US", {
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(clippedStart),
        leftPercent: (offset / span) * 100,
        widthPercent: (days / span) * 100,
      });
      cursor = nextMonth;
      if (cells.length > 120) break;
    }
  }

  // Month/year bands for day and week zooms.
  if (zoom !== "month") {
    let bandCursor = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
    );
    while (bandCursor <= end) {
      const nextMonth = addUtcMonths(bandCursor, 1);
      const clippedStart = bandCursor < start ? start : bandCursor;
      const clippedEnd =
        addUtcDays(nextMonth, -1) > end ? end : addUtcDays(nextMonth, -1);
      if (clippedEnd >= start) {
        const offset = diffUtcDays(start, clippedStart);
        const days = diffUtcDays(clippedStart, clippedEnd) + 1;
        bands.push({
          label: new Intl.DateTimeFormat("en-US", {
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          })
            .format(clippedStart)
            .toUpperCase(),
          leftPercent: (offset / span) * 100,
          widthPercent: (days / span) * 100,
        });
      }
      bandCursor = nextMonth;
      if (bands.length > 48) break;
    }
  }

  return { bands, cells };
}

export function formatWeekRangeLabel(start: Date, end: Date): string {
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const startFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(start);
  const endFmt = sameMonth
    ? new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        timeZone: "UTC",
      }).format(end)
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(end);
  return `${startFmt}–${endFmt}`;
}

export function getTaskBarAriaLabel(task: {
  task_code: string;
  name: string;
  status: string;
  planned_start?: string | null;
  planned_end?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  progress_percentage?: string | number;
  is_milestone?: boolean;
  execution_schedule_status?: string | null;
  start_variance_days?: number | null;
  completion_variance_days?: number | null;
}): string {
  const schedule =
    task.planned_start && task.planned_end
      ? `${task.planned_start} to ${task.planned_end}`
      : "unscheduled";
  const actual =
    task.actual_start && task.actual_end
      ? `${task.actual_start} to ${task.actual_end}`
      : task.actual_start
        ? `started ${task.actual_start}, not completed`
        : "not started";
  const kind = task.is_milestone ? "Milestone" : "Task";
  const progress =
    task.progress_percentage === null || task.progress_percentage === undefined
      ? "0%"
      : `${Math.round(Number(task.progress_percentage))}%`;
  const variance =
    task.execution_schedule_status != null
      ? ` Schedule status ${task.execution_schedule_status}.`
      : "";
  return `${kind} ${task.task_code} ${task.name}. Status ${task.status}. Planned ${schedule}. Actual ${actual}. Progress ${progress}.${variance}`;
}
