/** FO-097 AI-first employee submission helpers (frontend). */

export type EmployeeSubmitPhase =
  | "idle"
  | "creating_ticket"
  | "uploading_images"
  | "queueing_ai"
  | "completed"
  | "failed";

export type EmployeeAiOutcome =
  | "not_requested"
  | "queued"
  | "unavailable"
  | "partial_upload";

export function getEmployeeSubmitPhaseLabel(phase: EmployeeSubmitPhase): string {
  switch (phase) {
    case "creating_ticket":
      return "Creating concern…";
    case "uploading_images":
      return "Uploading images…";
    case "queueing_ai":
      return "Preparing AI analysis…";
    case "completed":
      return "Concern submitted successfully.";
    case "failed":
      return "Unable to submit concern.";
    default:
      return "";
  }
}

export function buildEmployeeSubmitSuccessHref(
  basePath: string,
  options?: {
    aiOutcome?: EmployeeAiOutcome;
    uploadedCount?: number;
    failedUploadCount?: number;
  },
): string {
  const params = new URLSearchParams();
  params.set("created", "1");
  const outcome = options?.aiOutcome ?? "not_requested";
  const failed = options?.failedUploadCount ?? 0;

  if (outcome === "queued") {
    params.set("ai_queued", "1");
  } else if (outcome === "unavailable") {
    params.set("ai_unavailable", "1");
  } else if (outcome === "not_requested") {
    params.set("ai_not_requested", "1");
  }

  if (failed > 0 || outcome === "partial_upload") {
    params.set("upload_partial", "1");
    if (outcome === "partial_upload" && !params.has("ai_queued") && !params.has("ai_unavailable")) {
      // Partial with no successful AI path still marks not requested unless queued/unavailable set.
      if (!params.has("ai_not_requested")) {
        params.set("ai_not_requested", "1");
      }
    }
  }

  if (typeof options?.uploadedCount === "number") {
    params.set("uploaded", String(options.uploadedCount));
  }
  if (failed > 0) {
    params.set("upload_failed", String(failed));
  }
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}${params.toString()}`;
}

export function readAiUnavailableFromSearch(
  search: string | null | undefined,
): boolean {
  if (!search) {
    return false;
  }
  const params = new URLSearchParams(
    search.startsWith("?") ? search : `?${search}`,
  );
  return params.get("ai_unavailable") === "1";
}

export function readAiNotRequestedFromSearch(
  search: string | null | undefined,
): boolean {
  if (!search) {
    return false;
  }
  const params = new URLSearchParams(
    search.startsWith("?") ? search : `?${search}`,
  );
  return params.get("ai_not_requested") === "1";
}

export function readUploadPartialFromSearch(
  search: string | null | undefined,
): boolean {
  if (!search) {
    return false;
  }
  const params = new URLSearchParams(
    search.startsWith("?") ? search : `?${search}`,
  );
  return params.get("upload_partial") === "1";
}

export type RequesterTimelineStep = {
  id: string;
  label: string;
  state: "complete" | "current" | "upcoming";
};

/**
 * Build a requester-safe intake timeline from ticket + AI UI status.
 * Does not expose internal FM workflow details.
 */
export function buildRequesterIntakeTimeline(options: {
  ticketStatus: string;
  aiStatus: "not_requested" | "queued" | "processing" | "completed" | "failed" | "none";
  hasImages: boolean;
  resolved?: boolean;
}): RequesterTimelineStep[] {
  const { ticketStatus, aiStatus, hasImages, resolved } = options;
  const isClosed =
    ticketStatus === "closed" || ticketStatus === "cancelled";
  const isResolved =
    resolved || ticketStatus === "resolved" || isClosed;
  const awaitingReview =
    !isResolved &&
    (aiStatus === "completed" ||
      aiStatus === "failed" ||
      aiStatus === "not_requested" ||
      aiStatus === "none");

  const steps: RequesterTimelineStep[] = [
    { id: "submitted", label: "Submitted", state: "complete" },
  ];

  if (hasImages) {
    steps.push({
      id: "images",
      label: "Images uploaded",
      state: "complete",
    });
  }

  if (aiStatus === "queued" || aiStatus === "processing") {
    steps.push({
      id: "ai",
      label:
        aiStatus === "queued" ? "AI analysis queued" : "AI analysis in progress",
      state: "current",
    });
    steps.push({
      id: "review",
      label: "Awaiting Facilities review",
      state: "upcoming",
    });
  } else if (aiStatus === "completed") {
    steps.push({
      id: "ai",
      label: "AI analysis completed",
      state: "complete",
    });
    steps.push({
      id: "review",
      label: isResolved ? "Facilities reviewed" : "Awaiting Facilities review",
      state: isResolved ? "complete" : "current",
    });
  } else if (aiStatus === "failed") {
    steps.push({
      id: "ai",
      label: "AI unavailable",
      state: "complete",
    });
    steps.push({
      id: "review",
      label: isResolved ? "Facilities reviewed" : "Awaiting Facilities review",
      state: isResolved ? "complete" : "current",
    });
  } else {
    // not_requested / none
    steps.push({
      id: "review",
      label: isResolved ? "Facilities reviewed" : "Awaiting Facilities review",
      state: awaitingReview && !isResolved ? "current" : isResolved ? "complete" : "current",
    });
  }

  if (isResolved) {
    steps.push({
      id: "resolved",
      label: ticketStatus === "cancelled" ? "Cancelled" : "Resolved",
      state: "complete",
    });
  } else {
    steps.push({
      id: "resolved",
      label: "Resolved",
      state: "upcoming",
    });
  }

  return steps;
}
