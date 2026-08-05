/** FO-099 intelligent intake notification copy and target helpers. */

export const FO099_EVENT_CODES = {
  employeeConcernCreated: "fm_ticket.employee_concern_created",
  employeeConcernSubmitted: "fm_ticket.employee_concern_submitted",
  aiAnalysisReady: "fm_ticket.ai_analysis_ready",
  aiAnalysisFailed: "fm_ticket.ai_analysis_failed",
  classificationCompleted: "fm_ticket.classification_completed",
} as const;

export function getFo099NotificationTitle(eventCode: string): string | null {
  switch (eventCode) {
    case FO099_EVENT_CODES.employeeConcernCreated:
      return "A new employee facility concern requires review.";
    case FO099_EVENT_CODES.employeeConcernSubmitted:
      return "Your facility concern was submitted successfully.";
    case FO099_EVENT_CODES.aiAnalysisReady:
      return "AI findings are ready. Review and confirm the ticket classification.";
    case FO099_EVENT_CODES.aiAnalysisFailed:
      return "AI analysis was unavailable. Continue with manual review.";
    case FO099_EVENT_CODES.classificationCompleted:
      return "Your facility concern is under Facilities review.";
    default:
      return null;
  }
}

export function isFo099InternalEvent(eventCode: string): boolean {
  return (
    eventCode === FO099_EVENT_CODES.employeeConcernCreated ||
    eventCode === FO099_EVENT_CODES.aiAnalysisReady ||
    eventCode === FO099_EVENT_CODES.aiAnalysisFailed
  );
}

export function isFo099RequesterEvent(eventCode: string): boolean {
  return (
    eventCode === FO099_EVENT_CODES.employeeConcernSubmitted ||
    eventCode === FO099_EVENT_CODES.classificationCompleted
  );
}

export function expectedFo099TargetPath(
  eventCode: string,
  ticketId: string,
): string | null {
  if (isFo099InternalEvent(eventCode)) {
    return `/fm-tickets/${ticketId}`;
  }
  if (isFo099RequesterEvent(eventCode)) {
    return `/my-requests/${ticketId}`;
  }
  return null;
}

export function notificationCopyExposesInternalAi(message: string): boolean {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("confidence") ||
    lowered.includes("reasoning") ||
    lowered.includes("gemini") ||
    lowered.includes("prompt") ||
    lowered.includes("api key")
  );
}
