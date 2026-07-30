"use client";

import { useQuery } from "@tanstack/react-query";

import { getFmTicketAiAnalyses } from "@/services/api/fm-tickets";
import { fmTicketsQueryKeys } from "@/services/api/query-keys";
import {
  getAiAnalysisStatusMessage,
  getAiAnalysisStatusTitle,
  getAiGeneratedDisclaimer,
  resolveAiAnalysisUiStatus,
  shouldShowAiAnalysisPanel,
  shouldShowStructuredSummary,
} from "@/lib/fm-tickets/ai-analysis-status";

export function TicketAiAnalysisStatusPanel({
  ticketId,
  audience = "internal",
}: {
  ticketId: string;
  audience?: "internal" | "requester";
}) {
  const analysesQuery = useQuery({
    queryKey: fmTicketsQueryKeys.aiAnalyses(ticketId),
    queryFn: () => getFmTicketAiAnalyses(ticketId),
    refetchInterval: (query) => {
      const latest = query.state.data?.results?.[0];
      const status = resolveAiAnalysisUiStatus(latest?.status);
      return status === "queued" || status === "processing" ? 5000 : false;
    },
  });

  const latest = analysesQuery.data?.results?.[0];
  const uiStatus = resolveAiAnalysisUiStatus(latest?.status);

  if (!shouldShowAiAnalysisPanel(uiStatus, { audience })) {
    return null;
  }

  const summary =
    typeof latest?.result_json?.analysis_summary === "string"
      ? latest.result_json.analysis_summary
      : null;

  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-950">
        {getAiAnalysisStatusTitle(uiStatus)}
      </h2>
      <p className="mt-2 text-sm text-slate-700">
        {getAiAnalysisStatusMessage(uiStatus)}
      </p>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        AI-generated · requires human review
      </p>
      <p className="mt-1 text-xs text-slate-600">{getAiGeneratedDisclaimer()}</p>

      {shouldShowStructuredSummary(uiStatus, audience) && summary ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-950">Observation summary</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900">{summary}</p>
          <p className="mt-2 text-xs text-amber-800">
            Confidence scores are not certainty. Do not change category, priority,
            assignment, or work orders from this summary alone.
          </p>
        </div>
      ) : null}

      {uiStatus === "failed" && latest?.error_message ? (
        <p className="mt-3 text-sm text-slate-700" role="status">
          {latest.error_message}
        </p>
      ) : null}
    </section>
  );
}
