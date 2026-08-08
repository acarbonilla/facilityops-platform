import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProjectFormDefaults,
  mapProjectFormValuesToCreatePayload,
  validateProjectDateRanges,
} from "./form";

function buildValues() {
  return {
    ...buildProjectFormDefaults(null),
    organization: "organization-1",
    name: "Lobby Renovation",
    description: "Facility upgrade project",
  };
}

test("project create payload omits tenant and empty optionals become null", () => {
  const payload = mapProjectFormValuesToCreatePayload({
    ...buildValues(),
    building: "  ",
    project_code: "",
    project_manager: "",
    planned_start_date: "",
    planned_end_date: "  ",
  });

  assert.equal("tenant" in payload, false);
  assert.equal("completion_percentage" in payload, false);
  assert.equal(payload.organization, "organization-1");
  assert.equal(payload.building, null);
  assert.equal(payload.project_manager, null);
  assert.equal(payload.planned_start_date, null);
  assert.equal(payload.planned_end_date, null);
  assert.equal(payload.project_code, undefined);
});

test("project date validation rejects end before start", () => {
  const errors = validateProjectDateRanges({
    ...buildValues(),
    planned_start_date: "2026-09-01",
    planned_end_date: "2026-08-01",
    actual_start_date: "2026-09-10",
    actual_end_date: "2026-09-01",
  });

  assert.match(errors.planned_end_date ?? "", /planned start/i);
  assert.match(errors.actual_end_date ?? "", /actual start/i);
});

test("project date validation accepts equal and ordered ranges", () => {
  const errors = validateProjectDateRanges({
    ...buildValues(),
    planned_start_date: "2026-09-01",
    planned_end_date: "2026-09-01",
    actual_start_date: "2026-09-02",
    actual_end_date: "2026-09-10",
  });

  assert.equal(errors.planned_end_date, undefined);
  assert.equal(errors.actual_end_date, undefined);
});

test("project form defaults omit tenant and completion fields", () => {
  const defaults = buildProjectFormDefaults({
    id: "user-1",
    email: "pm@example.com",
    first_name: "A",
    last_name: "Lee",
    tenant: "tenant-1",
    organization: "organization-1",
    is_staff: false,
  });

  assert.equal("tenant" in defaults, false);
  assert.equal("completion_percentage" in defaults, false);
  assert.equal(defaults.organization, "organization-1");
  assert.equal(defaults.status, "draft");
  assert.equal(defaults.priority, "medium");
});
