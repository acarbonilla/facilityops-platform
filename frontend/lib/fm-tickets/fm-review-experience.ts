/** FO-098 Facility Manager guided review helpers. */

import type {
  FmTicketCategory,
  FmTicketDetail,
  FmTicketPriority,
} from "@/types/fm-tickets";

export type FmReviewFieldIndicator =
  | "needs_review"
  | "recommended"
  | "accepted"
  | "modified"
  | "ignored"
  | "changed"
  | "complete";

export type FmReviewStepId =
  | "employee_report"
  | "ai_recommendation"
  | "operational_classification"
  | "ai_decision"
  | "operational_assignment"
  | "actions";

export type FmClassificationBlockReason =
  | "unclassified_category"
  | "pending_priority"
  | "missing_building"
  | null;

export function isUnclassifiedCategory(category?: string | null): boolean {
  return category === "unclassified";
}

export function isPendingReviewPriority(priority?: string | null): boolean {
  return priority === "pending_review";
}

export function getClassificationBlockReason(
  ticket: Pick<FmTicketDetail, "category" | "priority" | "building">,
): FmClassificationBlockReason {
  if (isUnclassifiedCategory(ticket.category)) {
    return "unclassified_category";
  }
  if (isPendingReviewPriority(ticket.priority)) {
    return "pending_priority";
  }
  if (!ticket.building) {
    return "missing_building";
  }
  return null;
}

export function isOperationalClassificationComplete(
  ticket: Pick<FmTicketDetail, "category" | "priority" | "building">,
): boolean {
  return getClassificationBlockReason(ticket) === null;
}

export function formatClassificationBlockReason(
  reason: FmClassificationBlockReason,
): string | null {
  switch (reason) {
    case "unclassified_category":
      return "Set a final category before assignment or work-order actions.";
    case "pending_priority":
      return "Set a final priority before assignment or work-order actions.";
    case "missing_building":
      return "Set a building before assignment or work-order actions.";
    default:
      return null;
  }
}

export function getCategoryFieldIndicator(
  category: FmTicketCategory | string | null | undefined,
): FmReviewFieldIndicator {
  return isUnclassifiedCategory(category) ? "needs_review" : "complete";
}

export function getPriorityFieldIndicator(
  priority: FmTicketPriority | string | null | undefined,
): FmReviewFieldIndicator {
  return isPendingReviewPriority(priority) ? "needs_review" : "complete";
}

export function getBuildingFieldIndicator(
  building?: string | null,
): FmReviewFieldIndicator {
  return building ? "complete" : "needs_review";
}

export function decisionToFieldIndicator(
  decision?: string | null,
): FmReviewFieldIndicator | null {
  if (decision === "accepted") return "accepted";
  if (decision === "modified") return "modified";
  if (decision === "ignored") return "ignored";
  return null;
}

export function formatFieldIndicatorLabel(
  indicator: FmReviewFieldIndicator,
): string {
  switch (indicator) {
    case "needs_review":
      return "Needs review";
    case "recommended":
      return "Recommended";
    case "accepted":
      return "Accepted";
    case "modified":
      return "Modified";
    case "ignored":
      return "Ignored";
    case "changed":
      return "Changed";
    case "complete":
      return "Complete";
    default:
      return "Review";
  }
}

export function fieldIndicatorClass(indicator: FmReviewFieldIndicator): string {
  switch (indicator) {
    case "needs_review":
      return "bg-amber-100 text-amber-950 ring-amber-200";
    case "recommended":
      return "bg-sky-100 text-sky-950 ring-sky-200";
    case "accepted":
      return "bg-emerald-100 text-emerald-950 ring-emerald-200";
    case "modified":
      return "bg-indigo-100 text-indigo-950 ring-indigo-200";
    case "ignored":
      return "bg-slate-200 text-slate-800 ring-slate-300";
    case "changed":
      return "bg-violet-100 text-violet-950 ring-violet-200";
    case "complete":
      return "bg-emerald-50 text-emerald-900 ring-emerald-200";
    default:
      return "bg-slate-100 text-slate-800 ring-slate-200";
  }
}

export function valuesDiffer(
  left?: string | null,
  right?: string | null,
): boolean {
  const a = (left || "").trim().toLowerCase();
  const b = (right || "").trim().toLowerCase();
  if (!a && !b) return false;
  return a !== b;
}

export function buildReviewGuidanceSteps(args: {
  classificationComplete: boolean;
  hasAiDecision: boolean;
  aiCompleted: boolean;
}): Array<{ id: FmReviewStepId; label: string; status: "current" | "done" | "upcoming" }> {
  const steps: Array<{ id: FmReviewStepId; label: string }> = [
    { id: "employee_report", label: "Employee report" },
    { id: "ai_recommendation", label: "AI recommendation" },
    { id: "operational_classification", label: "Operational classification" },
    { id: "ai_decision", label: "AI decision" },
    { id: "operational_assignment", label: "Assignment & SLA" },
    { id: "actions", label: "Workflow actions" },
  ];

  let currentIndex = 0;
  if (!args.classificationComplete) {
    currentIndex = args.aiCompleted && !args.hasAiDecision ? 3 : 2;
  } else if (!args.hasAiDecision && args.aiCompleted) {
    currentIndex = 3;
  } else {
    currentIndex = 4;
  }

  return steps.map((step, index) => ({
    ...step,
    status:
      index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
  }));
}

export const FM_REVIEW_LAYOUT_DESCRIPTION =
  "Review the employee report and AI advisory recommendation, then set final operational values. AI never makes operational decisions.";
