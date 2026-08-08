import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PROJECT_TASK_LIST_FILTERS,
  serializeProjectTaskListParams,
} from "./tasks-filters";

test("serializeProjectTaskListParams maps filters to API query params", () => {
  const params = serializeProjectTaskListParams(
    {
      ...DEFAULT_PROJECT_TASK_LIST_FILTERS,
      search: " install ",
      status: "in_progress",
      priority: "high",
      personInCharge: "user-1",
      isMilestone: "true",
      plannedStartFrom: "2026-01-01",
      plannedStartTo: "2026-06-30",
      plannedEndFrom: "2026-07-01",
      plannedEndTo: "2026-12-31",
      progressMin: "10",
      progressMax: "90",
      sort: "-priority",
      pageSize: 50,
    },
    2,
  );

  assert.deepEqual(params, {
    page: 2,
    page_size: 50,
    search: "install",
    status: "in_progress",
    priority: "high",
    person_in_charge: "user-1",
    is_milestone: true,
    planned_start_from: "2026-01-01",
    planned_start_to: "2026-06-30",
    planned_end_from: "2026-07-01",
    planned_end_to: "2026-12-31",
    progress_min: "10",
    progress_max: "90",
    ordering: "-priority",
  });
});

test("serializeProjectTaskListParams prefers debounced search and drops empties", () => {
  const params = serializeProjectTaskListParams(
    {
      ...DEFAULT_PROJECT_TASK_LIST_FILTERS,
      search: "stale",
      status: "",
      priority: "",
      isMilestone: "",
    },
    1,
    "  HVAC  ",
  );

  assert.equal(params.search, "HVAC");
  assert.equal(params.status, undefined);
  assert.equal(params.priority, undefined);
  assert.equal(params.is_milestone, undefined);
  assert.equal(params.page, 1);
  assert.equal(params.page_size, 20);
  assert.equal(params.ordering, "sequence");
});

test("serializeProjectTaskListParams maps false milestone filter", () => {
  const params = serializeProjectTaskListParams(
    {
      ...DEFAULT_PROJECT_TASK_LIST_FILTERS,
      isMilestone: "false",
    },
    1,
  );

  assert.equal(params.is_milestone, false);
});

test("serializeProjectTaskListParams maps FO-105 schedule filters", () => {
  const params = serializeProjectTaskListParams(
    {
      ...DEFAULT_PROJECT_TASK_LIST_FILTERS,
      delayed: "true",
      dependencyBlocked: "false",
      unscheduled: "true",
    },
    1,
  );

  assert.equal(params.delayed, true);
  assert.equal(params.dependency_blocked, false);
  assert.equal(params.unscheduled, true);
});
