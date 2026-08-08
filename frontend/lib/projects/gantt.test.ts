import assert from "node:assert/strict";
import test from "node:test";

import {
  clampGanttRange,
  computeBarPosition,
  computeTodayMarkerPercent,
  fitGanttRangeToProject,
  formatDelayLabel,
  getZoomStepDays,
  inclusiveDaySpan,
  jumpGanttRangeToToday,
  parseGanttDate,
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
