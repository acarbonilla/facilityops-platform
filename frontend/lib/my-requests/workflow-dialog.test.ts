import assert from "node:assert/strict";
import test from "node:test";

import {
  canCloseWorkflowDialog,
  getWorkflowDialogAriaIds,
  getWorkflowDialogFocusReturnTarget,
  getWorkflowDialogInitialFocusTarget,
  resolveWorkflowDialogTabCycle,
  shouldHandleWorkflowDialogEscape,
  WORKFLOW_DIALOG_DESCRIPTION_ID,
  WORKFLOW_DIALOG_REASON_ID,
  WORKFLOW_DIALOG_TITLE_ID,
} from "./workflow-dialog";
import {
  getWorkflowConfirmationCopy,
  getWorkflowSuccessMessage,
  resolveMyRequestWorkflowEligibility,
  validateWorkflowReason,
} from "./workflow";

test("workflow dialog exposes stable accessible name and description ids", () => {
  const ids = getWorkflowDialogAriaIds();
  assert.equal(ids.titleId, WORKFLOW_DIALOG_TITLE_ID);
  assert.equal(ids.descriptionId, WORKFLOW_DIALOG_DESCRIPTION_ID);
  assert.equal(ids.labelledBy, WORKFLOW_DIALOG_TITLE_ID);
  assert.equal(ids.describedBy, WORKFLOW_DIALOG_DESCRIPTION_ID);
  assert.equal(ids.reasonId, WORKFLOW_DIALOG_REASON_ID);
});

test("escape closes only when no mutation is pending", () => {
  assert.equal(canCloseWorkflowDialog(false), true);
  assert.equal(canCloseWorkflowDialog(true), false);
  assert.equal(shouldHandleWorkflowDialogEscape("Escape", false), true);
  assert.equal(shouldHandleWorkflowDialogEscape("Escape", true), false);
  assert.equal(shouldHandleWorkflowDialogEscape("Enter", false), false);
});

test("initial focus prefers reason field when required otherwise dismiss", () => {
  assert.equal(getWorkflowDialogInitialFocusTarget(true), "reason");
  assert.equal(getWorkflowDialogInitialFocusTarget(false), "dismiss");
});

test("focus returns to the control that opened the dialog", () => {
  const opener = { id: "opener" } as HTMLElement;
  assert.equal(getWorkflowDialogFocusReturnTarget(opener), opener);
  assert.equal(getWorkflowDialogFocusReturnTarget(null), null);
});

test("tab cycle stays within dialog focusable controls", () => {
  const first = { id: "first" } as HTMLElement;
  const last = { id: "last" } as HTMLElement;
  assert.equal(
    resolveWorkflowDialogTabCycle({ key: "Tab", shiftKey: false }, [first, last], last),
    first,
  );
  assert.equal(
    resolveWorkflowDialogTabCycle({ key: "Tab", shiftKey: true }, [first, last], first),
    last,
  );
  assert.equal(
    resolveWorkflowDialogTabCycle({ key: "Tab", shiftKey: false }, [first, last], first),
    null,
  );
  assert.equal(
    resolveWorkflowDialogTabCycle({ key: "Escape", shiftKey: false }, [first, last], first),
    null,
  );
});

test("reason validation remains associated with required workflow actions", () => {
  assert.equal(validateWorkflowReason("cancel", ""), "A reason is required.");
  assert.equal(validateWorkflowReason("reopen", "  "), "A reason is required.");
  assert.equal(validateWorkflowReason("acknowledge", ""), null);
  assert.equal(validateWorkflowReason("cancel", "No longer needed"), null);
});

test("action eligibility and success copy remain unchanged", () => {
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
  assert.equal(
    getWorkflowConfirmationCopy("cancel").title,
    "Cancel this request?",
  );
  assert.match(getWorkflowSuccessMessage("cancel"), /cancelled/i);
  assert.match(getWorkflowSuccessMessage("acknowledge"), /closed/i);
  assert.match(getWorkflowSuccessMessage("reopen"), /reopened/i);
});
