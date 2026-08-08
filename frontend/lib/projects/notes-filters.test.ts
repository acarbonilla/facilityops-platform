import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PROJECT_NOTE_LIST_FILTERS,
  serializeProjectNoteListParams,
} from "./notes-filters";

test("serializeProjectNoteListParams maps filters to API query params", () => {
  const params = serializeProjectNoteListParams(
    {
      ...DEFAULT_PROJECT_NOTE_LIST_FILTERS,
      search: " kickoff ",
      category: "meeting",
      author: "user-1",
      sort: "title",
      pageSize: 50,
    },
    2,
  );

  assert.deepEqual(params, {
    page: 2,
    page_size: 50,
    search: "kickoff",
    category: "meeting",
    author: "user-1",
    ordering: "title",
  });
});

test("serializeProjectNoteListParams prefers debounced search and drops empties", () => {
  const params = serializeProjectNoteListParams(
    {
      ...DEFAULT_PROJECT_NOTE_LIST_FILTERS,
      search: "stale",
      category: "",
    },
    1,
    "  HVAC  ",
  );

  assert.equal(params.search, "HVAC");
  assert.equal(params.category, undefined);
  assert.equal(params.ordering, "-created_at");
});
