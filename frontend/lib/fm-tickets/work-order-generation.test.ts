import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFmTicketDetailPath,
  buildMaintenanceWorkOrderDetailPath,
  canGenerateWorkOrderFromTicket,
  formatGenerateWorkOrderError,
  formatGenerateWorkOrderSuccess,
  getGenerateWorkOrderActionLabel,
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
