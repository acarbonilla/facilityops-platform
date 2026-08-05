import assert from "node:assert/strict";
import test from "node:test";

import {
  getAiAnalysisStatusMessage,
  getAiAnalysisStatusTitle,
  shouldShowRecommendations,
  shouldShowStructuredSummary,
} from "@/lib/fm-tickets/ai-analysis-status";
import { formatReportingPriorityLabel, formatReportingCategoryLabel } from "@/lib/reporting/display";
import { buildAIInsightsSummaryCards } from "@/lib/reporting/ai-insights";

test("FO-101: requester AI UI never shows recommendation surfaces", () => {
  assert.equal(shouldShowRecommendations("completed", "requester"), false);
  assert.equal(shouldShowStructuredSummary("completed", "requester"), false);
  assert.match(
    getAiAnalysisStatusTitle("completed", "requester"),
    /Facilities is reviewing/i,
  );
  assert.match(
    getAiAnalysisStatusMessage("failed", "requester"),
    /Facilities can review/i,
  );
});

test("FO-101: reporting labels keep intake values distinct", () => {
  assert.equal(formatReportingPriorityLabel("pending_review"), "Pending Review");
  assert.equal(formatReportingCategoryLabel("unclassified"), "Unclassified");
});

test("FO-101: AI insights cards separate decision pending from classification pending", () => {
  const cards = buildAIInsightsSummaryCards({
    period: {
      start_date: "2026-01-01",
      end_date: "2026-01-31",
      inclusive: true,
      max_range_days: 180,
    },
    filters: {},
    summary: {
      recommendation_count: 2,
      reviewed_count: 1,
      pending_review_count: 1,
      accepted_count: 1,
      modified_count: 0,
      ignored_count: 0,
      acceptance_rate: 1,
      modification_rate: 0,
      ignore_rate: 0,
      category_agreement_rate: 1,
      priority_agreement_rate: 1,
      full_agreement_rate: 1,
      average_confidence: 80,
      category_agreement_sample_size: 1,
      priority_agreement_sample_size: 1,
      full_agreement_sample_size: 1,
      ai_ready_awaiting_classification_count: 4,
    },
    decision_distribution: [],
    decision_trend: [],
    confidence_by_decision: [],
    category_overrides: [],
    priority_overrides: [],
    confidence_bands: [],
    interpretation: { note: "", labels: {} },
  } as never);

  const decisionPending = cards.find((card) => card.key === "pending");
  const classificationPending = cards.find(
    (card) => card.key === "ai_ready_classification",
  );
  assert.equal(decisionPending?.label, "AI Decision Pending");
  assert.equal(classificationPending?.value, "4");
  assert.notEqual(decisionPending?.label, classificationPending?.label);
});
