import assert from "node:assert/strict";
import test from "node:test";

import {
  formatActualExecutionRangeLabel,
  formatActualEndLabel,
  formatActualStartLabel,
  formatExecutionScheduleStatusLabel,
  formatScheduleStatusSummary,
  formatVarianceDaysLabel,
  resolveActualBarEnd,
} from "./execution-variance";

test("FO-115B variance day labels", () => {
  assert.equal(formatVarianceDaysLabel(null, "start"), "Not available");
  assert.equal(formatVarianceDaysLabel(0, "start"), "Started on time");
  assert.equal(formatVarianceDaysLabel(-1, "start"), "Started 1 day early");
  assert.equal(formatVarianceDaysLabel(2, "start"), "Started 2 days late");
  assert.equal(
    formatVarianceDaysLabel(-1, "completion"),
    "Completed 1 day early",
  );
  assert.equal(
    formatVarianceDaysLabel(0, "completion"),
    "Completed on time",
  );
  assert.equal(
    formatVarianceDaysLabel(2, "completion"),
    "Completed 2 days late",
  );
});

test("FO-115B execution status labels", () => {
  assert.equal(
    formatExecutionScheduleStatusLabel("in_progress_past_due"),
    "Running past planned end",
  );
  assert.equal(
    formatExecutionScheduleStatusLabel("completed_late"),
    "Completed late",
  );
  assert.equal(formatActualStartLabel(null), "Not started");
  assert.equal(formatActualEndLabel(null), "Not completed");
  assert.equal(
    formatActualEndLabel(null, { stillInProgress: true }),
    "Still in progress",
  );
});

test("FO-115B actual range and bar end", () => {
  assert.equal(
    formatActualExecutionRangeLabel({ actual_start: null }),
    "Not started",
  );
  assert.equal(
    formatActualExecutionRangeLabel({
      actual_start: "2026-08-12",
      actual_end: "2026-08-16",
    }),
    "2026-08-12 – 2026-08-16",
  );
  assert.match(
    formatActualExecutionRangeLabel({
      actual_start: "2026-08-12",
      status: "in_progress",
    }),
    /Still in progress/,
  );
  assert.equal(
    resolveActualBarEnd({
      actual_start: "2026-08-12",
      status: "in_progress",
      todayIso: "2026-08-15",
    }),
    "2026-08-15",
  );
  assert.equal(
    resolveActualBarEnd({
      actual_start: "2026-08-12",
      actual_end: "2026-08-14",
      status: "completed",
    }),
    "2026-08-14",
  );
});

test("FO-115B schedule status summary", () => {
  assert.match(
    formatScheduleStatusSummary({
      execution_schedule_status: "in_progress_past_due",
      start_variance_days: 1,
      days_past_planned_end: 3,
    }),
    /overdue by 3 days/,
  );
  assert.equal(
    formatScheduleStatusSummary({
      execution_schedule_status: "completed_late",
      completion_variance_days: 1,
      is_milestone: true,
    }),
    "Milestone completed 1 day late",
  );
});
