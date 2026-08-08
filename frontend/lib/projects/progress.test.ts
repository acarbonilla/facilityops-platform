import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/services/api/types";

import {
  buildProgressSparklinePoints,
  canRecalculateProjectProgress,
  canViewProjectProgress,
  clampProgressPercent,
  formatProgressPercent,
  formatProgressSourceLabel,
  formatProgressTrendLabel,
  formatProjectProgressError,
  formatScheduleElapsedLabel,
  parseProgressPercent,
} from "./progress";

test("parseProgressPercent and clamp handle decimals and bounds", () => {
  assert.equal(parseProgressPercent("65.00"), 65);
  assert.equal(parseProgressPercent(null), null);
  assert.equal(clampProgressPercent(-5), 0);
  assert.equal(clampProgressPercent(140), 100);
});

test("formatProgressPercent mirrors project completion formatting", () => {
  assert.equal(formatProgressPercent("50.00"), "50%");
  assert.equal(formatProgressPercent("33.33"), "33.33%");
  assert.equal(formatProgressPercent(null), "0%");
});

test("trend and source labels cover FO-107 vocabulary", () => {
  assert.equal(formatProgressTrendLabel("increased"), "Increased");
  assert.equal(formatProgressTrendLabel("decreased"), "Decreased");
  assert.equal(formatProgressTrendLabel("unchanged"), "Unchanged");
  assert.equal(
    formatProgressSourceLabel("manual_recalculation"),
    "Manual recalculation",
  );
  assert.equal(
    formatProgressSourceLabel("task_progress_changed"),
    "Task progress changed",
  );
});

test("formatScheduleElapsedLabel distinguishes missing schedule", () => {
  assert.equal(
    formatScheduleElapsedLabel(null),
    "Schedule elapsed not available",
  );
  assert.equal(formatScheduleElapsedLabel("40.00"), "Schedule elapsed 40%");
});

test("buildProgressSparklinePoints maps oldest-to-newest percentages", () => {
  const geometry = buildProgressSparklinePoints(
    ["10", "50", "90"],
    100,
    20,
    0,
  );
  assert.equal(geometry.values.length, 3);
  assert.equal(geometry.coordinates.length, 3);
  assert.ok(geometry.points.includes(","));
  assert.equal(geometry.coordinates[0]?.x, 0);
  assert.equal(geometry.coordinates[2]?.x, 100);
  assert.ok(geometry.coordinates[0]!.y > geometry.coordinates[2]!.y);
});

test("buildProgressSparklinePoints returns empty geometry without values", () => {
  const geometry = buildProgressSparklinePoints([]);
  assert.equal(geometry.points, "");
  assert.equal(geometry.coordinates.length, 0);
});

test("progress permission helpers accept view and recalculate aliases", () => {
  const allow = (codes: string[]) => (code: string) => codes.includes(code);

  assert.equal(canViewProjectProgress(allow(["projects.progress.view"])), true);
  assert.equal(canViewProjectProgress(allow(["projects.view"])), true);
  assert.equal(canViewProjectProgress(allow(["projects.manage"])), true);
  assert.equal(canViewProjectProgress(allow(["projects.create"])), false);

  assert.equal(
    canRecalculateProjectProgress(allow(["projects.progress.recalculate"])),
    true,
  );
  assert.equal(
    canRecalculateProjectProgress(allow(["projects.manage"])),
    true,
  );
  assert.equal(
    canRecalculateProjectProgress(allow(["projects.progress.view"])),
    false,
  );
});

test("progress error formatting handles API statuses", () => {
  assert.equal(
    formatProjectProgressError(new ApiError("forbidden", 403), "fallback"),
    "Your account does not have permission for this progress action.",
  );
  assert.equal(
    formatProjectProgressError(new ApiError("missing", 404), "fallback"),
    "The requested project progress could not be found.",
  );
  assert.equal(
    formatProjectProgressError(new Error("boom"), "fallback"),
    "boom",
  );
});
