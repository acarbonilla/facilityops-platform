import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_OPERATIONAL_EMPTY_MESSAGE,
  AI_OPERATIONAL_HEALTH_DISCLAIMER,
  badgeToneClass,
  buildOperationalHighlightCards,
  containsRequesterIdentity,
  createDefaultAIOperationalFilters,
  formatOperationalRate,
  formatTrendDirection,
  isAIOperationalEmpty,
  resetAIOperationalFilters,
  serializeAIOperationalParams,
} from "./ai-operational-insights";
import type { AIOperationalInsights } from "@/types/ai-operational-insights";

function sampleInsights(
  overrides: Partial<AIOperationalInsights["summary"]> = {},
): AIOperationalInsights {
  return {
    period: {
      start_date: "2026-07-01",
      end_date: "2026-07-30",
      inclusive: true,
      max_range_days: 180,
    },
    comparison_period: {
      start_date: "2026-06-01",
      end_date: "2026-06-30",
      inclusive: true,
      max_range_days: 180,
    },
    filters: {},
    thresholds: {
      high_override_rate: 0.4,
      pending_review_count: 10,
    },
    summary: {
      recommendation_count: 4,
      reviewed_count: 3,
      pending_review_count: 1,
      acceptance_rate: 0.3333,
      modification_rate: 0.3333,
      ignore_rate: 0.3333,
      full_agreement_rate: 0.5,
      average_confidence: 63.8,
      ...overrides,
    },
    health_score: {
      score: 58,
      band: "needs_review",
      label: "Needs Review",
      components: {
        acceptance: 33.3,
        agreement: 50,
        pending_throughput: 75,
        confidence: 63.8,
      },
      weights: {
        acceptance: 0.3,
        agreement: 0.3,
        pending_throughput: 0.2,
        confidence: 0.2,
      },
      interpretation: "Informational workflow score.",
    },
    trend: {
      acceptance: {
        direction: "increasing",
        badge: { code: "improving", label: "Improving" },
        current: 0.3333,
        previous: 0,
        delta: 0.3333,
      },
      override: {
        direction: "stable",
        badge: { code: "stable", label: "Stable" },
        current: 0.3333,
        previous: 0.3,
        delta: 0.0333,
      },
      confidence: {
        direction: "increasing",
        badge: { code: "improving", label: "Improving" },
        current: 63.8,
        previous: 45,
        delta: 18.8,
      },
      agreement: {
        direction: "increasing",
        badge: { code: "improving", label: "Improving" },
        current: 0.5,
        previous: 0,
        delta: 0.5,
      },
      volume: {
        direction: "increasing",
        badge: { code: "improving", label: "Improving" },
        current: 4,
        previous: 2,
        delta: 2,
      },
    },
    comparison: {
      current: {
        recommendation_count: 4,
        acceptance_rate: 0.3333,
        modification_rate: 0.3333,
        full_agreement_rate: 0.5,
        average_confidence: 63.8,
        pending_review_count: 1,
      },
      previous: {
        recommendation_count: 2,
        acceptance_rate: 0,
        modification_rate: 0.5,
        full_agreement_rate: 0,
        average_confidence: 45,
        pending_review_count: 0,
      },
    },
    insights: [
      {
        code: "high_override_rate",
        severity: "attention",
        badge: { code: "attention", label: "Attention" },
        title: "High Override Rate",
        message: "Overrides are elevated.",
      },
    ],
    recommendations: [
      {
        code: "review_category_guidelines",
        title: "Review category guidelines",
        message: "Review Plumbing category guidelines.",
        actionable: false,
        note: "Informational only.",
      },
    ],
    cards: [
      {
        code: "health",
        label: "AI Operational Health",
        value: 58,
        display: "58",
        badge: { code: "needs_review", label: "Needs Review" },
      },
      {
        code: "pending_reviews",
        label: "Pending Reviews",
        value: 1,
        display: "1",
        badge: { code: "needs_review", label: "Needs Review" },
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
    priority_overrides: [],
    manager_notes: {
      placeholder: true,
      message: "Read-only placeholder.",
    },
    interpretation: {
      note: "Rule-based insights only.",
      labels: { health: "AI Operational Health" },
    },
  };
}

test("default filters produce a valid reporting date window", () => {
  const draft = createDefaultAIOperationalFilters(
    new Date("2026-08-04T12:00:00Z"),
  );
  const params = serializeAIOperationalParams(draft);
  assert.ok(params);
  assert.equal(typeof params?.start_date, "string");
  assert.equal(typeof params?.end_date, "string");
});

test("invalid date range serializes to null", () => {
  assert.equal(
    serializeAIOperationalParams({ dateFrom: "2026-08-01", dateTo: "2026-07-01" }),
    null,
  );
});

test("reset restores default filters", () => {
  const reset = resetAIOperationalFilters(new Date("2026-08-04T12:00:00Z"));
  const defaults = createDefaultAIOperationalFilters(
    new Date("2026-08-04T12:00:00Z"),
  );
  assert.deepEqual(reset, defaults);
});

test("formatters and empty detection", () => {
  assert.equal(formatOperationalRate(0.3333), "33.3%");
  assert.equal(formatOperationalRate(null), "—");
  assert.equal(formatTrendDirection("increasing"), "Increasing");
  assert.equal(formatTrendDirection("decreasing"), "Decreasing");
  assert.equal(formatTrendDirection("stable"), "Stable");
  assert.equal(isAIOperationalEmpty(sampleInsights()), false);
  assert.equal(
    isAIOperationalEmpty(sampleInsights({ recommendation_count: 0 })),
    true,
  );
  assert.ok(AI_OPERATIONAL_EMPTY_MESSAGE.length > 0);
  assert.match(AI_OPERATIONAL_HEALTH_DISCLAIMER, /not model accuracy/i);
});

test("highlight cards map health and pending displays", () => {
  const cards = buildOperationalHighlightCards(sampleInsights());
  assert.equal(cards[0]?.key, "health");
  assert.equal(cards[0]?.value, "58");
  assert.equal(cards[1]?.badge.label, "Needs Review");
});

test("badge tone classes remain accessible text colors", () => {
  assert.match(badgeToneClass("healthy"), /emerald/);
  assert.match(badgeToneClass("attention"), /rose/);
  assert.match(badgeToneClass("needs_review"), /amber/);
  assert.match(badgeToneClass("stable"), /slate/);
});

test("privacy helper detects requester identities", () => {
  assert.equal(
    containsRequesterIdentity(
      { leak: "fo089-manager@example.com" },
      ["fo089-manager@example.com"],
    ),
    true,
  );
  assert.equal(
    containsRequesterIdentity(sampleInsights(), ["fo089-manager@example.com"]),
    false,
  );
});

test("sample insights expose recommendation and trend structures", () => {
  const data = sampleInsights();
  assert.equal(data.recommendations[0]?.actionable, false);
  assert.equal(data.trend.acceptance.direction, "increasing");
  assert.equal(data.manager_notes.placeholder, true);
});
