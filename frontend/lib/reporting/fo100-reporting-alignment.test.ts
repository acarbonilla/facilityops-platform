import assert from "node:assert/strict";
import test from "node:test";

import { buildAIInsightsSummaryCards } from "./ai-insights";
import {
  formatReportingCategoryLabel,
  formatReportingPriorityLabel,
} from "./display";
import { REPORTING_TICKET_PRIORITY_VALUES } from "./options";

test("FO-100 reporting labels include intake values", () => {
  assert.equal(formatReportingPriorityLabel("pending_review"), "Pending Review");
  assert.equal(formatReportingCategoryLabel("unclassified"), "Unclassified");
  assert.ok(REPORTING_TICKET_PRIORITY_VALUES.includes("pending_review"));
});

test("FO-100 AI insights cards separate AI pending from classification pending", () => {
  const cards = buildAIInsightsSummaryCards({
    period: {
      start_date: "2026-01-01",
      end_date: "2026-01-31",
      inclusive: true,
      max_range_days: 180,
    },
    filters: {},
    summary: {
      recommendation_count: 4,
      reviewed_count: 2,
      pending_review_count: 2,
      accepted_count: 1,
      modified_count: 1,
      ignored_count: 0,
      acceptance_rate: 0.5,
      modification_rate: 0.5,
      ignore_rate: 0,
      category_agreement_rate: 0.5,
      priority_agreement_rate: 0.5,
      full_agreement_rate: 0.5,
      average_confidence: 70,
      category_agreement_sample_size: 2,
      priority_agreement_sample_size: 2,
      full_agreement_sample_size: 2,
      ai_ready_awaiting_classification_count: 3,
    },
    decision_distribution: [],
    decision_trend: [],
    confidence_by_decision: [],
    category_overrides: [],
    priority_overrides: [],
    confidence_bands: [],
    interpretation: { note: "", labels: {} },
  } as never);

  const pending = cards.find((card) => card.key === "pending");
  const classification = cards.find(
    (card) => card.key === "ai_ready_classification",
  );
  assert.equal(pending?.label, "AI Decision Pending");
  assert.equal(classification?.value, "3");
});
