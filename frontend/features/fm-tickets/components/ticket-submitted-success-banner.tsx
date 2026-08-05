"use client";

export function TicketSubmittedSuccessBanner({
  ticketNumber,
  showAiQueued,
  showCreated,
  showAiUnavailable = false,
  showAiNotRequested = false,
  showUploadPartial = false,
}: {
  ticketNumber?: string | null;
  showAiQueued: boolean;
  showCreated: boolean;
  showAiUnavailable?: boolean;
  showAiNotRequested?: boolean;
  showUploadPartial?: boolean;
}) {
  if (
    !showCreated &&
    !showAiQueued &&
    !showAiUnavailable &&
    !showAiNotRequested &&
    !showUploadPartial
  ) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
      role="status"
    >
      <p className="font-medium">Concern submitted successfully</p>
      {ticketNumber ? (
        <p className="mt-1">Reference: {ticketNumber}</p>
      ) : null}
      <p className="mt-2 text-emerald-900">
        The Facilities Team will review and classify your concern. AI suggestions
        are never final decisions.
      </p>
      {showAiQueued ? (
        <p className="mt-2 text-emerald-900">
          AI analysis is queued in the background. You may safely leave this page.
        </p>
      ) : null}
      {showAiUnavailable ? (
        <p className="mt-2 text-emerald-900">
          AI analysis is unavailable right now. Your concern remains submitted and
          Facilities can still review it.
        </p>
      ) : null}
      {showAiNotRequested ? (
        <p className="mt-2 text-emerald-900">
          No photo analysis was requested for this submission.
        </p>
      ) : null}
      {showUploadPartial ? (
        <p className="mt-2 text-amber-950">
          Some photos could not be uploaded. You can retry uploads on this page.
          Your concern was still created.
        </p>
      ) : null}
    </div>
  );
}
