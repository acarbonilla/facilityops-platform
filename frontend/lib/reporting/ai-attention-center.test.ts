import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_ATTENTION_EMPTY_MESSAGE,
  AI_ATTENTION_URGENCY_DISCLAIMER,
  containsRequesterIdentity,
  createDefaultAIAttentionFilters,
  formatAttentionRate,
  isAIAttentionEmpty,
  resetAIAttentionFilters,
  serializeAIAttentionParams,
  sortAttentionItemsByUrgency,
  urgencyBadgeClass,
} from "./ai-attention-center";
import type {
  AIAttentionCenter,
  AIAttentionItem,
} from "@/types/ai-attention-center";

function sampleItem(
  overrides: Partial<AIAttentionItem> = {},
): AIAttentionItem {
  return {
    code: "high_override_rate",
    category: "override",
    title: "High Override Rate",
    message: "Overrides are elevated.",
    urgency_score: 75,
    priority: { code: "high", label: "High" },
    trend: null,
    suggested_action: {
      code: "action_high_override_rate",
      title: "Investigate repeated overrides",
      message: "Review overrides.",
      actionable: false,
      note: "Informational only.",
    },
    created_at: "2026-08-04T00:00:00Z",
    ...overrides,
  };
}

function sampleCenter(
  overrides: Partial<AIAttentionCenter["summary"]> = {},
  items: AIAttentionItem[] = [sampleItem()],
): AIAttentionCenter {
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
    thresholds: {},
    summary: {
      attention_count: items.length,
      critical_count: 0,
      high_count: 1,
      pending_review_count: 2,
      recommendation_count: 4,
      acceptance_rate: 0.33,
      modification_rate: 0.33,
      operational_health_score: 58,
      operational_health_band: "needs_review",
      ...overrides,
    },
    urgency_score: {
      score: 72,
      level: { code: "high", label: "High" },
      components: {
        pending: 50,
        override: 33,
        health_inverse: 42,
        trend: 100,
        confidence: 0,
        volume: 8,
      },
      weights: {
        pending: 0.25,
        override: 0.2,
        health_inverse: 0.2,
        trend: 0.15,
        confidence: 0.1,
        volume: 0.1,
      },
      interpretation: "Informational.",
    },
    attention_items: items,
    critical_items: [],
    groups: [],
    trend: {},
    operational_health: {
      score: 58,
      band: "needs_review",
      label: "Needs Review",
      components: {},
    },
    pending_review_summary: {
      pending_review_count: 2,
      recommendation_count: 4,
      reviewed_count: 3,
    },
    recent_review_activity: {
      accepted_rate: 0.33,
      modification_rate: 0.33,
      ignore_rate: 0.33,
      full_agreement_rate: 0.5,
      note: "Aggregate only.",
    },
    interpretation: {
      note: "Informational queue.",
      labels: { urgency: "Attention Urgency" },
    },
    generated_at: "2026-08-04T00:00:00Z",
  };
}

test("default filters serialize to a valid date window", () => {
  const draft = createDefaultAIAttentionFilters(
    new Date("2026-08-04T12:00:00Z"),
  );
  const params = serializeAIAttentionParams(draft);
  assert.ok(params);
  assert.equal(typeof params?.start_date, "string");
});

test("invalid dates serialize to null and reset restores defaults", () => {
  assert.equal(
    serializeAIAttentionParams({
      dateFrom: "2026-08-01",
      dateTo: "2026-07-01",
    }),
    null,
  );
  const reference = new Date("2026-08-04T12:00:00Z");
  assert.deepEqual(
    resetAIAttentionFilters(reference),
    createDefaultAIAttentionFilters(reference),
  );
});

test("empty detection and formatters", () => {
  assert.equal(isAIAttentionEmpty(sampleCenter()), false);
  assert.equal(
    isAIAttentionEmpty(sampleCenter({ recommendation_count: 0 }, [])),
    true,
  );
  assert.equal(formatAttentionRate(0.333), "33.3%");
  assert.ok(AI_ATTENTION_EMPTY_MESSAGE.length > 0);
  assert.match(AI_ATTENTION_URGENCY_DISCLAIMER, /not model accuracy/i);
});

test("sorts attention items by urgency descending", () => {
  const sorted = sortAttentionItemsByUrgency([
    sampleItem({ code: "a", urgency_score: 40 }),
    sampleItem({ code: "b", urgency_score: 90 }),
    sampleItem({ code: "c", urgency_score: 70 }),
  ]);
  assert.deepEqual(
    sorted.map((item) => item.urgency_score),
    [90, 70, 40],
  );
});

test("urgency badge classes remain accessible labels", () => {
  assert.match(urgencyBadgeClass("critical"), /rose/);
  assert.match(urgencyBadgeClass("high"), /orange/);
  assert.match(urgencyBadgeClass("medium"), /amber/);
  assert.match(urgencyBadgeClass("low"), /slate/);
});

test("privacy helper and actionable false contract", () => {
  const data = sampleCenter();
  assert.equal(data.attention_items[0]?.suggested_action.actionable, false);
  assert.equal(
    containsRequesterIdentity(data, ["fo090-manager@example.com"]),
    false,
  );
  assert.equal(
    containsRequesterIdentity(
      { leak: "fo090-manager@example.com" },
      ["fo090-manager@example.com"],
    ),
    true,
  );
});
