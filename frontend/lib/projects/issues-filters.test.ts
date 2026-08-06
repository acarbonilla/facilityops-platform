import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PROJECT_ISSUE_LIST_FILTERS,
  serializeProjectIssueListParams,
} from "./issues-filters";

test("serializeProjectIssueListParams maps filters to API query params", () => {
  const params = serializeProjectIssueListParams(
    {
      ...DEFAULT_PROJECT_ISSUE_LIST_FILTERS,
      search: " leak ",
      status: "open",
      severity: "high",
      owner: "user-1",
      dueDateFrom: "2026-01-01",
      dueDateTo: "2026-06-30",
      sort: "due_date",
      pageSize: 50,
    },
    2,
  );

  assert.deepEqual(params, {
    page: 2,
    page_size: 50,
    search: "leak",
    status: "open",
    severity: "high",
    owner: "user-1",
    due_date_from: "2026-01-01",
    due_date_to: "2026-06-30",
    ordering: "due_date",
  });
});

test("serializeProjectIssueListParams prefers debounced search and drops empties", () => {
  const params = serializeProjectIssueListParams(
    {
      ...DEFAULT_PROJECT_ISSUE_LIST_FILTERS,
      search: "stale",
      status: "",
      severity: "",
    },
    1,
    "  HVAC  ",
  );

  assert.equal(params.search, "HVAC");
  assert.equal(params.status, undefined);
  assert.equal(params.severity, undefined);
  assert.equal(params.ordering, "-updated_at");
});
