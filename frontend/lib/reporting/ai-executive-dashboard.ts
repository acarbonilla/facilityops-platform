import {
  getDefaultReportingDateRange,
  toReportingApiDateBounds,
  validateReportingDateRange,
} from "@/lib/reporting/dates";
import type {
  ExecutiveAIDashboard,
  ExecutiveAIDashboardParams,
  ExecutiveAIFilterDraft,
} from "@/types/ai-executive-dashboard";

export const EXECUTIVE_AI_EMPTY_MESSAGE =
  "No eligible AI recommendation data is available for this period.";

export const EXECUTIVE_AI_DISCLAIMER =
  "Executive AI metrics describe recommendation adoption and human review outcomes. They are not objective accuracy, employee performance, or safety compliance scores.";

export function createDefaultExecutiveAIFilters(
  reference: Date = new Date(),
): ExecutiveAIFilterDraft {
  const range = getDefaultReportingDateRange(reference);
  return {
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    decision: "",
    category: "",
    priority: "",
  };
}

export function resetExecutiveAIFilters(
  reference: Date = new Date(),
): ExecutiveAIFilterDraft {
  return createDefaultExecutiveAIFilters(reference);
}

export function serializeExecutiveAIParams(
  draft: ExecutiveAIFilterDraft,
): ExecutiveAIDashboardParams | null {
  if (validateReportingDateRange(draft.dateFrom, draft.dateTo)) {
    return null;
  }
  const bounds = toReportingApiDateBounds(draft.dateFrom, draft.dateTo);
  if (!bounds) {
    return null;
  }
  const params: ExecutiveAIDashboardParams = {
    start_date: bounds.date_from,
    end_date: bounds.date_to,
  };
  if (draft.decision.trim()) {
    params.decision = draft.decision.trim();
  }
  if (draft.category.trim()) {
    params.category = draft.category.trim();
  }
  if (draft.priority.trim()) {
    params.priority = draft.priority.trim();
  }
  return params;
}

export function isExecutiveAIEmpty(data?: ExecutiveAIDashboard | null): boolean {
  if (!data) {
    return true;
  }
  return data.summary.completed_analyses === 0;
}

export function formatExecutiveRate(
  value?: number | null,
  fallback = "—",
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }
  return `${(value * 100).toFixed(1)}%`;
}

export function statusBadgeClass(status?: string | null): string {
  switch (status) {
    case "healthy":
      return "border-emerald-300 bg-emerald-50 text-emerald-950";
    case "needs_attention":
      return "border-rose-300 bg-rose-50 text-rose-950";
    default:
      return "border-slate-200 bg-slate-50 text-slate-800";
  }
}

export function trendBadgeClass(direction?: string | null): string {
  switch (direction) {
    case "increase":
      return "border-sky-200 bg-sky-50 text-sky-950";
    case "decrease":
      return "border-amber-200 bg-amber-50 text-amber-950";
    default:
      return "border-slate-200 bg-slate-50 text-slate-800";
  }
}

export function decisionBarWidth(count: number, total: number): string {
  if (total <= 0 || count <= 0) {
    return "0%";
  }
  return `${Math.max(4, Math.round((count / total) * 100))}%`;
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
