import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAiAnalysisProviderLabel,
  getAiAnalysisStatusMessage,
  getAiAnalysisStatusTitle,
  getAiGeneratedDisclaimer,
  getOperationalClassificationReminder,
  getRecommendationHumanReviewNotice,
  resolveAiAnalysisUiStatus,
  shouldShowAiAnalysisPanel,
  shouldShowRecommendations,
  shouldShowStructuredSummary,
} from "./ai-analysis-status";

test("resolveAiAnalysisUiStatus maps known statuses", () => {
  assert.equal(resolveAiAnalysisUiStatus("queued"), "queued");
  assert.equal(resolveAiAnalysisUiStatus("processing"), "processing");
  assert.equal(resolveAiAnalysisUiStatus("completed"), "completed");
  assert.equal(resolveAiAnalysisUiStatus("failed"), "failed");
  assert.equal(resolveAiAnalysisUiStatus("other"), "none");
  assert.equal(resolveAiAnalysisUiStatus(null), "none");
  assert.equal(
    resolveAiAnalysisUiStatus(null, { hasAnalyses: false }),
    "not_requested",
  );
});

test("status copy covers queued processing completed failed", () => {
  assert.match(getAiAnalysisStatusMessage("queued"), /waiting/i);
  assert.match(getAiAnalysisStatusMessage("processing"), /reviewing/i);
  assert.match(getAiAnalysisStatusMessage("completed"), /FM review/i);
  assert.match(getAiAnalysisStatusMessage("failed"), /remains active/i);
  assert.match(getAiAnalysisStatusTitle("failed"), /could not be completed/i);
});

test("requester audience uses safe copy", () => {
  assert.match(
    getAiAnalysisStatusTitle("queued", "requester"),
    /Photos received/i,
  );
  assert.match(
    getAiAnalysisStatusMessage("not_requested", "requester"),
    /No photos were analyzed/i,
  );
});

test("disclaimer and visibility helpers", () => {
  assert.match(getAiGeneratedDisclaimer(), /Human review/i);
  assert.match(getRecommendationHumanReviewNotice(), /Facilities Team/);
  assert.match(getOperationalClassificationReminder(), /does not set final category/i);
  assert.equal(formatAiAnalysisProviderLabel("placeholder"), "Placeholder (no live vision)");
  assert.equal(formatAiAnalysisProviderLabel("gemini"), "Gemini Vision");
  assert.equal(shouldShowAiAnalysisPanel("none"), false);
  assert.equal(shouldShowAiAnalysisPanel("queued"), true);
  assert.equal(
    shouldShowAiAnalysisPanel("not_requested", { audience: "requester" }),
    true,
  );
  assert.equal(
    shouldShowAiAnalysisPanel("not_requested", { audience: "internal" }),
    false,
  );
  assert.equal(shouldShowStructuredSummary("completed", "internal"), true);
  assert.equal(shouldShowStructuredSummary("completed", "requester"), false);
  assert.equal(shouldShowStructuredSummary("failed", "internal"), false);
  assert.equal(shouldShowRecommendations("completed", "internal"), true);
  assert.equal(shouldShowRecommendations("completed", "requester"), false);
});
