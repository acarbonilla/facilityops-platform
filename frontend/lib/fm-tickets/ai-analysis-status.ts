/** FO-085 safe AI analysis status presentation helpers. */

export type AiAnalysisUiStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "none";

export function resolveAiAnalysisUiStatus(
  status?: string | null,
): AiAnalysisUiStatus {
  if (!status) {
    return "none";
  }
  if (
    status === "queued" ||
    status === "processing" ||
    status === "completed" ||
    status === "failed"
  ) {
    return status;
  }
  return "none";
}

export function getAiAnalysisStatusTitle(status: AiAnalysisUiStatus): string {
  switch (status) {
    case "queued":
      return "Image analysis queued";
    case "processing":
      return "Image analysis in progress";
    case "completed":
      return "Image observations available";
    case "failed":
      return "Image analysis could not be completed";
    default:
      return "";
  }
}

export function getAiAnalysisStatusMessage(status: AiAnalysisUiStatus): string {
  switch (status) {
    case "queued":
      return "Image analysis is waiting to begin.";
    case "processing":
      return "FacilityOps AI is reviewing the submitted images.";
    case "completed":
      return "Image observations are available for FM review.";
    case "failed":
      return "Image analysis could not be completed. The ticket remains active and can be processed normally.";
    default:
      return "";
  }
}

export function getAiGeneratedDisclaimer(): string {
  return "AI-generated observations. Human review is required before any operational decision.";
}

export function shouldShowAiAnalysisPanel(
  status: AiAnalysisUiStatus,
  options?: { audience?: "internal" | "requester" },
): boolean {
  if (status === "none") {
    return false;
  }
  // Requesters only see lifecycle messaging, not structured observations (FO-087).
  if (options?.audience === "requester") {
    return status === "queued" || status === "processing" || status === "failed" || status === "completed";
  }
  return true;
}

export function shouldShowStructuredSummary(
  status: AiAnalysisUiStatus,
  audience: "internal" | "requester" = "internal",
): boolean {
  return audience === "internal" && status === "completed";
}
