import {
  getDefaultReportingDateRange,
  toReportingApiDateBounds,
  validateReportingDateRange,
} from "@/lib/reporting/dates";
import type {
  AIOperationalFilterDraft,
  AIOperationalInsights,
  AIOperationalInsightsParams,
} from "@/types/ai-operational-insights";

export const AI_OPERATIONAL_EMPTY_MESSAGE =
  "No AI operational insights are available for this period.";

export const AI_OPERATIONAL_HEALTH_DISCLAIMER =
  "AI Operational Health is an informational workflow score. It is not model accuracy and does not change tickets, prompts, or AI behavior.";

export function createDefaultAIOperationalFilters(
  reference: Date = new Date(),
): AIOperationalFilterDraft {
  const range = getDefaultReportingDateRange(reference);
  return {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  };
}

export function resetAIOperationalFilters(
  reference: Date = new Date(),
): AIOperationalFilterDraft {
  return createDefaultAIOperationalFilters(reference);
}

export function serializeAIOperationalParams(
  draft: AIOperationalFilterDraft,
): AIOperationalInsightsParams | null {
  if (validateReportingDateRange(draft.dateFrom, draft.dateTo)) {
    return null;
  }
  const bounds = toReportingApiDateBounds(draft.dateFrom, draft.dateTo);
  if (!bounds) {
    return null;
  }
  return {
    start_date: bounds.date_from,
    end_date: bounds.date_to,
  };
}

export function isAIOperationalEmpty(
  data?: AIOperationalInsights | null,
): boolean {
  if (!data) {
    return true;
  }
  return data.summary.recommendation_count === 0;
}

export function formatOperationalRate(
  value?: number | null,
  fallback = "—",
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return `${(value * 100).toFixed(1)}%`;
}

export function formatTrendDirection(direction?: string | null): string {
  if (direction === "increasing") {
    return "Increasing";
  }
  if (direction === "decreasing") {
    return "Decreasing";
  }
  return "Stable";
}

export function badgeToneClass(code?: string | null): string {
  switch (code) {
    case "healthy":
    case "improving":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "attention":
    case "declining":
      return "border-rose-200 bg-rose-50 text-rose-900";
    case "needs_review":
      return "border-amber-200 bg-amber-50 text-amber-950";
    default:
      return "border-slate-200 bg-slate-50 text-slate-800";
  }
}

export function buildOperationalHighlightCards(data: AIOperationalInsights) {
  return data.cards.map((card) => ({
    key: card.code,
    label: card.label,
    value: card.display,
    badge: card.badge,
  }));
}

export function containsRequesterIdentity(
  payload: unknown,
  identities: string[],
): boolean {
  const serialized = JSON.stringify(payload ?? {}).toLowerCase();
  return identities.some((identity) =>
    serialized.includes(identity.trim().toLowerCase()),
  );
}
