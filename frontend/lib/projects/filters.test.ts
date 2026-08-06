import assert from "node:assert/strict";
import test from "node:test";

import {
  clearIncompatibleProjectBuilding,
  DEFAULT_PROJECT_LIST_FILTERS,
  serializeProjectListParams,
} from "./filters";

test("serializeProjectListParams maps filters to API query params", () => {
  const params = serializeProjectListParams(
    {
      ...DEFAULT_PROJECT_LIST_FILTERS,
      search: " lobby ",
      status: "in_progress",
      priority: "high",
      organization: "org-1",
      building: "bldg-1",
      projectManager: "user-1",
      plannedStartFrom: "2026-01-01",
      plannedStartTo: "2026-06-30",
      plannedEndFrom: "2026-07-01",
      plannedEndTo: "2026-12-31",
      sort: "-planned_end_date",
      pageSize: 50,
    },
    2,
  );

  assert.deepEqual(params, {
    page: 2,
    page_size: 50,
    search: "lobby",
    status: "in_progress",
    priority: "high",
    organization: "org-1",
    building: "bldg-1",
    project_manager: "user-1",
    planned_start_date_from: "2026-01-01",
    planned_start_date_to: "2026-06-30",
    planned_end_date_from: "2026-07-01",
    planned_end_date_to: "2026-12-31",
    ordering: "-planned_end_date",
  });
});

test("serializeProjectListParams prefers debounced search and drops empties", () => {
  const params = serializeProjectListParams(
    {
      ...DEFAULT_PROJECT_LIST_FILTERS,
      search: "stale",
      status: "",
      priority: "",
    },
    1,
    "  HVAC  ",
  );

  assert.equal(params.search, "HVAC");
  assert.equal(params.status, undefined);
  assert.equal(params.priority, undefined);
  assert.equal(params.page, 1);
  assert.equal(params.page_size, 20);
  assert.equal(params.ordering, "-updated");
});

test("clearIncompatibleProjectBuilding resets buildings outside organization", () => {
  const buildings = [
    { id: "b1", organization: "org-1" },
    { id: "b2", organization: "org-2" },
  ];

  assert.equal(clearIncompatibleProjectBuilding("org-1", "b1", buildings), "b1");
  assert.equal(clearIncompatibleProjectBuilding("org-1", "b2", buildings), "");
  assert.equal(clearIncompatibleProjectBuilding("", "b2", buildings), "b2");
});
