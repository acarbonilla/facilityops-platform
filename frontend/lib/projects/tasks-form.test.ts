import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProjectTaskFormDefaults,
  mapProjectTaskFormValuesToCreatePayload,
  validateProjectTaskFormValues,
} from "./tasks-form";

function buildValues() {
  return {
    ...buildProjectTaskFormDefaults(),
    name: "Install sensors",
    description: "Lobby sensor install",
  };
}

test("task create payload omits empty optionals as null", () => {
  const payload = mapProjectTaskFormValuesToCreatePayload({
    ...buildValues(),
    person_in_charge: "  ",
    planned_start: "",
    planned_end: "  ",
    progress_percentage: "25",
    sequence: "3",
  });

  assert.equal(payload.name, "Install sensors");
  assert.equal(payload.person_in_charge, null);
  assert.equal(payload.planned_start, null);
  assert.equal(payload.planned_end, null);
  assert.equal(payload.progress_percentage, 25);
  assert.equal(payload.sequence, 3);
  assert.equal(payload.is_milestone, false);
});

test("task date validation rejects end before start", () => {
  const errors = validateProjectTaskFormValues({
    ...buildValues(),
    planned_start: "2026-09-01",
    planned_end: "2026-08-01",
    actual_start: "2026-09-10",
    actual_end: "2026-09-01",
  });

  assert.match(errors.planned_end ?? "", /planned start/i);
  assert.match(errors.actual_end ?? "", /actual start/i);
});

test("task progress validation rejects out of range values", () => {
  const errors = validateProjectTaskFormValues({
    ...buildValues(),
    progress_percentage: "120",
  });

  assert.match(errors.progress_percentage ?? "", /0 and 100/i);
});

test("task assignment is required before in_progress or completed", () => {
  const inProgress = validateProjectTaskFormValues({
    ...buildValues(),
    status: "in_progress",
    person_in_charge: "",
  });
  assert.match(inProgress.person_in_charge ?? "", /person in charge/i);

  const completed = validateProjectTaskFormValues({
    ...buildValues(),
    status: "completed",
    person_in_charge: "",
  });
  assert.match(completed.person_in_charge ?? "", /person in charge/i);

  const ok = validateProjectTaskFormValues({
    ...buildValues(),
    status: "in_progress",
    person_in_charge: "user-1",
  });
  assert.equal(ok.person_in_charge, undefined);
});

test("task form defaults start as not_started with zero progress", () => {
  const defaults = buildProjectTaskFormDefaults();
  assert.equal(defaults.status, "not_started");
  assert.equal(defaults.priority, "medium");
  assert.equal(defaults.progress_percentage, "0");
  assert.equal(defaults.person_in_charge, "");
  assert.equal(defaults.is_milestone, false);
});

test("FO-114 planned schedule is optional and empty dates are allowed", () => {
  const errors = validateProjectTaskFormValues({
    ...buildValues(),
    planned_start: "",
    planned_end: "",
    is_milestone: false,
  });
  assert.equal(errors.planned_start, undefined);
  assert.equal(errors.planned_end, undefined);
});

test("FO-114 same-day task dates are allowed for normal tasks", () => {
  const errors = validateProjectTaskFormValues({
    ...buildValues(),
    planned_start: "2026-08-10",
    planned_end: "2026-08-10",
    is_milestone: false,
  });
  assert.equal(errors.planned_start, undefined);
  assert.equal(errors.planned_end, undefined);
});

test("FO-114 partial planned schedule is rejected", () => {
  const startOnly = validateProjectTaskFormValues({
    ...buildValues(),
    planned_start: "2026-08-11",
    planned_end: "",
  });
  assert.match(startOnly.planned_end ?? "", /both/i);

  const endOnly = validateProjectTaskFormValues({
    ...buildValues(),
    planned_start: "",
    planned_end: "2026-08-12",
  });
  assert.match(endOnly.planned_end ?? "", /both/i);
});

test("FO-114 milestone checkbox defaults false and requires a date", () => {
  assert.equal(buildProjectTaskFormDefaults().is_milestone, false);
  const errors = validateProjectTaskFormValues({
    ...buildValues(),
    is_milestone: true,
    planned_start: "",
    planned_end: "",
  });
  assert.match(errors.planned_start ?? "", /milestone date/i);
});

test("FO-114 milestone sanitize persists start equals end", () => {
  const payload = mapProjectTaskFormValuesToCreatePayload({
    ...buildValues(),
    is_milestone: true,
    planned_start: "2026-08-14",
    planned_end: "",
  });
  assert.equal(payload.is_milestone, true);
  assert.equal(payload.planned_start, "2026-08-14");
  assert.equal(payload.planned_end, "2026-08-14");
});
