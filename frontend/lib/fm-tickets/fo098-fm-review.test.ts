import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReviewGuidanceSteps,
  formatClassificationBlockReason,
  formatFieldIndicatorLabel,
  getBuildingFieldIndicator,
  getCategoryFieldIndicator,
  getClassificationBlockReason,
  getPriorityFieldIndicator,
  isOperationalClassificationComplete,
  valuesDiffer,
} from "./fm-review-experience";
import {
  canGenerateWorkOrderFromTicket,
  getWorkOrderGenerationDisabledReason,
} from "./work-order-generation";

test("FO-098 classification incomplete for employee intake defaults", () => {
  const ticket = {
    category: "unclassified" as const,
    priority: "pending_review" as const,
    building: null,
  };
  assert.equal(getClassificationBlockReason(ticket), "unclassified_category");
  assert.equal(isOperationalClassificationComplete(ticket), false);
  assert.match(
    formatClassificationBlockReason("unclassified_category") || "",
    /category/i,
  );
});

test("FO-098 classification complete when category priority building set", () => {
  const ticket = {
    category: "plumbing" as const,
    priority: "high" as const,
    building: "b1",
  };
  assert.equal(getClassificationBlockReason(ticket), null);
  assert.equal(isOperationalClassificationComplete(ticket), true);
  assert.equal(getCategoryFieldIndicator("plumbing"), "complete");
  assert.equal(getPriorityFieldIndicator("high"), "complete");
  assert.equal(getBuildingFieldIndicator("b1"), "complete");
});

test("FO-098 field indicators highlight needs review", () => {
  assert.equal(getCategoryFieldIndicator("unclassified"), "needs_review");
  assert.equal(getPriorityFieldIndicator("pending_review"), "needs_review");
  assert.equal(getBuildingFieldIndicator(null), "needs_review");
  assert.equal(formatFieldIndicatorLabel("needs_review"), "Needs review");
  assert.equal(formatFieldIndicatorLabel("accepted"), "Accepted");
});

test("FO-098 guidance steps advance after classification", () => {
  const incomplete = buildReviewGuidanceSteps({
    classificationComplete: false,
    hasAiDecision: false,
    aiCompleted: true,
  });
  assert.equal(
    incomplete.find((step) => step.status === "current")?.id,
    "ai_decision",
  );

  const ready = buildReviewGuidanceSteps({
    classificationComplete: true,
    hasAiDecision: true,
    aiCompleted: true,
  });
  assert.equal(
    ready.find((step) => step.status === "current")?.id,
    "operational_assignment",
  );
});

test("FO-098 comparison helper detects differences", () => {
  assert.equal(valuesDiffer("plumbing", "hvac"), true);
  assert.equal(valuesDiffer("plumbing", "Plumbing"), false);
  assert.equal(valuesDiffer(null, null), false);
});

test("FO-098 work order blocked until classification complete", () => {
  const reason = getWorkOrderGenerationDisabledReason(
    {
      status: "assigned",
      assignee: "u1",
      asset: "a1",
      linked_work_order: null,
      category: "unclassified",
      priority: "pending_review",
      building: null,
    },
    true,
  );
  assert.equal(reason, "classification_incomplete");
  assert.equal(
    canGenerateWorkOrderFromTicket(
      {
        status: "assigned",
        assignee: "u1",
        asset: "a1",
        linked_work_order: null,
        category: "plumbing",
        priority: "high",
        building: "b1",
      },
      true,
    ),
    true,
  );
});
