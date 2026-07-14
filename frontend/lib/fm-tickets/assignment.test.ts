import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFmTicketAssigneeFallback,
  buildFmTicketAssignmentPayload,
  getFmTicketAssignmentActionLabel,
  normalizeFmTicketAssigneeId,
  resolveFmTicketAssignmentState,
  shouldConfirmFmTicketReassignment,
} from "./assignment";

test("permission mapping requires assign and directory for ready state", () => {
  assert.equal(
    resolveFmTicketAssignmentState({
      canAssign: false,
      canReadDirectory: true,
    }),
    "read_only",
  );
  assert.equal(
    resolveFmTicketAssignmentState({
      canAssign: true,
      canReadDirectory: false,
    }),
    "directory_unavailable",
  );
  assert.equal(
    resolveFmTicketAssignmentState({
      canAssign: true,
      canReadDirectory: true,
    }),
    "ready",
  );
});

test("assign versus reassign action labels", () => {
  assert.equal(getFmTicketAssignmentActionLabel(null), "Assign Ticket");
  assert.equal(getFmTicketAssignmentActionLabel("tech-1"), "Reassign Ticket");
});

test("technician UUID payload normalization and empty rejection", () => {
  assert.equal(normalizeFmTicketAssigneeId("  "), null);
  assert.equal(normalizeFmTicketAssigneeId("tech-1"), "tech-1");
  assert.equal(buildFmTicketAssignmentPayload(null), null);
  assert.equal(buildFmTicketAssignmentPayload("  "), null);
  assert.deepEqual(buildFmTicketAssignmentPayload(" tech-1 ", " note "), {
    assignee: "tech-1",
    note: "note",
  });
  assert.deepEqual(buildFmTicketAssignmentPayload("tech-1"), {
    assignee: "tech-1",
  });
});

test("reassignment confirmation only when assignee changes", () => {
  assert.equal(shouldConfirmFmTicketReassignment(null, "tech-1"), false);
  assert.equal(shouldConfirmFmTicketReassignment("tech-1", "tech-1"), false);
  assert.equal(shouldConfirmFmTicketReassignment("tech-1", "tech-2"), true);
});

test("selected assignee fallback preserves email identity", () => {
  assert.deepEqual(
    buildFmTicketAssigneeFallback({
      assignee: "tech-1",
      assignee_email: "tech@example.com",
    }),
    {
      id: "tech-1",
      email: "tech@example.com",
      first_name: "",
      last_name: "",
      display_name: "tech@example.com",
      tenant: null,
      organization: null,
      is_active: true,
    },
  );
  assert.equal(
    buildFmTicketAssigneeFallback({
      assignee: null,
      assignee_email: null,
    }),
    null,
  );
});
