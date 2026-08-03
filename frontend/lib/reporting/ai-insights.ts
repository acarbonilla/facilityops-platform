import {
  getDefaultReportingDateRange,
  toReportingApiDateBounds,
  validateReportingDateRange,
} from "@/lib/reporting/dates";
import type {
  AIInsightsFilterDraft,
  AIInsightsParams,
  AIRecommendationInsights,
} from "@/types/ai-insights";

export const AI_INSIGHTS_EMPTY_MESSAGE =
  "No reviewed AI recommendations are available for this period.";

export const AI_INSIGHTS_CONFIDENCE_DISCLAIMER =
  "Confidence values are model-reported and do not guarantee correctness. Category and priority agreement measure human workflow alignment, not ground-truth accuracy.";

export const AI_INSIGHTS_DECISION_OPTIONS = [
  { value: "accepted", label: "Accepted" },
  { value: "modified", label: "Modified" },
  { value: "ignored", label: "Ignored" },
  { value: "pending", label: "Pending Review" },
] as const;

export const AI_INSIGHTS_CATEGORY_OPTIONS = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "hvac", label: "HVAC" },
  { value: "civil", label: "Civil" },
  { value: "safety", label: "Safety" },
  { value: "cleaning", label: "Cleaning" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
] as const;

export const AI_INSIGHTS_PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;

export function createDefaultAIInsightsFilters(
  reference: Date = new Date(),
): AIInsightsFilterDraft {
  const range = getDefaultReportingDateRange(reference);
  return {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    decision: "",
    category: "",
    priority: "",
  };
}

export function resetAIInsightsFilters(
  reference: Date = new Date(),
): AIInsightsFilterDraft {
  return createDefaultAIInsightsFilters(reference);
}

export function serializeAIInsightsParams(
  draft: AIInsightsFilterDraft,
): AIInsightsParams | null {
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
    decision: draft.decision || undefined,
    category: draft.category || undefined,
    priority: draft.priority || undefined,
  };
}

export function formatAIInsightsRate(
  value?: number | null,
  fallback = "—",
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return `${(value * 100).toFixed(1)}%`;
}

export function formatAIInsightsConfidence(
  value?: number | null,
  fallback = "—",
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return `${value.toFixed(1)}`;
}

export function isAIInsightsEmpty(data?: AIRecommendationInsights | null): boolean {
  if (!data) {
    return true;
  }
  return data.summary.recommendation_count === 0;
}

export function buildAIInsightsSummaryCards(data: AIRecommendationInsights) {
  const { summary } = data;
  return [
    {
      key: "recommendations",
      label: "Recommendations",
      value: String(summary.recommendation_count),
    },
    {
      key: "reviewed",
      label: "Reviewed",
      value: String(summary.reviewed_count),
    },
    {
      key: "pending",
      label: "Pending Review",
      value: String(summary.pending_review_count),
    },
    {
      key: "acceptance",
      label: "Acceptance Rate",
      value: formatAIInsightsRate(summary.acceptance_rate),
    },
    {
      key: "modification",
      label: "Modification Rate",
      value: formatAIInsightsRate(summary.modification_rate),
    },
    {
      key: "ignore",
      label: "Ignore Rate",
      value: formatAIInsightsRate(summary.ignore_rate),
    },
    {
      key: "category_agreement",
      label: "Category Agreement",
      value: formatAIInsightsRate(summary.category_agreement_rate),
    },
    {
      key: "priority_agreement",
      label: "Priority Agreement",
      value: formatAIInsightsRate(summary.priority_agreement_rate),
    },
    {
      key: "average_confidence",
      label: "Average Confidence",
      value: formatAIInsightsConfidence(summary.average_confidence),
    },
  ];
}

export function decisionBarWidth(
  count: number,
  maxCount: number,
): number {
  if (maxCount <= 0 || count <= 0) {
    return 0;
  }
  return Math.max(4, Math.round((count / maxCount) * 100));
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
