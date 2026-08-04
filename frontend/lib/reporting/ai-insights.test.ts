import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_INSIGHTS_CONFIDENCE_DISCLAIMER,
  AI_INSIGHTS_EMPTY_MESSAGE,
  buildAIInsightsSummaryCards,
  containsRequesterIdentity,
  createDefaultAIInsightsFilters,
  decisionBarWidth,
  formatAIInsightsConfidence,
  formatAIInsightsRate,
  isAIInsightsEmpty,
  resetAIInsightsFilters,
  serializeAIInsightsParams,
} from "./ai-insights";
import type { AIRecommendationInsights } from "@/types/ai-insights";

function sampleInsights(
  overrides: Partial<AIRecommendationInsights["summary"]> = {},
): AIRecommendationInsights {
  return {
    period: {
      start_date: "2026-05-01",
      end_date: "2026-07-30",
      inclusive: true,
      max_range_days: 180,
    },
    filters: {},
    summary: {
      recommendation_count: 4,
      reviewed_count: 3,
      pending_review_count: 1,
      accepted_count: 1,
      modified_count: 1,
      ignored_count: 1,
      acceptance_rate: 0.3333,
      modification_rate: 0.3333,
      ignore_rate: 0.3333,
      category_agreement_rate: 0.5,
      priority_agreement_rate: 0.5,
      full_agreement_rate: 0.5,
      average_confidence: 63.8,
      category_agreement_sample_size: 2,
      priority_agreement_sample_size: 2,
      full_agreement_sample_size: 2,
      ...overrides,
    },
    decision_distribution: [
      { decision: "accepted", label: "Accepted", count: 1 },
      { decision: "modified", label: "Modified", count: 1 },
      { decision: "ignored", label: "Ignored", count: 1 },
      { decision: "pending", label: "Pending Review", count: 1 },
    ],
    decision_trend: [
      {
        period: "2026-07-28",
        grain: "day",
        accepted: 1,
        modified: 0,
        ignored: 0,
        pending: 1,
        total: 2,
      },
    ],
    confidence_by_decision: [
      {
        decision: "accepted",
        label: "Accepted",
        count: 1,
        average_confidence: 90,
      },
    ],
    category_overrides: [
      {
        recommended: "Plumbing",
        final: "civil",
        count: 1,
        percentage: 1,
      },
    ],
    priority_overrides: [
      {
        recommended: "Medium",
        final: "high",
        count: 1,
        percentage: 1,
      },
    ],
    confidence_bands: [
      {
        band: "low",
        label: "Low",
        bounds: "below 50",
        count: 1,
        percentage: 0.25,
      },
    ],
    interpretation: {
      note: "Human agreement only.",
      labels: {
        acceptance_rate: "Recommendation Acceptance",
      },
    },
  };
}

test("default filters use reporting date range helpers", () => {
  const draft = createDefaultAIInsightsFilters(new Date(2026, 6, 30));
  assert.equal(draft.dateTo, "2026-07-30");
  assert.equal(draft.dateFrom, "2026-05-01");
  assert.equal(draft.decision, "");
});

test("serializeAIInsightsParams maps filters", () => {
  const params = serializeAIInsightsParams({
    dateFrom: "2026-07-01",
    dateTo: "2026-07-15",
    decision: "modified",
    category: "plumbing",
    priority: "high",
  });
  assert.deepEqual(params, {
    start_date: "2026-07-01",
    end_date: "2026-07-15",
    decision: "modified",
    category: "plumbing",
    priority: "high",
  });
});

test("serializeAIInsightsParams rejects invalid ranges", () => {
  assert.equal(
    serializeAIInsightsParams({
      dateFrom: "2026-07-15",
      dateTo: "2026-07-01",
      decision: "",
      category: "",
      priority: "",
    }),
    null,
  );
});

test("rate and confidence formatters", () => {
  assert.equal(formatAIInsightsRate(0.3333), "33.3%");
  assert.equal(formatAIInsightsRate(null), "—");
  assert.equal(formatAIInsightsConfidence(63.8), "63.8");
  assert.equal(formatAIInsightsConfidence(null), "—");
});

test("summary cards and empty state", () => {
  const cards = buildAIInsightsSummaryCards(sampleInsights());
  assert.equal(cards.length, 9);
  assert.equal(cards[0]?.label, "Recommendations");
  assert.equal(cards[3]?.value, "33.3%");
  assert.equal(cards[8]?.label, "Average Confidence");

  assert.equal(isAIInsightsEmpty(sampleInsights()), false);
  assert.equal(
    isAIInsightsEmpty(sampleInsights({ recommendation_count: 0 })),
    true,
  );
  assert.match(AI_INSIGHTS_EMPTY_MESSAGE, /No reviewed AI recommendations/i);
  assert.match(AI_INSIGHTS_CONFIDENCE_DISCLAIMER, /model-reported/i);
});

test("decision bar width and reset filters", () => {
  assert.equal(decisionBarWidth(0, 10), 0);
  assert.equal(decisionBarWidth(5, 10), 50);
  assert.equal(decisionBarWidth(1, 100), 4);
  const reset = resetAIInsightsFilters(new Date(2026, 0, 31));
  assert.equal(reset.dateTo, "2026-01-31");
  assert.equal(reset.category, "");
});

test("privacy helper detects requester identities", () => {
  const payload = sampleInsights();
  assert.equal(
    containsRequesterIdentity(payload, ["alice@example.com"]),
    false,
  );
  assert.equal(
    containsRequesterIdentity(
      { ...payload, leak: "alice@example.com" },
      ["alice@example.com"],
    ),
    true,
  );
});

test("override and trend sample structures remain accessible", () => {
  const data = sampleInsights();
  assert.equal(data.category_overrides[0]?.recommended, "Plumbing");
  assert.equal(data.priority_overrides[0]?.final, "high");
  assert.equal(data.decision_trend[0]?.grain, "day");
  assert.equal(data.decision_distribution.length, 4);
});
