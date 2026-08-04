import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_SIMILAR_DISCLAIMER,
  AI_SIMILAR_EMPTY_MESSAGE,
  containsRequesterIdentity,
  createDefaultAISimilarFilters,
  formatSourceType,
  isAISimilarEmpty,
  resetAISimilarFilters,
  serializeAISimilarParams,
  similarityBadgeClass,
  sortSimilarCasesByScore,
} from "./ai-similar-cases";
import type {
  AISimilarCaseMatch,
  AISimilarCases,
} from "@/types/ai-similar-cases";

function sampleMatch(
  overrides: Partial<AISimilarCaseMatch> = {},
): AISimilarCaseMatch {
  return {
    source_type: "fm_ticket",
    case_id: "case-1",
    reference: "T-100",
    title: "HVAC leak",
    category: "hvac",
    priority: "high",
    status: "closed",
    building_code: "bldg-a",
    asset_code: "hvac-1",
    similarity_score: 85,
    reasons: ["Category matched (Hvac)", "Same asset (hvac-1)"],
    components: { category: 25, asset: 15 },
    historical_outcome: {
      resolved_category: "hvac",
      resolved_priority: "high",
      status: "closed",
      resolution_summary: "Leak repaired.",
      decision_outcome: "accepted",
    },
    ai_decision_summary: {
      recommended_category: "hvac",
      recommended_priority: "high",
      has_findings: true,
      note: "AI suggestion snapshot only.",
    },
    human_decision_summary: {
      decision_outcome: "accepted",
      final_category: "hvac",
      final_priority: "high",
      note: "Human decision remains authoritative.",
    },
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function samplePayload(
  matches: AISimilarCaseMatch[] = [sampleMatch()],
): AISimilarCases {
  return {
    period: {
      start_date: "2026-05-01",
      end_date: "2026-08-01",
      preset: "last_90_days",
      inclusive: true,
      max_range_days: 180,
    },
    filters: {
      ticket_id: "ticket-1",
      min_similarity: 40,
      source: "all",
    },
    algorithm: {
      version: "rule_v1",
      name: "weighted_rule_similarity",
      weights: { category: 25, keywords: 20 },
      note: "Rule-based Version 1 matcher.",
    },
    current_case: {
      source_type: "fm_ticket",
      case_id: "ticket-1",
      reference: "T-001",
      title: "Current HVAC issue",
      category: "hvac",
      priority: "high",
      status: "open",
    },
    similar_cases: matches,
    summary: {
      match_count: matches.length,
      candidate_evaluated: matches.length,
      min_similarity: 40,
      top_score: matches[0]?.similarity_score ?? 0,
    },
    interpretation: {
      note: "Informational only.",
      labels: { score: "Similarity Score" },
    },
    generated_at: "2026-08-04T00:00:00Z",
  };
}

test("default filters include date range and min similarity", () => {
  const draft = createDefaultAISimilarFilters(new Date("2026-08-04T12:00:00Z"));
  assert.equal(draft.minSimilarity, "40");
  assert.equal(draft.source, "all");
  assert.ok(draft.dateFrom);
  assert.ok(draft.dateTo);
});

test("serialize requires ticket or analysis id", () => {
  const draft = createDefaultAISimilarFilters(new Date("2026-08-04T12:00:00Z"));
  assert.equal(serializeAISimilarParams(draft), null);
  draft.ticketId = "11111111-1111-1111-1111-111111111111";
  const params = serializeAISimilarParams(draft);
  assert.ok(params);
  assert.equal(params?.ticket_id, draft.ticketId);
  assert.equal(params?.min_similarity, "40");
});

test("reset clears ticket identifiers", () => {
  const draft = createDefaultAISimilarFilters();
  draft.ticketId = "abc";
  const reset = resetAISimilarFilters(new Date("2026-08-04T12:00:00Z"));
  assert.equal(reset.ticketId, "");
  assert.equal(reset.analysisId, "");
});

test("empty state helper and sorting", () => {
  assert.equal(isAISimilarEmpty(null), true);
  assert.equal(isAISimilarEmpty(samplePayload([])), true);
  assert.equal(isAISimilarEmpty(samplePayload()), false);

  const sorted = sortSimilarCasesByScore([
    sampleMatch({ reference: "B", similarity_score: 50 }),
    sampleMatch({ reference: "A", similarity_score: 90 }),
    sampleMatch({ reference: "C", similarity_score: 90 }),
  ]);
  assert.deepEqual(
    sorted.map((item) => item.reference),
    ["A", "C", "B"],
  );
});

test("score badge, source labels, and empty copy", () => {
  assert.match(similarityBadgeClass(90), /emerald/);
  assert.match(similarityBadgeClass(65), /sky/);
  assert.match(similarityBadgeClass(45), /amber/);
  assert.equal(formatSourceType("fm_ticket"), "FM Ticket");
  assert.equal(formatSourceType("maintenance_work_order"), "Maintenance Work Order");
  assert.equal(formatSourceType("inspection"), "5S Inspection");
  assert.ok(AI_SIMILAR_EMPTY_MESSAGE.length > 10);
  assert.ok(AI_SIMILAR_DISCLAIMER.includes("informational"));
});

test("privacy helper detects requester identities", () => {
  const payload = samplePayload();
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
