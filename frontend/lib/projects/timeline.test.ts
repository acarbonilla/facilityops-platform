import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/services/api/types";

import {
  canViewProjectTimeline,
  DEFAULT_PROJECT_TIMELINE_LIST_FILTERS,
  formatProjectTimelineCategoryLabel,
  formatProjectTimelineError,
  formatTimelineMetadataValue,
  serializeProjectTimelineListParams,
} from "./timeline";

test("timeline category labels cover FO-106 event categories", () => {
  assert.equal(formatProjectTimelineCategoryLabel("task"), "Task");
  assert.equal(formatProjectTimelineCategoryLabel("issue"), "Issue");
  assert.equal(formatProjectTimelineCategoryLabel("note"), "Note");
  assert.equal(formatProjectTimelineCategoryLabel("dependency"), "Dependency");
});

test("serializeProjectTimelineListParams maps filters to API query params", () => {
  const params = serializeProjectTimelineListParams(
    {
      ...DEFAULT_PROJECT_TIMELINE_LIST_FILTERS,
      search: " note ",
      category: "issue",
      eventType: "issue_created",
      actor: "user-1",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      sort: "timestamp",
      pageSize: 50,
    },
    2,
  );

  assert.deepEqual(params, {
    page: 2,
    page_size: 50,
    search: "note",
    category: "issue",
    event_type: "issue_created",
    actor: "user-1",
    date_from: "2026-01-01",
    date_to: "2026-12-31",
    ordering: "timestamp",
  });
});

test("serializeProjectTimelineListParams prefers debounced search", () => {
  const params = serializeProjectTimelineListParams(
    {
      ...DEFAULT_PROJECT_TIMELINE_LIST_FILTERS,
      search: "stale",
      category: "",
    },
    1,
    "  HVAC  ",
  );

  assert.equal(params.search, "HVAC");
  assert.equal(params.category, undefined);
  assert.equal(params.ordering, "-timestamp");
});

test("timeline permission helper accepts timeline view or project aliases", () => {
  const allow = (codes: string[]) => (code: string) => codes.includes(code);

  assert.equal(canViewProjectTimeline(allow(["projects.timeline.view"])), true);
  assert.equal(canViewProjectTimeline(allow(["projects.view"])), true);
  assert.equal(canViewProjectTimeline(allow(["projects.manage"])), true);
  assert.equal(canViewProjectTimeline(allow(["projects.notes.view"])), false);
});

test("timeline metadata formatter stringifies nested values", () => {
  assert.equal(formatTimelineMetadataValue(null), "—");
  assert.equal(formatTimelineMetadataValue(true), "Yes");
  assert.equal(formatTimelineMetadataValue({ a: 1 }), '{"a":1}');
});

test("timeline error formatting handles API statuses", () => {
  assert.match(
    formatProjectTimelineError(new ApiError("forbidden", 403), "fallback"),
    /permission/i,
  );
});
