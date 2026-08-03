import assert from "node:assert/strict";
import test from "node:test";

import {
  clampConfidence,
  decisionBadgeClass,
  extractRecommendationView,
  formatDecisionLabel,
  formatTicketCategoryLabel,
  formatTicketPriorityLabel,
  getDecisionAnnouncement,
  getRecommendationDisclaimer,
  mapAiCategoryToTicket,
  mapAiPriorityToTicket,
  priorityBadgeClass,
  resolveRecommendedPriority,
  resolveRecommendationSeverity,
  severityBadgeClass,
} from "./ai-recommendations";

test("extractRecommendationView maps FO-086 payload", () => {
  const view = extractRecommendationView({
    findings: [
      {
        title: "Water leak",
        description: "Visible dripping near fixture",
        confidence: 82,
      },
    ],
    recommended_category: "Plumbing",
    recommended_priority: "Medium",
    severity: "Moderate",
    overall_confidence: 78,
    reasoning: "Visible water stains indicate a plumbing issue.",
    requires_human_review: true,
  });

  assert.ok(view);
  assert.equal(view?.findings.length, 1);
  assert.equal(view?.recommendedCategory, "Plumbing");
  assert.equal(view?.recommendedPriority, "Medium");
  assert.equal(view?.severity, "Moderate");
  assert.equal(view?.confidence, 78);
  assert.match(view?.reasoning || "", /plumbing/i);
  assert.equal(view?.requiresHumanReview, true);
});

test("clampConfidence and badge helpers", () => {
  assert.equal(clampConfidence(120), 100);
  assert.equal(clampConfidence(-5), 0);
  assert.equal(resolveRecommendedPriority("High"), "High");
  assert.equal(resolveRecommendedPriority("urgent"), null);
  assert.equal(resolveRecommendationSeverity("Minor"), "Minor");
  assert.match(priorityBadgeClass("Critical"), /rose/);
  assert.match(severityBadgeClass("Major"), /orange/);
  assert.match(getRecommendationDisclaimer(), /Facilities Team/);
});

test("extractRecommendationView returns null for empty payload", () => {
  assert.equal(extractRecommendationView({}), null);
  assert.equal(extractRecommendationView(null), null);
});

test("recommendation rendering helpers cover confidence severity priority reasoning", () => {
  const view = extractRecommendationView({
    findings: [
      { title: "Broken chair", description: "Seat cracked", confidence: 55 },
      { title: "Unknown", description: "Ambiguous", confidence: 12 },
    ],
    recommended_category: "Carpentry",
    recommended_priority: "High",
    severity: "Major",
    confidence: 61,
    reasoning: "Chair damage is visible; High priority is recommended.",
    requires_human_review: true,
  });

  assert.equal(view?.findings.length, 2);
  assert.equal(view?.confidence, 61);
  assert.equal(view?.severity, "Major");
  assert.equal(view?.recommendedPriority, "High");
  assert.match(view?.reasoning || "", /Chair damage/i);
  assert.equal(view?.requiresHumanReview, true);
  assert.match(priorityBadgeClass("High"), /orange|amber|rose|sky|slate/i);
  assert.match(severityBadgeClass("Major"), /orange/);
  assert.match(getRecommendationDisclaimer(), /suggestions only/i);
});

test("FO-087 mapping and decision helpers", () => {
  assert.equal(mapAiCategoryToTicket("Plumbing"), "plumbing");
  assert.equal(mapAiCategoryToTicket("Housekeeping"), "cleaning");
  assert.equal(mapAiPriorityToTicket("Critical"), "urgent");
  assert.equal(mapAiPriorityToTicket("Medium"), "medium");
  assert.equal(formatDecisionLabel("accepted"), "Accepted");
  assert.equal(formatDecisionLabel("modified"), "Modified");
  assert.equal(formatDecisionLabel("ignored"), "Ignored");
  assert.match(decisionBadgeClass("accepted"), /emerald/);
  assert.match(decisionBadgeClass("modified"), /amber/);
  assert.match(getDecisionAnnouncement("accepted"), /filled into the ticket form/i);
  assert.match(getDecisionAnnouncement("ignored"), /manual/i);
  assert.equal(formatTicketCategoryLabel("civil"), "Civil");
  assert.equal(formatTicketPriorityLabel("urgent"), "Urgent");
  assert.match(getRecommendationDisclaimer(), /Facilities Team/);
});

test("FO-087 comparison labels cover accept modify ignore flows", () => {
  assert.equal(formatDecisionLabel(null), "Pending review");
  assert.match(getDecisionAnnouncement("modified"), /modified/i);
  assert.equal(mapAiCategoryToTicket("Unknown"), "other");
  assert.equal(mapAiPriorityToTicket("High"), "high");
});
