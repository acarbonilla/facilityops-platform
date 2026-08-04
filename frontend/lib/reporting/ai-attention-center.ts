import {
  getDefaultReportingDateRange,
  toReportingApiDateBounds,
  validateReportingDateRange,
} from "@/lib/reporting/dates";
import type {
  AIAttentionCenter,
  AIAttentionCenterParams,
  AIAttentionFilterDraft,
  AIAttentionItem,
} from "@/types/ai-attention-center";

export const AI_ATTENTION_EMPTY_MESSAGE =
  "No AI attention items require manager review for this period.";

export const AI_ATTENTION_URGENCY_DISCLAIMER =
  "Attention Urgency is an informational management score. It is not model accuracy and does not modify tickets, assignments, or AI behavior.";

export function createDefaultAIAttentionFilters(
  reference: Date = new Date(),
): AIAttentionFilterDraft {
  const range = getDefaultReportingDateRange(reference);
  return {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
  };
}

export function resetAIAttentionFilters(
  reference: Date = new Date(),
): AIAttentionFilterDraft {
  return createDefaultAIAttentionFilters(reference);
}

export function serializeAIAttentionParams(
  draft: AIAttentionFilterDraft,
): AIAttentionCenterParams | null {
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

export function isAIAttentionEmpty(data?: AIAttentionCenter | null): boolean {
  if (!data) {
    return true;
  }
  return (
    data.summary.recommendation_count === 0 ||
    data.attention_items.length === 0
  );
}

export function sortAttentionItemsByUrgency(
  items: AIAttentionItem[],
): AIAttentionItem[] {
  return [...items].sort((a, b) => {
    if (b.urgency_score !== a.urgency_score) {
      return b.urgency_score - a.urgency_score;
    }
    return a.code.localeCompare(b.code);
  });
}

export function urgencyBadgeClass(code?: string | null): string {
  switch (code) {
    case "critical":
      return "border-rose-300 bg-rose-50 text-rose-950";
    case "high":
      return "border-orange-200 bg-orange-50 text-orange-950";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-950";
    default:
      return "border-slate-200 bg-slate-50 text-slate-800";
  }
}

export function formatAttentionRate(
  value?: number | null,
  fallback = "—",
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return `${(value * 100).toFixed(1)}%`;
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
