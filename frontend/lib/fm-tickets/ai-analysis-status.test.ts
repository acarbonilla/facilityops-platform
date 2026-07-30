import assert from "node:assert/strict";
import test from "node:test";

import {
  getAiAnalysisStatusMessage,
  getAiAnalysisStatusTitle,
  getAiGeneratedDisclaimer,
  resolveAiAnalysisUiStatus,
  shouldShowAiAnalysisPanel,
  shouldShowStructuredSummary,
} from "./ai-analysis-status";

test("resolveAiAnalysisUiStatus maps known statuses", () => {
  assert.equal(resolveAiAnalysisUiStatus("queued"), "queued");
  assert.equal(resolveAiAnalysisUiStatus("processing"), "processing");
  assert.equal(resolveAiAnalysisUiStatus("completed"), "completed");
  assert.equal(resolveAiAnalysisUiStatus("failed"), "failed");
  assert.equal(resolveAiAnalysisUiStatus("other"), "none");
  assert.equal(resolveAiAnalysisUiStatus(null), "none");
});

test("status copy covers queued processing completed failed", () => {
  assert.match(getAiAnalysisStatusMessage("queued"), /waiting/i);
  assert.match(getAiAnalysisStatusMessage("processing"), /reviewing/i);
  assert.match(getAiAnalysisStatusMessage("completed"), /FM review/i);
  assert.match(getAiAnalysisStatusMessage("failed"), /remains active/i);
  assert.match(getAiAnalysisStatusTitle("failed"), /could not be completed/i);
});

test("disclaimer and visibility helpers", () => {
  assert.match(getAiGeneratedDisclaimer(), /Human review/i);
  assert.equal(shouldShowAiAnalysisPanel("none"), false);
  assert.equal(shouldShowAiAnalysisPanel("queued"), true);
  assert.equal(shouldShowStructuredSummary("completed", "internal"), true);
  assert.equal(shouldShowStructuredSummary("completed", "requester"), false);
  assert.equal(shouldShowStructuredSummary("failed", "internal"), false);
});
