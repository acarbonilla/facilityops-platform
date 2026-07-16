import assert from "node:assert/strict";
import test from "node:test";

import {
  getCalendarDaySpan,
  getDefaultReportingDateRange,
  isValidDateOnly,
  REPORTING_MAX_RANGE_DAYS,
  toLocalEndOfDayIso,
  toLocalStartOfDayIso,
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

test("local start-of-day conversion preserves the selected local calendar day", () => {
  const iso = toLocalStartOfDayIso("2026-07-16");
  assert.ok(iso);
  const parsed = new Date(iso!);
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 6);
  assert.equal(parsed.getDate(), 16);
  assert.equal(parsed.getHours(), 0);
  assert.equal(parsed.getMinutes(), 0);
  assert.equal(parsed.getSeconds(), 0);
  assert.equal(parsed.getMilliseconds(), 0);
  assert.ok(!iso!.endsWith("Z") || iso!.includes("T"));
});

test("local end-of-day conversion preserves the selected local calendar day", () => {
  const iso = toLocalEndOfDayIso("2026-07-16");
  assert.ok(iso);
  const parsed = new Date(iso!);
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 6);
  assert.equal(parsed.getDate(), 16);
  assert.equal(parsed.getHours(), 23);
  assert.equal(parsed.getMinutes(), 59);
  assert.equal(parsed.getSeconds(), 59);
  assert.equal(parsed.getMilliseconds(), 999);
});

test("date from after date to is rejected", () => {
  assert.equal(validateReportingDateRange("2026-07-16", "2026-07-15"), "reversed");
  assert.equal(toReportingApiDateBounds("2026-07-16", "2026-07-15"), null);
});

test("exact 180-day calendar range is accepted and stays within backend max span", () => {
  const dateFrom = "2026-01-16";
  const dateTo = "2026-07-15";
  assert.equal(getCalendarDaySpan(dateFrom, dateTo), REPORTING_MAX_RANGE_DAYS);
  assert.equal(validateReportingDateRange(dateFrom, dateTo), null);

  const bounds = toReportingApiDateBounds(dateFrom, dateTo);
  assert.ok(bounds);
  const spanDays =
    (new Date(bounds!.date_to).getTime() -
      new Date(bounds!.date_from).getTime()) /
    86_400_000;
  assert.ok(spanDays <= REPORTING_MAX_RANGE_DAYS);
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
  assert.equal(toLocalStartOfDayIso("2026-07-32"), null);
  assert.equal(toLocalEndOfDayIso("not-a-date"), null);
});

test("naive YYYY-MM-DD values are not treated as UTC midnight", () => {
  const iso = toLocalStartOfDayIso("2026-03-15");
  assert.ok(iso);
  // Appending Z to the local date string would shift the calendar day in many zones.
  const naiveUtc = new Date("2026-03-15T00:00:00.000Z");
  const localStart = new Date(iso!);
  assert.notEqual(localStart.getTime(), naiveUtc.getTime());
  assert.equal(localStart.getDate(), 15);
  assert.equal(localStart.getMonth(), 2);
});
