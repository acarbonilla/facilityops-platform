import assert from "node:assert/strict";
import test from "node:test";

import {
  getCalendarDaySpan,
  getDefaultReportingDateRange,
  isValidDateOnly,
  REPORTING_MAX_RANGE_DAYS,
  toReportingApiDateBounds,
  validateReportingDateRange,
} from "./dates";

test("default reporting range covers the most recent 90 calendar days", () => {
  const reference = new Date(2026, 6, 16, 15, 30, 0);
  const range = getDefaultReportingDateRange(reference);

  assert.equal(range.dateTo, "2026-07-16");
  assert.equal(range.dateFrom, "2026-04-17");
  assert.equal(getCalendarDaySpan(range.dateFrom, range.dateTo), 90);
});

test("date-only validation rejects impossible dates and supports leap years", () => {
  assert.equal(isValidDateOnly("2024-02-29"), true);
  assert.equal(isValidDateOnly("2023-02-29"), false);
  assert.equal(isValidDateOnly("2026-02-30"), false);
  assert.equal(isValidDateOnly("2026-99-99"), false);
  assert.equal(isValidDateOnly("2026-7-16"), false);
});

test("date from after date to is rejected", () => {
  assert.equal(validateReportingDateRange("2026-07-16", "2026-07-15"), "reversed");
  assert.equal(toReportingApiDateBounds("2026-07-16", "2026-07-15"), null);
});

test("exact 180-day calendar range is accepted as date-only without clamp", () => {
  const dateFrom = "2026-01-16";
  const dateTo = "2026-07-15";
  assert.equal(getCalendarDaySpan(dateFrom, dateTo), REPORTING_MAX_RANGE_DAYS);
  assert.equal(validateReportingDateRange(dateFrom, dateTo), null);

  const bounds = toReportingApiDateBounds(dateFrom, dateTo);
  assert.deepEqual(bounds, {
    date_from: "2026-01-16",
    date_to: "2026-07-15",
  });
  assert.equal(bounds!.date_from.includes("T"), false);
  assert.equal(bounds!.date_to.includes("T"), false);
});

test("over-180-day range is rejected", () => {
  assert.equal(
    validateReportingDateRange("2026-01-15", "2026-07-15"),
    "exceeds_max",
  );
  assert.equal(toReportingApiDateBounds("2026-01-15", "2026-07-15"), null);
});

test("malformed and blank dates are rejected", () => {
  assert.equal(validateReportingDateRange("", "2026-07-16"), "blank");
  assert.equal(validateReportingDateRange("2026-07-16", " "), "blank");
  assert.equal(validateReportingDateRange("2026-13-40", "2026-07-16"), "malformed");
  assert.equal(toReportingApiDateBounds("2026-07-32", "2026-07-16"), null);
  assert.equal(toReportingApiDateBounds("not-a-date", "2026-07-16"), null);
});

test("reporting API bounds remain date-only and never use browser ISO conversion", () => {
  const bounds = toReportingApiDateBounds("2026-03-15", "2026-03-15");
  assert.deepEqual(bounds, {
    date_from: "2026-03-15",
    date_to: "2026-03-15",
  });
  assert.match(bounds!.date_from, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(bounds!.date_to, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(bounds!.date_from.includes("Z"), false);
  assert.equal(bounds!.date_to.includes("Z"), false);
});

test("same-day and leap-day ranges remain valid", () => {
  assert.equal(validateReportingDateRange("2026-07-16", "2026-07-16"), null);
  assert.deepEqual(toReportingApiDateBounds("2024-02-29", "2024-02-29"), {
    date_from: "2024-02-29",
    date_to: "2024-02-29",
  });
  assert.equal(toReportingApiDateBounds("2023-02-29", "2023-03-01"), null);
});
