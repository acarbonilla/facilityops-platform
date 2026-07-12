import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyCorrectiveActionFormValues,
  mapCorrectiveActionFormValuesToCreatePayload,
} from "./findings";
import { buildInspectionAssignPayload } from "./workflow";

test("inspection assignment preserves inspector and supervisor payload keys", () => {
  assert.deepEqual(
    buildInspectionAssignPayload("inspector-1", "supervisor-1", " Assigned "),
    {
      inspector: "inspector-1",
      supervisor: "supervisor-1",
      note: "Assigned",
    },
  );
});

test("inspection assignment retains at-least-one validation", () => {
  assert.equal(buildInspectionAssignPayload("", "", ""), null);
  assert.deepEqual(buildInspectionAssignPayload("inspector-1", null), {
    inspector: "inspector-1",
    supervisor: null,
    note: undefined,
  });
});

test("corrective-action assignment preserves UUID and clearing maps to null", () => {
  const values = {
    ...createEmptyCorrectiveActionFormValues("inspection-1"),
    finding: "finding-1",
    assigned_to: "user-1",
  };
  assert.equal(
    mapCorrectiveActionFormValuesToCreatePayload(values).assigned_to,
    "user-1",
  );
  assert.equal(
    mapCorrectiveActionFormValuesToCreatePayload({
      ...values,
      assigned_to: "",
    }).assigned_to,
    null,
  );
});
