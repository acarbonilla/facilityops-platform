import assert from "node:assert/strict";
import test from "node:test";

import {
  getMaintenanceWorkflowSuccessMessage,
  MAINTENANCE_WORKFLOW_SUCCESS_MESSAGES,
} from "./workflow";

test("workflow success messages use consistent work-order wording", () => {
  assert.equal(
    getMaintenanceWorkflowSuccessMessage("start"),
    "Work order started successfully.",
  );
  assert.equal(
    getMaintenanceWorkflowSuccessMessage("resume"),
    "Work order resumed successfully.",
  );
  assert.equal(
    getMaintenanceWorkflowSuccessMessage("hold"),
    "Work order placed on hold successfully.",
  );
  assert.equal(
    getMaintenanceWorkflowSuccessMessage("complete"),
    "Work order completed successfully.",
  );
  assert.equal(
    getMaintenanceWorkflowSuccessMessage("cancel"),
    "Work order cancelled successfully.",
  );
  assert.equal(
    getMaintenanceWorkflowSuccessMessage("reopen"),
    "Work order reopened successfully.",
  );
  assert.equal(
    getMaintenanceWorkflowSuccessMessage("assign"),
    "Work order assigned successfully.",
  );
  assert.equal(
    getMaintenanceWorkflowSuccessMessage("reassign"),
    "Work order reassigned successfully.",
  );
  assert.equal(
    getMaintenanceWorkflowSuccessMessage("unassign"),
    "Work order unassigned successfully.",
  );

  assert.equal(
    MAINTENANCE_WORKFLOW_SUCCESS_MESSAGES.submit,
    "Work order submitted successfully.",
  );
  assert.equal("Start completed successfully." in Object.values(MAINTENANCE_WORKFLOW_SUCCESS_MESSAGES), false);
  assert.equal("Resume completed successfully." in Object.values(MAINTENANCE_WORKFLOW_SUCCESS_MESSAGES), false);
});
