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
});
