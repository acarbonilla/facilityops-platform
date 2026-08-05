import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveAiAnalysisUiStatus,
  getAiAnalysisStatusTitle,
  getAiAnalysisStatusMessage,
  shouldShowAiAnalysisPanel,
  shouldShowRecommendations,
  shouldShowStructuredSummary,
} from "../fm-tickets/ai-analysis-status";
import {
  buildEmployeeSubmitSuccessHref,
  buildRequesterIntakeTimeline,
  getEmployeeSubmitPhaseLabel,
  readAiNotRequestedFromSearch,
  readAiUnavailableFromSearch,
  readUploadPartialFromSearch,
} from "./ai-first-submit";

test("FO-097: submit phase labels are truthful", () => {
  assert.match(getEmployeeSubmitPhaseLabel("creating_ticket"), /Creating/i);
  assert.match(getEmployeeSubmitPhaseLabel("uploading_images"), /Uploading/i);
  assert.match(getEmployeeSubmitPhaseLabel("queueing_ai"), /Preparing AI/i);
});

test("FO-097: success href encodes AI outcomes", () => {
  const queued = buildEmployeeSubmitSuccessHref("/my-requests/1", {
    aiOutcome: "queued",
  });
  assert.match(queued, /created=1/);
  assert.match(queued, /ai_queued=1/);

  const unavailable = buildEmployeeSubmitSuccessHref("/my-requests/1", {
    aiOutcome: "unavailable",
    failedUploadCount: 0,
  });
  assert.match(unavailable, /ai_unavailable=1/);

  const partial = buildEmployeeSubmitSuccessHref("/my-requests/1", {
    aiOutcome: "queued",
    failedUploadCount: 1,
    uploadedCount: 1,
  });
  assert.match(partial, /ai_queued=1/);
  assert.match(partial, /upload_partial=1/);
});

test("FO-097: search helpers", () => {
  assert.equal(readAiUnavailableFromSearch("ai_unavailable=1"), true);
  assert.equal(readAiNotRequestedFromSearch("?ai_not_requested=1"), true);
  assert.equal(readUploadPartialFromSearch("upload_partial=1"), true);
});

test("FO-097: requester timeline for queued AI", () => {
  const steps = buildRequesterIntakeTimeline({
    ticketStatus: "open",
    aiStatus: "queued",
    hasImages: true,
  });
  assert.ok(steps.some((step) => /queued/i.test(step.label)));
  assert.ok(steps.some((step) => /Facilities review/i.test(step.label)));
});

test("FO-097: requester timeline for not_requested", () => {
  const steps = buildRequesterIntakeTimeline({
    ticketStatus: "open",
    aiStatus: "not_requested",
    hasImages: false,
  });
  assert.equal(steps[0]?.id, "submitted");
  assert.ok(steps.some((step) => step.id === "review"));
});

test("FO-097: requester AI copy hides recommendations", () => {
  assert.match(
    getAiAnalysisStatusTitle("completed", "requester"),
    /Facilities is reviewing/i,
  );
  assert.match(
    getAiAnalysisStatusMessage("failed", "requester"),
    /still submitted/i,
  );
  assert.equal(shouldShowRecommendations("completed", "requester"), false);
  assert.equal(shouldShowStructuredSummary("completed", "requester"), false);
  assert.equal(
    shouldShowAiAnalysisPanel("not_requested", { audience: "requester" }),
    true,
  );
  assert.equal(resolveAiAnalysisUiStatus(null, { hasAnalyses: false }), "not_requested");
});
