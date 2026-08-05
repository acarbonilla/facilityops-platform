/** FO-085/FO-097 safe AI analysis status presentation helpers. */

export type AiAnalysisUiStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "not_requested"
  | "none";

export type AiAnalysisAudience = "internal" | "requester";

export function resolveAiAnalysisUiStatus(
  status?: string | null,
  options?: { hasAnalyses?: boolean },
): AiAnalysisUiStatus {
  if (
    status === "queued" ||
    status === "processing" ||
    status === "completed" ||
    status === "failed"
  ) {
    return status;
  }
  if (options?.hasAnalyses === false) {
    return "not_requested";
  }
  if (!status) {
    return "none";
  }
  return "none";
}

export function getAiAnalysisStatusTitle(
  status: AiAnalysisUiStatus,
  audience: AiAnalysisAudience = "internal",
): string {
  if (audience === "requester") {
    switch (status) {
      case "queued":
        return "Photos received — review in progress";
      case "processing":
        return "Photos received — review in progress";
      case "completed":
        return "Facilities is reviewing your report";
      case "failed":
        return "AI unavailable — Facilities can still review your report";
      case "not_requested":
        return "No photo analysis";
      default:
        return "";
    }
  }

  switch (status) {
    case "queued":
      return "Image analysis queued";
    case "processing":
      return "Image analysis in progress";
    case "completed":
      return "Image observations available";
    case "failed":
      return "Image analysis could not be completed";
    case "not_requested":
      return "AI analysis not requested";
    default:
      return "";
  }
}

export function getAiAnalysisStatusMessage(
  status: AiAnalysisUiStatus,
  audience: AiAnalysisAudience = "internal",
): string {
  if (audience === "requester") {
    switch (status) {
      case "queued":
      case "processing":
        return "Your photos are being reviewed to help Facilities. This is not a final decision.";
      case "completed":
        return "Photo review finished. The Facilities Team will classify and handle your concern.";
      case "failed":
        return "Photo analysis is unavailable. Your concern was still submitted and Facilities can review it.";
      case "not_requested":
        return "No photos were analyzed for this concern. Facilities can still review your report.";
      default:
        return "";
    }
  }

  switch (status) {
    case "queued":
      return "Image analysis is waiting to begin.";
    case "processing":
      return "FacilityOps AI is reviewing the submitted images.";
    case "completed":
      return "Image observations are available for FM review.";
    case "failed":
      return "Image analysis could not be completed. The ticket remains active and can be processed normally.";
    case "not_requested":
      return "No eligible images were submitted for AI analysis.";
    default:
      return "";
  }
}

export function getAiGeneratedDisclaimer(): string {
  return "AI-generated observations. Human review is required before any operational decision.";
}

export function getRecommendationHumanReviewNotice(): string {
  return "AI recommendations are suggestions only. Final decisions remain with the Facilities Team.";
}

export function shouldShowAiAnalysisPanel(
  status: AiAnalysisUiStatus,
  options?: { audience?: AiAnalysisAudience },
): boolean {
  if (status === "none") {
    return false;
  }
  if (options?.audience === "requester") {
    return (
      status === "queued" ||
      status === "processing" ||
      status === "failed" ||
      status === "completed" ||
      status === "not_requested"
    );
  }
  if (status === "not_requested") {
    return false;
  }
  return true;
}

export function shouldShowStructuredSummary(
  status: AiAnalysisUiStatus,
  audience: AiAnalysisAudience = "internal",
): boolean {
  return audience === "internal" && status === "completed";
}

export function shouldShowRecommendations(
  status: AiAnalysisUiStatus,
  audience: AiAnalysisAudience = "internal",
): boolean {
  return audience === "internal" && status === "completed";
}
