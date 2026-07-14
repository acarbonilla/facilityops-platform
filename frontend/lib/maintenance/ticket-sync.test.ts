import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LINKED_WORK_ORDER_STATUS_SYNC_MESSAGE,
  getLinkedTicketInvalidationTarget,
  getLinkedWorkOrderSyncMessage,
  getSourceTicketInvalidationId,
  shouldInvalidateLinkedTicket,
} from "./ticket-sync";

describe("linked work order ticket sync helpers", () => {
  it("linked Work Order uses source Ticket UUID for invalidation", () => {
    const target = getLinkedTicketInvalidationTarget({
      source_ticket: {
        id: "  ticket-uuid-1  ",
        ticket_number: "FM-1",
        status: "assigned",
        title: "Linked",
      },
    });
    assert.equal(target, "ticket-uuid-1");
    assert.equal(shouldInvalidateLinkedTicket(target), true);
  });

  it("standalone Work Order produces no Ticket invalidation target", () => {
    assert.equal(getLinkedTicketInvalidationTarget({ source_ticket: null }), null);
    assert.equal(getSourceTicketInvalidationId(null), null);
    assert.equal(shouldInvalidateLinkedTicket(null), false);
    assert.equal(shouldInvalidateLinkedTicket("   "), false);
  });

  it("synchronization information message is only shown for linked Work Orders", () => {
    assert.equal(
      getLinkedWorkOrderSyncMessage({ id: "ticket-1" }),
      LINKED_WORK_ORDER_STATUS_SYNC_MESSAGE,
    );
    assert.equal(getLinkedWorkOrderSyncMessage(null), null);
    assert.equal(getLinkedWorkOrderSyncMessage({ id: "" }), null);
  });

  it("does not expose a manual synchronization action helper", () => {
    const helpers = {
      getSourceTicketInvalidationId,
      getLinkedTicketInvalidationTarget,
      getLinkedWorkOrderSyncMessage,
      shouldInvalidateLinkedTicket,
    };
    assert.equal("triggerStatusSync" in helpers, false);
    assert.equal("synchronizeTicketStatus" in helpers, false);
  });
});
