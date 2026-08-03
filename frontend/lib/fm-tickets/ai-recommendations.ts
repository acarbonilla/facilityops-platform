/** FO-086 advisory AI recommendation presentation helpers. */

export type AiRecommendedPriority = "Low" | "Medium" | "High" | "Critical";
export type AiRecommendationSeverity = "Minor" | "Moderate" | "Major" | "Critical";

export type AiRecommendationFinding = {
  title: string;
  description: string;
  confidence: number;
};

export type AiRecommendationView = {
  findings: AiRecommendationFinding[];
  recommendedCategory: string | null;
  recommendedPriority: AiRecommendedPriority | null;
  severity: AiRecommendationSeverity | null;
  confidence: number | null;
  reasoning: string | null;
  requiresHumanReview: boolean;
};

const PRIORITIES = new Set(["Low", "Medium", "High", "Critical"]);
const SEVERITIES = new Set(["Minor", "Moderate", "Major", "Critical"]);

export function getRecommendationDisclaimer(): string {
  return "AI recommendations are suggestions only. Final decisions remain with the Facilities Team.";
}

export function clampConfidence(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function resolveRecommendedPriority(
  value: unknown,
): AiRecommendedPriority | null {
  return typeof value === "string" && PRIORITIES.has(value)
    ? (value as AiRecommendedPriority)
    : null;
}

export function resolveRecommendationSeverity(
  value: unknown,
): AiRecommendationSeverity | null {
  return typeof value === "string" && SEVERITIES.has(value)
    ? (value as AiRecommendationSeverity)
    : null;
}

export function extractRecommendationView(
  payload?: Record<string, unknown> | null,
): AiRecommendationView | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const rawFindings = Array.isArray(payload.findings) ? payload.findings : [];
  const findings: AiRecommendationFinding[] = rawFindings
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const row = item as Record<string, unknown>;
      const title = typeof row.title === "string" ? row.title : "";
      const description =
        typeof row.description === "string" ? row.description : "";
      const confidence = clampConfidence(row.confidence);
      if (!title || !description || confidence === null) {
        return null;
      }
      return { title, description, confidence };
    })
    .filter((item): item is AiRecommendationFinding => item !== null);

  const recommendedCategory =
    typeof payload.recommended_category === "string"
      ? payload.recommended_category
      : null;
  const recommendedPriority = resolveRecommendedPriority(
    payload.recommended_priority,
  );
  const severity = resolveRecommendationSeverity(payload.severity);
  const confidence = clampConfidence(
    payload.overall_confidence ?? payload.confidence,
  );
  const reasoning =
    typeof payload.reasoning === "string" ? payload.reasoning : null;
  const requiresHumanReview =
    typeof payload.requires_human_review === "boolean"
      ? payload.requires_human_review
      : true;

  if (
    findings.length === 0 &&
    !recommendedCategory &&
    !recommendedPriority &&
    !severity &&
    confidence === null &&
    !reasoning
  ) {
    return null;
  }

  return {
    findings,
    recommendedCategory,
    recommendedPriority,
    severity,
    confidence,
    reasoning,
    requiresHumanReview,
  };
}

export function priorityBadgeClass(priority: AiRecommendedPriority): string {
  switch (priority) {
    case "Critical":
      return "bg-rose-100 text-rose-900 ring-rose-200";
    case "High":
      return "bg-orange-100 text-orange-900 ring-orange-200";
    case "Medium":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    default:
      return "bg-slate-100 text-slate-800 ring-slate-200";
  }
}

export function severityBadgeClass(severity: AiRecommendationSeverity): string {
  switch (severity) {
    case "Critical":
      return "bg-rose-100 text-rose-900 ring-rose-200";
    case "Major":
      return "bg-orange-100 text-orange-900 ring-orange-200";
    case "Moderate":
      return "bg-amber-100 text-amber-900 ring-amber-200";
    default:
      return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  }
}
