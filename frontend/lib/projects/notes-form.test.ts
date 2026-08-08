import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProjectNoteFormDefaults,
  mapProjectNoteFormValuesToCreatePayload,
  validateProjectNoteFormValues,
} from "./notes-form";

test("note create payload trims fields and keeps category", () => {
  const payload = mapProjectNoteFormValuesToCreatePayload({
    ...buildProjectNoteFormDefaults(),
    title: "  Kickoff  ",
    note: "  Discussed scope.  ",
    category: "meeting",
  });

  assert.equal(payload.title, "Kickoff");
  assert.equal(payload.note, "Discussed scope.");
  assert.equal(payload.category, "meeting");
});

test("note validation requires title and body", () => {
  const errors = validateProjectNoteFormValues({
    ...buildProjectNoteFormDefaults(),
    title: "  ",
    note: "",
  });

  assert.match(errors.title ?? "", /required/i);
  assert.match(errors.note ?? "", /required/i);
});
