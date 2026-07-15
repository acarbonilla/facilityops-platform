import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/services/api/types";

import {
  formatMaintenanceApiFieldLabel,
  formatMaintenanceError,
  formatMaintenanceValidationMessages,
} from "./display";

test("maintenance validation messages keep field context", () => {
  assert.deepEqual(
    formatMaintenanceValidationMessages({
      asset: ["This field may not be null."],
    }),
    ["Asset: This field may not be null."],
  );
  assert.equal(
    formatMaintenanceApiFieldLabel("scheduled_start_at"),
    "Estimated start date",
  );
});

test("formatMaintenanceError preserves field-specific backend validation", () => {
  const error = new ApiError("This field may not be null.", 400, {
    message: "This field may not be null.",
    errors: {
      asset: ["This field may not be null."],
    },
  });

  assert.equal(
    formatMaintenanceError(error, "Fallback"),
    "Asset: This field may not be null.",
  );
});

test("formatMaintenanceError joins multiple validation fields", () => {
  const error = new ApiError("Validation failed", 400, {
    message: "Validation failed",
    errors: {
      asset: ["This field may not be null."],
      building: ["This field may not be null."],
    },
  });

  assert.equal(
    formatMaintenanceError(error, "Fallback"),
    "Asset: This field may not be null. Building: This field may not be null.",
  );
});
