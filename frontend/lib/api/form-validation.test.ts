import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/services/api/types";

import {
  isExpectedFormApiError,
  normalizeFormValidationError,
} from "./form-validation";

test("FO-116 400 validation is expected and does not expose HTTP wording", () => {
  const error = new ApiError(
    "Task planned end must fall within the project planned schedule.",
    400,
    {
      message: "Task planned end must fall within the project planned schedule.",
      errors: {
        planned_end: [
          "Task planned end must fall within the project planned schedule.",
        ],
      },
    },
  );
  assert.equal(isExpectedFormApiError(error), true);
  const result = normalizeFormValidationError(error, {
    entityLabel: "Task",
    projectSchedule: {
      plannedStart: "2026-08-05",
      plannedEnd: "2026-08-15",
    },
  });
  assert.equal(result.kind, "validation");
  assert.equal(result.isExpected, true);
  assert.match(result.message, /Project schedule/i);
  assert.match(result.fieldErrors.planned_end ?? "", /on or before 2026-08-15/i);
  assert.doesNotMatch(result.message, /HTTP 400|Runtime ApiError|client\.ts/i);
});

test("FO-116 planned start violation uses project start context", () => {
  const error = new ApiError("outside project", 400, {
    message: "outside project",
    errors: {
      planned_start: [
        "Task planned start must fall within the project planned schedule.",
      ],
    },
  });
  const result = normalizeFormValidationError(error, {
    entityLabel: "Task",
    projectSchedule: {
      plannedStart: "2026-08-05",
      plannedEnd: "2026-08-15",
    },
  });
  assert.match(result.fieldErrors.planned_start ?? "", /on or after 2026-08-05/i);
});

test("FO-116 both-or-neither maps to clear schedule guidance", () => {
  const error = new ApiError("both required", 400, {
    message: "both required",
    errors: {
      non_field_errors: ["Provide both planned dates or leave both blank."],
    },
  });
  const result = normalizeFormValidationError(error, { entityLabel: "Task" });
  assert.match(result.message, /both Planned Start and Planned End/i);
});

test("FO-116 dependency conflict remains actionable", () => {
  const error = new ApiError("conflict", 400, {
    message: "conflict",
    errors: {
      task_schedule_dependency_conflict: [
        "Surface Preparation must finish before this Task can start.",
      ],
    },
  });
  const result = normalizeFormValidationError(error, { entityLabel: "Task" });
  assert.match(result.message, /predecessor/i);
  assert.match(result.message, /Surface Preparation/);
});

test("FO-116 invalid project manager and task PIC messages", () => {
  const pm = normalizeFormValidationError(
    new ApiError("bad pm", 400, {
      message: "bad pm",
      code: "invalid_project_manager",
      errors: {},
    }),
    { entityLabel: "Project" },
  );
  assert.equal(
    pm.fieldErrors.project_manager,
    "This user cannot be assigned as Project Manager.",
  );

  const pic = normalizeFormValidationError(
    new ApiError("bad pic", 400, {
      message: "bad pic",
      code: "invalid_task_pic",
      errors: {},
    }),
    { entityLabel: "Task" },
  );
  assert.equal(
    pic.fieldErrors.person_in_charge,
    "This user cannot be assigned as Person in Charge for this Task.",
  );
});

test("FO-116 403 404 and 5xx use safe application messages", () => {
  const forbidden = normalizeFormValidationError(
    new ApiError("nope", 403),
    { entityLabel: "Task" },
  );
  assert.equal(forbidden.kind, "forbidden");
  assert.match(forbidden.message, /permission/i);

  const missing = normalizeFormValidationError(
    new ApiError("gone", 404),
    { entityLabel: "Task" },
  );
  assert.equal(missing.kind, "not_found");

  const server = normalizeFormValidationError(
    new ApiError("boom", 500, { message: "SELECT * FROM secret_table" }),
    { entityLabel: "Task" },
  );
  assert.equal(server.kind, "server");
  assert.doesNotMatch(server.message, /SELECT|secret_table|stack/i);
  assert.match(server.message, /Try again/i);
});

test("FO-116 unexpected non-ApiError is not marked expected", () => {
  const result = normalizeFormValidationError(new Error("invariant failed"), {
    entityLabel: "Task",
  });
  assert.equal(result.isExpected, false);
  assert.equal(result.kind, "unexpected");
});
