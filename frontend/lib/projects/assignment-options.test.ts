import assert from "node:assert/strict";
import test from "node:test";

import {
  createAssignmentOptionFallback,
  formatAssignmentOptionLabel,
  mergeAssignmentOptions,
} from "./assignment-options";

test("FO-115C assignment option label includes name role email", () => {
  assert.equal(
    formatAssignmentOptionLabel({
      id: "1",
      email: "jane@example.com",
      display_name: "Jane Technician",
      first_name: "Jane",
      last_name: "Technician",
      role_label: "Technician",
      is_active: true,
    }),
    "Jane Technician · Technician · jane@example.com",
  );
});

test("FO-115C fallback and merge keep selected identity", () => {
  const selected = createAssignmentOptionFallback({
    id: "pm-1",
    email: "john@example.com",
    displayName: "John Manager",
    roleLabel: "Facility Manager",
  });
  assert.ok(selected);
  const merged = mergeAssignmentOptions(
    [
      {
        id: "t-1",
        email: "tech@example.com",
        display_name: "Tech",
        first_name: "Tech",
        last_name: "",
        role_label: "Technician",
        is_active: true,
      },
    ],
    selected,
  );
  assert.equal(merged[0]?.id, "pm-1");
  assert.equal(merged.length, 2);
});

test("FO-115C manager identity uses Facility Manager role label", () => {
  assert.equal(
    formatAssignmentOptionLabel({
      id: "2",
      email: "john@example.com",
      display_name: "John Manager",
      first_name: "John",
      last_name: "Manager",
      role_label: "Facility Manager",
      is_active: true,
    }),
    "John Manager · Facility Manager · john@example.com",
  );
});

test("FO-115C empty fallback id yields null", () => {
  assert.equal(createAssignmentOptionFallback({ id: null }), null);
  assert.equal(createAssignmentOptionFallback({ id: "" }), null);
});
