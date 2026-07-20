import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMyRequestAcknowledgePayload,
  buildMyRequestCancelPayload,
  buildMyRequestReopenPayload,
  getMyRequestWorkflowInvalidationKeys,
  getWorkflowSuccessMessage,
  mapRequesterNotificationTarget,
  requiresWorkflowReason,
  resolveMyRequestWorkflowEligibility,
  validateWorkflowReason,
} from "./workflow";

test("workflow eligibility uses backend action flags", () => {
  assert.deepEqual(
    resolveMyRequestWorkflowEligibility({
      status: "open",
      can_cancel: true,
      can_acknowledge: false,
      can_reopen: false,
    }),
    {
      canCancel: true,
      canAcknowledge: false,
      canReopen: false,
    },
  );
  assert.deepEqual(
    resolveMyRequestWorkflowEligibility({
      status: "resolved",
      can_cancel: false,
      can_acknowledge: true,
      can_reopen: true,
    }),
    {
      canCancel: false,
      canAcknowledge: true,
      canReopen: true,
    },
  );
  assert.deepEqual(resolveMyRequestWorkflowEligibility(null), {
    canCancel: false,
    canAcknowledge: false,
    canReopen: false,
  });
});

test("confirmation reason validation and payloads", () => {
  assert.equal(requiresWorkflowReason("cancel"), true);
  assert.equal(requiresWorkflowReason("reopen"), true);
  assert.equal(requiresWorkflowReason("acknowledge"), false);
  assert.equal(validateWorkflowReason("cancel", "  "), "A reason is required.");
  assert.equal(validateWorkflowReason("acknowledge", ""), null);
  assert.deepEqual(buildMyRequestCancelPayload(" No longer needed "), {
    reason: "No longer needed",
  });
  assert.equal(buildMyRequestCancelPayload("  "), null);
  assert.deepEqual(buildMyRequestReopenPayload("Issue returned"), {
    reason: "Issue returned",
  });
  assert.deepEqual(buildMyRequestAcknowledgePayload(), {});
});

test("requester notification target mapping", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(
    mapRequesterNotificationTarget(`/fm-tickets/${id}`, true),
    `/my-requests/${id}`,
  );
  assert.equal(
    mapRequesterNotificationTarget(`/fm-tickets/${id}`, false),
    `/fm-tickets/${id}`,
  );
  assert.equal(
    mapRequesterNotificationTarget(`/my-requests/${id}`, true),
    `/my-requests/${id}`,
  );
});

test("workflow invalidation keys cover list detail and notifications", () => {
  const keys = getMyRequestWorkflowInvalidationKeys("abc");
  assert.deepEqual(keys[0], ["my-requests"]);
  assert.deepEqual(keys[1], ["my-requests", "detail", "abc"]);
  assert.ok(keys.some((key) => key[0] === "notifications"));
  assert.ok(keys.some((key) => key[0] === "fm-tickets"));
});

test("workflow success messages stay requester-safe", () => {
  assert.match(getWorkflowSuccessMessage("cancel"), /cancelled/i);
  assert.match(getWorkflowSuccessMessage("acknowledge"), /closed/i);
  assert.match(getWorkflowSuccessMessage("reopen"), /reopened/i);
});

test("operational users do not receive duplicate requester action flags without backend flags", () => {
  assert.deepEqual(
    resolveMyRequestWorkflowEligibility({
      status: "open",
      can_cancel: false,
      can_acknowledge: false,
      can_reopen: false,
    }),
    {
      canCancel: false,
      canAcknowledge: false,
      canReopen: false,
    },
  );
});
