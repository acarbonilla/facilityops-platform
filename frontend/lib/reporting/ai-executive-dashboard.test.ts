import assert from "node:assert/strict";
import test from "node:test";

import {
  EXECUTIVE_AI_DISCLAIMER,
  EXECUTIVE_AI_EMPTY_MESSAGE,
  containsRequesterIdentity,
  createDefaultExecutiveAIFilters,
  decisionBarWidth,
  formatExecutiveRate,
  isExecutiveAIEmpty,
  resetExecutiveAIFilters,
  serializeExecutiveAIParams,
  statusBadgeClass,
  trendBadgeClass,
} from "./ai-executive-dashboard";
import type { ExecutiveAIDashboard } from "@/types/ai-executive-dashboard";

function sampleDashboard(
  overrides: Partial<ExecutiveAIDashboard["summary"]> = {},
): ExecutiveAIDashboard {
  return {
    period: {
      start_date: "2026-05-01",
      end_date: "2026-08-01",
      inclusive: true,
      max_range_days: 180,
      previous_start_date: "2026-02-01",
      previous_end_date: "2026-04-30",
    },
    filters: {},
    summary: {
      completed_analyses: 10,
      recommendations_generated: 10,
      reviewed_count: 8,
      pending_review_count: 2,
      accepted_count: 5,
      modified_count: 2,
      ignored_count: 1,
      acceptance_rate: 0.625,
      modification_rate: 0.25,
      ignore_rate: 0.125,
      override_rate: 0.25,
      category_agreement_rate: 0.7,
      priority_agreement_rate: 0.6,
      full_agreement_rate: 0.5,
      average_confidence: 78,
      operational_health_score: 72,
      operational_health_band: "needs_review",
      operational_health_label: "Needs Review",
      attention_urgency_score: 55,
      attention_urgency_level: "medium",
      attention_urgency_label: "Medium",
      critical_attention_count: 0,
      high_attention_count: 1,
      ...overrides,
    },
    executive_summary: {
      status: "stable",
      label: "Stable",
      headline: "Workflows are stable.",
      details: ["Informational only."],
    },
    period_comparison: {
      acceptance_rate: {
        direction: "increase",
        label: "Increasing",
        current: 0.625,
        previous: 0.5,
        delta: 0.125,
      },
    },
    decision_distribution: [
      { decision: "accepted", label: "Accepted", count: 5 },
      { decision: "modified", label: "Modified", count: 2 },
    ],
    decision_trend: [],
    confidence_by_decision: [],
    confidence_bands: [],
    top_category_overrides: [],
    top_priority_overrides: [],
    attention_summary: {
      attention_count: 1,
      critical_count: 0,
      high_count: 1,
      pending_review_count: 2,
      urgency_score: 55,
      urgency_level: { code: "medium", label: "Medium" },
      top_attention_items: [],
      suggested_actions: [],
    },
    operational_health: {
      score: 72,
      band: "needs_review",
      label: "Needs Review",
      components: {},
    },
    operational_insights: [],
    knowledge_summary: {
      status: "deferred",
      available: false,
      reason: "Usage not persisted.",
      endpoint: "/api/reporting/ai-similar-cases/",
      algorithm: { version: "rule_v1", name: "weighted_rule_similarity" },
      corpus_signals: { recommendation_count: 10 },
      advisory_note: "Advisory only.",
    },
    interpretation: {
      note: "Informational.",
      labels: { health: "AI Operational Health" },
    },
    generated_at: "2026-08-04T00:00:00Z",
  };
}

test("default filters and serialize", () => {
  const draft = createDefaultExecutiveAIFilters(new Date("2026-08-04T12:00:00Z"));
  assert.ok(draft.dateFrom);
  assert.ok(draft.dateTo);
  const params = serializeExecutiveAIParams(draft);
  assert.ok(params);
  assert.ok(params?.start_date);
  draft.category = "plumbing";
  assert.equal(serializeExecutiveAIParams(draft)?.category, "plumbing");
});

test("reset and empty helpers", () => {
  const draft = createDefaultExecutiveAIFilters();
  draft.decision = "accepted";
  const reset = resetExecutiveAIFilters(new Date("2026-08-04T12:00:00Z"));
  assert.equal(reset.decision, "");
  assert.equal(isExecutiveAIEmpty(null), true);
  assert.equal(isExecutiveAIEmpty(sampleDashboard({ completed_analyses: 0 })), true);
  assert.equal(isExecutiveAIEmpty(sampleDashboard()), false);
});

test("formatting and badges", () => {
  assert.equal(formatExecutiveRate(0.625), "62.5%");
  assert.match(statusBadgeClass("healthy"), /emerald/);
  assert.match(statusBadgeClass("needs_attention"), /rose/);
  assert.match(trendBadgeClass("increase"), /sky/);
  assert.equal(decisionBarWidth(5, 10), "50%");
  assert.ok(EXECUTIVE_AI_EMPTY_MESSAGE.length > 10);
  assert.ok(EXECUTIVE_AI_DISCLAIMER.includes("not objective"));
});

test("privacy helper", () => {
  const payload = sampleDashboard();
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
