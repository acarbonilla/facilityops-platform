import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProjectIssueFormDefaults,
  mapProjectIssueFormValuesToCreatePayload,
  validateProjectIssueFormValues,
} from "./issues-form";

test("issue create payload omits empty optionals as null", () => {
  const payload = mapProjectIssueFormValuesToCreatePayload({
    ...buildProjectIssueFormDefaults(),
    title: "  Roof leak  ",
    description: "  North wing  ",
    owner: "  ",
    due_date: "",
    severity: "high",
    status: "open",
  });

  assert.equal(payload.title, "Roof leak");
  assert.equal(payload.description, "North wing");
  assert.equal(payload.owner, null);
  assert.equal(payload.due_date, null);
  assert.equal(payload.severity, "high");
  assert.equal(payload.status, "open");
});

test("issue validation requires title", () => {
  const errors = validateProjectIssueFormValues({
    ...buildProjectIssueFormDefaults(),
    title: "  ",
  });

  assert.match(errors.title ?? "", /required/i);
});
