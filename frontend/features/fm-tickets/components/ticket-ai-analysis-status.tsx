"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";

import { getFmTicketAiAnalyses } from "@/services/api/fm-tickets";
import { fmTicketsQueryKeys } from "@/services/api/query-keys";
import {
  getAiAnalysisStatusMessage,
  getAiAnalysisStatusTitle,
  getAiGeneratedDisclaimer,
  getRecommendationHumanReviewNotice,
  resolveAiAnalysisUiStatus,
  shouldShowAiAnalysisPanel,
  shouldShowRecommendations,
  shouldShowStructuredSummary,
} from "@/lib/fm-tickets/ai-analysis-status";
import {
  extractRecommendationView,
  priorityBadgeClass,
  severityBadgeClass,
} from "@/lib/fm-tickets/ai-recommendations";
import { cn } from "@/lib/utils";

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
  const recommendationPanelId = useId();
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);

  if (!shouldShowAiAnalysisPanel(uiStatus, { audience })) {
    return null;
  }

  const summary =
    typeof latest?.result_json?.analysis_summary === "string"
      ? latest.result_json.analysis_summary
      : null;
  const recommendation = extractRecommendationView(
    (latest?.result as Record<string, unknown> | undefined) ||
      (latest?.result_json as Record<string, unknown> | undefined),
  );

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

      {shouldShowRecommendations(uiStatus, audience) && recommendation ? (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
            aria-expanded={recommendationsOpen}
            aria-controls={recommendationPanelId}
            onClick={() => setRecommendationsOpen((open) => !open)}
          >
            <span>
              <span className="block text-sm font-semibold text-slate-950">
                AI recommendations
              </span>
              <span className="mt-0.5 block text-xs text-slate-600">
                Advisory findings, category, and priority — collapsed by default
              </span>
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-slate-500 transition-transform",
                recommendationsOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>

          {recommendationsOpen ? (
            <div id={recommendationPanelId} className="space-y-4 border-t border-slate-200 px-3 py-3">
              <p
                className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-900"
                role="status"
              >
                Human review required
              </p>
              <p className="text-xs text-slate-700">
                {getRecommendationHumanReviewNotice()}
              </p>

              <div>
                <h3 className="text-sm font-semibold text-slate-950">AI Findings</h3>
                <ul className="mt-2 space-y-2">
                  {recommendation.findings.map((finding) => (
                    <li
                      key={`${finding.title}-${finding.description}`}
                      className="rounded-md border border-slate-200 bg-white p-3"
                    >
                      <p className="text-sm font-medium text-slate-950">{finding.title}</p>
                      <p className="mt-1 text-sm text-slate-700">{finding.description}</p>
                      <div className="mt-2">
                        <p className="text-xs font-medium text-slate-600">
                          Confidence {finding.confidence}%
                        </p>
                        <div
                          className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"
                          role="progressbar"
                          aria-valuenow={finding.confidence}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${finding.title} confidence`}
                        >
                          <div
                            className="h-full rounded-full bg-sky-500"
                            style={{ width: `${finding.confidence}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Recommended category
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {recommendation.recommendedCategory || "—"}
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Recommended priority
                  </p>
                  {recommendation.recommendedPriority ? (
                    <span
                      className={cn(
                        "mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                        priorityBadgeClass(recommendation.recommendedPriority),
                      )}
                    >
                      {recommendation.recommendedPriority}
                    </span>
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-slate-950">—</p>
                  )}
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Severity
                  </p>
                  {recommendation.severity ? (
                    <span
                      className={cn(
                        "mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                        severityBadgeClass(recommendation.severity),
                      )}
                    >
                      {recommendation.severity}
                    </span>
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-slate-950">—</p>
                  )}
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Overall confidence
                  </p>
                  {recommendation.confidence !== null ? (
                    <>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {recommendation.confidence}%
                      </p>
                      <div
                        className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
                        role="progressbar"
                        aria-valuenow={recommendation.confidence}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Overall recommendation confidence"
                      >
                        <div
                          className="h-full rounded-full bg-sky-500"
                          style={{ width: `${recommendation.confidence}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-slate-950">—</p>
                  )}
                </div>
              </div>

              {recommendation.reasoning ? (
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-950">Reasoning</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {recommendation.reasoning}
                  </p>
                </div>
              ) : null}

              <p className="text-xs text-slate-600">
                These values are advisory only. Do not automatically change ticket
                category, priority, status, assignment, or work orders.
              </p>
            </div>
          ) : null}
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
