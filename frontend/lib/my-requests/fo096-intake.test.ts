import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMyRequestCreatePayload,
  shouldShowMyRequestDetailSoftWarning,
} from "./form";
import type { MyRequestFormValues } from "@/types/my-requests";

test("FO-096: simplified payload is title and optional description only", () => {
  const values: MyRequestFormValues = {
    title: " Concern ",
    description: " Details ",
  };
  assert.deepEqual(buildMyRequestCreatePayload(values), {
    title: "Concern",
    description: "Details",
  });
});

test("FO-096: title required", () => {
  assert.equal(
    buildMyRequestCreatePayload({ title: "  ", description: "x" }),
    null,
  );
});

test("FO-096: blank description allowed", () => {
  assert.deepEqual(
    buildMyRequestCreatePayload({ title: "Only title", description: "" }),
    { title: "Only title", description: "" },
  );
});

test("FO-096: soft warning when both description and images empty", () => {
  assert.equal(shouldShowMyRequestDetailSoftWarning({ description: "" }, 0), true);
});

test("FO-096: soft warning clears with description", () => {
  assert.equal(
    shouldShowMyRequestDetailSoftWarning({ description: "text" }, 0),
    false,
  );
});

test("FO-096: soft warning clears with staged images", () => {
  assert.equal(shouldShowMyRequestDetailSoftWarning({ description: "" }, 2), false);
});

test("FO-096: soft warning does not block payload build", () => {
  const payload = buildMyRequestCreatePayload({
    title: "Submit anyway",
    description: "",
  });
  assert.ok(payload);
  assert.equal(
    shouldShowMyRequestDetailSoftWarning({ description: "" }, 0),
    true,
  );
});
