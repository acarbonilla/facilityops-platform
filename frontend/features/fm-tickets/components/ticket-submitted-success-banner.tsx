"use client";

export function TicketSubmittedSuccessBanner({
  ticketNumber,
  showAiQueued,
  showCreated,
}: {
  ticketNumber?: string | null;
  showAiQueued: boolean;
  showCreated: boolean;
}) {
  if (!showCreated && !showAiQueued) {
    return null;
  }

  return (
    <div
      className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
      role="status"
    >
      <p className="font-medium">Ticket Submitted Successfully</p>
      {ticketNumber ? (
        <p className="mt-1">Ticket Number: {ticketNumber}</p>
      ) : null}
      {showAiQueued ? (
        <p className="mt-2 text-emerald-900">
          Status: AI analysis is processing in the background. You may safely
          leave this page.
        </p>
      ) : null}
    </div>
  );
}
