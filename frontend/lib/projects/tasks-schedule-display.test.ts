import assert from "node:assert/strict";
import test from "node:test";

import {
  PROJECT_TASK_LIST_SCHEDULE_COLUMN_HEADER,
  formatProjectScheduleContextLabel,
  formatTaskPlannedScheduleLabel,
  getProjectTaskListLayoutClasses,
} from "./tasks-display";

test("FO-117 Planned Schedule column header replaces Planned End-only wording", () => {
  assert.equal(PROJECT_TASK_LIST_SCHEDULE_COLUMN_HEADER, "Planned schedule");
  assert.notEqual(PROJECT_TASK_LIST_SCHEDULE_COLUMN_HEADER, "Planned end");
  assert.equal(/planned end/i.test(PROJECT_TASK_LIST_SCHEDULE_COLUMN_HEADER), false);
});

test("FO-117 multi-day Task planned schedule uses compact range", () => {
  assert.equal(
    formatTaskPlannedScheduleLabel({
      planned_start: "2026-08-09",
      planned_end: "2026-08-10",
      is_milestone: false,
    }),
    "Aug 9 – Aug 10",
  );
  assert.equal(
    formatTaskPlannedScheduleLabel({
      planned_start: "2026-08-15",
      planned_end: "2026-08-20",
    }),
    "Aug 15 – Aug 20",
  );
});

test("FO-117 same-day non-milestone Task shows a single day", () => {
  assert.equal(
    formatTaskPlannedScheduleLabel({
      planned_start: "2026-08-13",
      planned_end: "2026-08-13",
      is_milestone: false,
    }),
    "Aug 13",
  );
  assert.equal(
    /Milestone/i.test(
      formatTaskPlannedScheduleLabel({
        planned_start: "2026-08-13",
        planned_end: "2026-08-13",
        is_milestone: false,
      }),
    ),
    false,
  );
});

test("FO-117 unscheduled Task shows Unscheduled", () => {
  assert.equal(
    formatTaskPlannedScheduleLabel({
      planned_start: null,
      planned_end: null,
    }),
    "Unscheduled",
  );
  assert.equal(
    formatTaskPlannedScheduleLabel({
      planned_start: "",
      planned_end: "",
    }),
    "Unscheduled",
  );
});

test("FO-117 explicit Milestone shows Milestone date context", () => {
  assert.equal(
    formatTaskPlannedScheduleLabel({
      planned_start: "2026-08-23",
      planned_end: "2026-08-23",
      is_milestone: true,
    }),
    "Milestone · Aug 23",
  );
});

test("FO-117 same-day normal Task is not labeled Milestone", () => {
  const label = formatTaskPlannedScheduleLabel({
    planned_start: "2026-08-13",
    planned_end: "2026-08-13",
    is_milestone: false,
  });
  assert.equal(label, "Aug 13");
  assert.ok(!label.toLowerCase().includes("milestone"));
});

test("FO-117 partial schedule is defensive and does not crash", () => {
  assert.equal(
    formatTaskPlannedScheduleLabel({
      planned_start: "2026-08-09",
      planned_end: null,
    }),
    "Incomplete schedule",
  );
  assert.equal(
    formatTaskPlannedScheduleLabel({
      planned_start: null,
      planned_end: "2026-08-10",
    }),
    "Incomplete schedule",
  );
});

test("FO-117 Project schedule context formats Project planned range", () => {
  const label = formatProjectScheduleContextLabel({
    planned_start_date: "2026-08-09",
    planned_end_date: "2026-08-27",
  });
  assert.match(label, /Aug/);
  assert.match(label, /9/);
  assert.match(label, /27/);
  assert.match(label, /–/);
});

test("FO-117 Project schedule context handles missing Project dates", () => {
  assert.equal(
    formatProjectScheduleContextLabel({
      planned_start_date: null,
      planned_end_date: null,
    }),
    "Not set",
  );
});

test("FO-117 mobile Task list layout remains table/card responsive", () => {
  const classes = getProjectTaskListLayoutClasses();
  assert.match(classes.tableWrapper, /hidden/);
  assert.match(classes.tableWrapper, /md:block/);
  assert.match(classes.cardsWrapper, /md:hidden/);
});

test("FO-117 Repainting sample Task schedules render as full ranges", () => {
  const samples = [
    ["2026-08-09", "2026-08-10", "Aug 9 – Aug 10"],
    ["2026-08-10", "2026-08-12", "Aug 10 – Aug 12"],
    ["2026-08-13", "2026-08-14", "Aug 13 – Aug 14"],
    ["2026-08-15", "2026-08-20", "Aug 15 – Aug 20"],
    ["2026-08-21", "2026-08-22", "Aug 21 – Aug 22"],
  ] as const;

  for (const [start, end, expected] of samples) {
    assert.equal(
      formatTaskPlannedScheduleLabel({
        planned_start: start,
        planned_end: end,
        is_milestone: false,
      }),
      expected,
    );
  }
});
