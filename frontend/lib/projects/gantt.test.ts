import assert from "node:assert/strict";
import test from "node:test";

import {
  clampGanttRange,
  computeBarPosition,
  computeTodayMarkerPercent,
  fitGanttRangeToProject,
  formatDelayLabel,
  formatGanttViewportLabel,
  buildRichTimelineHeader,
  getTaskBarAriaLabel,
  getZoomStepDays,
  inclusiveDaySpan,
  isUtcWeekend,
  jumpGanttRangeToToday,
  parseGanttDate,
  rezoomPreservingFocal,
  shiftGanttRange,
  GANTT_MAX_VISIBLE_DAYS,
} from "./gantt";

test("zoom step days increase with coarser scales", () => {
  assert.equal(getZoomStepDays("day"), 7);
  assert.equal(getZoomStepDays("week"), 28);
  assert.equal(getZoomStepDays("month"), 90);
  assert.ok(GANTT_MAX_VISIBLE_DAYS.day <= GANTT_MAX_VISIBLE_DAYS.week);
  assert.ok(GANTT_MAX_VISIBLE_DAYS.week <= GANTT_MAX_VISIBLE_DAYS.month);
});

test("clampGanttRange enforces max visible days for day zoom", () => {
  const start = parseGanttDate("2026-01-01")!;
  const end = parseGanttDate("2028-01-01")!;
  const clamped = clampGanttRange({ start, end }, "day");
  assert.equal(inclusiveDaySpan(clamped), GANTT_MAX_VISIBLE_DAYS.day);
});

test("shiftGanttRange moves window by zoom step", () => {
  const start = parseGanttDate("2026-03-01")!;
  const end = parseGanttDate("2026-03-14")!;
  const next = shiftGanttRange({ start, end }, "day", 1);
  assert.equal(next.start.toISOString().slice(0, 10), "2026-03-08");
  assert.equal(next.end.toISOString().slice(0, 10), "2026-03-21");
});

test("jumpGanttRangeToToday centers the current day", () => {
  const start = parseGanttDate("2026-01-01")!;
  const end = parseGanttDate("2026-01-14")!;
  const jumped = jumpGanttRangeToToday(
    { start, end },
    "day",
    parseGanttDate("2026-06-15")!,
  );
  assert.equal(inclusiveDaySpan(jumped), 14);
  const todayPercent = computeTodayMarkerPercent(
    jumped,
    parseGanttDate("2026-06-15")!,
  );
  assert.ok(todayPercent !== null);
  assert.ok(todayPercent! >= 0 && todayPercent! <= 100);
});

test("fitGanttRangeToProject uses task dates with padding", () => {
  const range = fitGanttRangeToProject({
    taskStarts: ["2026-04-10", null],
    taskEnds: ["2026-04-20"],
    zoom: "day",
    paddingDays: 1,
  });
  assert.equal(range.start.toISOString().slice(0, 10), "2026-04-09");
  assert.equal(range.end.toISOString().slice(0, 10), "2026-04-21");
});

test("computeBarPosition places bars within the visible range", () => {
  const range = {
    start: parseGanttDate("2026-01-01")!,
    end: parseGanttDate("2026-01-10")!,
  };
  const bar = computeBarPosition(range, "2026-01-03", "2026-01-05");
  assert.ok(bar);
  assert.ok(Math.abs(bar!.leftPercent - 20) < 0.01);
  assert.ok(Math.abs(bar!.widthPercent - 30) < 0.01);
});

test("computeBarPosition returns null for unscheduled tasks", () => {
  const range = {
    start: parseGanttDate("2026-01-01")!,
    end: parseGanttDate("2026-01-10")!,
  };
  assert.equal(computeBarPosition(range, null, null), null);
});

test("computeTodayMarkerPercent is null outside range", () => {
  const range = {
    start: parseGanttDate("2026-01-01")!,
    end: parseGanttDate("2026-01-10")!,
  };
  assert.equal(
    computeTodayMarkerPercent(range, parseGanttDate("2026-02-01")!),
    null,
  );
  assert.equal(
    computeTodayMarkerPercent(range, parseGanttDate("2026-01-01")!),
    0,
  );
});

test("formatDelayLabel covers delayed and completed-late copy", () => {
  assert.equal(
    formatDelayLabel({ isDelayed: true, delayDays: 3 }),
    "Delayed 3 days",
  );
  assert.equal(
    formatDelayLabel({ isDelayed: true, delayDays: 1 }),
    "Delayed 1 day",
  );
  assert.equal(
    formatDelayLabel({
      isDelayed: false,
      isCompletedLate: true,
      delayDays: 2,
    }),
    "Completed 2 days late",
  );
  assert.equal(
    formatDelayLabel({ isDelayed: false, isCompletedLate: false }),
    "On schedule",
  );
});

test("FO-115 viewport label and weekend detection", () => {
  const range = {
    start: parseGanttDate("2026-08-10")!,
    end: parseGanttDate("2026-08-20")!,
  };
  assert.match(formatGanttViewportLabel(range), /Aug/);
  assert.match(formatGanttViewportLabel(range), /2026/);
  assert.equal(isUtcWeekend(parseGanttDate("2026-08-15")!), true); // Saturday
  assert.equal(isUtcWeekend(parseGanttDate("2026-08-10")!), false); // Monday
});

test("FO-115 rich day header includes weekday and weekend flags", () => {
  const range = {
    start: parseGanttDate("2026-08-10")!,
    end: parseGanttDate("2026-08-16")!,
  };
  const { bands, cells } = buildRichTimelineHeader(range, "day");
  assert.ok(bands.length >= 1);
  assert.equal(cells.length, 7);
  assert.ok(cells[0]!.subLabel);
  assert.ok(cells.some((cell) => cell.isWeekend));
});

test("FO-115 week and month headers produce ranged cells", () => {
  const range = {
    start: parseGanttDate("2026-08-01")!,
    end: parseGanttDate("2026-09-30")!,
  };
  const week = buildRichTimelineHeader(range, "week");
  assert.ok(week.cells.length >= 4);
  assert.match(week.cells[0]!.label, /–/);
  const month = buildRichTimelineHeader(range, "month");
  assert.ok(month.cells.length >= 2);
  assert.match(month.cells[0]!.label, /2026/);
});

test("FO-115 rezoom preserves focal date roughly", () => {
  const range = {
    start: parseGanttDate("2026-08-01")!,
    end: parseGanttDate("2026-08-21")!,
  };
  const rezoomed = rezoomPreservingFocal(range, "month");
  const mid = parseGanttDate("2026-08-11")!;
  assert.ok(rezoomed.start <= mid);
  assert.ok(rezoomed.end >= mid);
});

test("FO-115 task bar aria label distinguishes milestone", () => {
  const normal = getTaskBarAriaLabel({
    task_code: "T1",
    name: "Inspect",
    status: "not_started",
    planned_start: "2026-08-10",
    planned_end: "2026-08-10",
    progress_percentage: 0,
    is_milestone: false,
  });
  assert.match(normal, /^Task /);
  assert.doesNotMatch(normal, /Milestone T1/);
  const ms = getTaskBarAriaLabel({
    task_code: "T2",
    name: "Approved",
    status: "not_started",
    planned_start: "2026-08-14",
    planned_end: "2026-08-14",
    progress_percentage: 0,
    is_milestone: true,
  });
  assert.match(ms, /^Milestone /);
});
