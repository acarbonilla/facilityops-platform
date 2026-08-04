import {
  getDefaultReportingDateRange,
  toReportingApiDateBounds,
  validateReportingDateRange,
} from "@/lib/reporting/dates";
import type {
  AISimilarCaseMatch,
  AISimilarCases,
  AISimilarCasesParams,
  AISimilarFilterDraft,
} from "@/types/ai-similar-cases";

export const AI_SIMILAR_EMPTY_MESSAGE =
  "No similar historical cases met the minimum similarity threshold for this search.";

export const AI_SIMILAR_DISCLAIMER =
  "Similar cases are informational historical references. They never modify the current ticket, categories, priorities, or AI behavior.";

export function createDefaultAISimilarFilters(
  reference: Date = new Date(),
): AISimilarFilterDraft {
  const range = getDefaultReportingDateRange(reference);
  return {
    ticketId: "",
    analysisId: "",
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    category: "",
    priority: "",
    status: "",
    minSimilarity: "40",
    source: "all",
  };
}

export function resetAISimilarFilters(
  reference: Date = new Date(),
): AISimilarFilterDraft {
  return createDefaultAISimilarFilters(reference);
}

export function serializeAISimilarParams(
  draft: AISimilarFilterDraft,
): AISimilarCasesParams | null {
  if (!draft.ticketId.trim() && !draft.analysisId.trim()) {
    return null;
  }
  if (validateReportingDateRange(draft.dateFrom, draft.dateTo)) {
    return null;
  }
  const bounds = toReportingApiDateBounds(draft.dateFrom, draft.dateTo);
  if (!bounds) {
    return null;
  }

  const params: AISimilarCasesParams = {
    start_date: bounds.date_from,
    end_date: bounds.date_to,
    min_similarity: draft.minSimilarity.trim() || "40",
    source: draft.source.trim() || "all",
  };
  if (draft.ticketId.trim()) {
    params.ticket_id = draft.ticketId.trim();
  }
  if (draft.analysisId.trim()) {
    params.analysis_id = draft.analysisId.trim();
  }
  if (draft.category.trim()) {
    params.category = draft.category.trim();
  }
  if (draft.priority.trim()) {
    params.priority = draft.priority.trim();
  }
  if (draft.status.trim()) {
    params.status = draft.status.trim();
  }
  return params;
}

export function isAISimilarEmpty(data?: AISimilarCases | null): boolean {
  if (!data) {
    return true;
  }
  return data.similar_cases.length === 0;
}

export function sortSimilarCasesByScore(
  items: AISimilarCaseMatch[],
): AISimilarCaseMatch[] {
  return [...items].sort((a, b) => {
    if (b.similarity_score !== a.similarity_score) {
      return b.similarity_score - a.similarity_score;
    }
    return a.reference.localeCompare(b.reference);
  });
}

export function similarityBadgeClass(score: number): string {
  if (score >= 80) {
    return "border-emerald-300 bg-emerald-50 text-emerald-950";
  }
  if (score >= 60) {
    return "border-sky-200 bg-sky-50 text-sky-950";
  }
  if (score >= 40) {
    return "border-amber-200 bg-amber-50 text-amber-950";
  }
  return "border-slate-200 bg-slate-50 text-slate-800";
}

export function formatSourceType(sourceType?: string | null): string {
  switch (sourceType) {
    case "fm_ticket":
      return "FM Ticket";
    case "maintenance_work_order":
      return "Maintenance Work Order";
    case "inspection":
      return "5S Inspection";
    default:
      return sourceType || "Case";
  }
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
