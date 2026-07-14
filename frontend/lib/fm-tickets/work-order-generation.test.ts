import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFmTicketDetailPath,
  buildMaintenanceWorkOrderDetailPath,
  canGenerateWorkOrderFromTicket,
  formatGenerateWorkOrderError,
  formatGenerateWorkOrderSuccess,
  formatWorkOrderGenerationDisabledReason,
  getGenerateWorkOrderActionLabel,
  getWorkOrderGenerationDisabledReason,
  WORK_ORDER_GENERATION_ELIGIBLE_STATUSES,
  WORK_ORDER_GENERATION_EXPLANATION,
} from "./work-order-generation";

const eligibleTicket = {
  status: "assigned" as const,
  assignee: "tech-1",
  asset: "asset-1",
  linked_work_order: null,
};

test("eligible assigned ticket can generate a work order", () => {
  assert.equal(canGenerateWorkOrderFromTicket(eligibleTicket), true);
  assert.equal(
    canGenerateWorkOrderFromTicket({
      ...eligibleTicket,
      status: "in_progress",
    }),
    true,
  );
  assert.deepEqual(WORK_ORDER_GENERATION_ELIGIBLE_STATUSES, [
    "assigned",
    "in_progress",
  ]);
});

test("generation disabled reasons identify missing requirements", () => {
  assert.equal(
    getWorkOrderGenerationDisabledReason({
      ...eligibleTicket,
      assignee: null,
    }),
    "missing_assignee",
  );
  assert.equal(
    formatWorkOrderGenerationDisabledReason("missing_assignee"),
    "Assign a technician first.",
  );
  assert.equal(
    getWorkOrderGenerationDisabledReason({
      ...eligibleTicket,
      asset: null,
    }),
    "missing_asset",
  );
  assert.equal(
    formatWorkOrderGenerationDisabledReason("missing_asset"),
    "Add an asset first.",
  );
  assert.equal(
    getWorkOrderGenerationDisabledReason({
      ...eligibleTicket,
      status: "open",
    }),
    "invalid_status",
  );
  assert.equal(
    formatWorkOrderGenerationDisabledReason("invalid_status"),
    "Ticket must be Assigned or In Progress.",
  );
  assert.equal(
    getWorkOrderGenerationDisabledReason({
      ...eligibleTicket,
      linked_work_order: {
        id: "wo-1",
        work_order_number: "MWO-1",
        status: "assigned",
        title: "Linked",
      },
    }),
    "already_linked",
  );
  assert.equal(
    getWorkOrderGenerationDisabledReason(eligibleTicket, false),
    "missing_permission",
  );
  assert.equal(
    formatWorkOrderGenerationDisabledReason("missing_permission"),
    "You do not have permission to generate a Work Order.",
  );
});

test("generation becomes enabled after valid assignment prerequisites", () => {
  assert.equal(
    canGenerateWorkOrderFromTicket({
      ...eligibleTicket,
      assignee: null,
    }),
    false,
  );
  assert.equal(canGenerateWorkOrderFromTicket(eligibleTicket), true);
});

test("missing assignee asset or existing link suppresses generation", () => {
  assert.equal(
    canGenerateWorkOrderFromTicket({
      ...eligibleTicket,
      assignee: null,
    }),
    false,
  );
  assert.equal(
    canGenerateWorkOrderFromTicket({
      ...eligibleTicket,
      asset: null,
    }),
    false,
  );
  assert.equal(
    canGenerateWorkOrderFromTicket({
      ...eligibleTicket,
      linked_work_order: {
        id: "wo-1",
        work_order_number: "MWO-1",
        status: "assigned",
        title: "Linked",
      },
    }),
    false,
  );
});

test("invalid statuses cannot generate", () => {
  for (const status of [
    "draft",
    "open",
    "on_hold",
    "resolved",
    "closed",
    "cancelled",
  ] as const) {
    assert.equal(
      canGenerateWorkOrderFromTicket({
        ...eligibleTicket,
        status,
      }),
      false,
    );
  }
});

test("generate action label changes when a work order is linked", () => {
  assert.equal(
    getGenerateWorkOrderActionLabel(eligibleTicket),
    "Generate Work Order",
  );
  assert.equal(
    getGenerateWorkOrderActionLabel({
      linked_work_order: {
        id: "wo-1",
        work_order_number: "MWO-1",
        status: "assigned",
        title: "Linked",
      },
    }),
    "Work order linked",
  );
});

test("success and error message helpers format correctly", () => {
  assert.equal(
    formatGenerateWorkOrderSuccess({
      id: "wo-1",
      work_order_number: "MWO-20260714-0001",
      status: "assigned",
      title: "Cooling unit",
    }),
    "Work order MWO-20260714-0001 created successfully.",
  );
  assert.equal(
    formatGenerateWorkOrderError(new Error("Ticket must have an asset.")),
    "Ticket must have an asset.",
  );
  assert.match(formatGenerateWorkOrderError({}), /Unable to generate/);
  assert.match(WORK_ORDER_GENERATION_EXPLANATION, /does not automatically create/);
});

test("linked record routes use existing path conventions", () => {
  assert.equal(
    buildMaintenanceWorkOrderDetailPath("abc"),
    "/maintenance/work-orders/abc",
  );
  assert.equal(buildFmTicketDetailPath("def"), "/fm-tickets/def");
});
