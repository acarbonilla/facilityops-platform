"use client";

import { useEffect, useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";

import {
  decideFmTicketAiRecommendation,
  getFmTicketAiAnalyses,
} from "@/services/api/fm-tickets";
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
  decisionBadgeClass,
  extractRecommendationView,
  formatDecisionLabel,
  formatTicketCategoryLabel,
  formatTicketPriorityLabel,
  getDecisionAnnouncement,
  mapAiCategoryToTicket,
  mapAiPriorityToTicket,
  priorityBadgeClass,
  severityBadgeClass,
  type AiRecommendationDecision,
} from "@/lib/fm-tickets/ai-recommendations";
import { cn } from "@/lib/utils";
import type {
  FmTicketCategory,
  FmTicketPriority,
} from "@/types/fm-tickets";

const CATEGORY_OPTIONS: Array<{ value: FmTicketCategory; label: string }> = [
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
  { value: "hvac", label: "HVAC" },
  { value: "civil", label: "Civil" },
  { value: "safety", label: "Safety" },
  { value: "cleaning", label: "Cleaning" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
];

const PRIORITY_OPTIONS: Array<{ value: FmTicketPriority; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export type AppliedAiRecommendation = {
  category: FmTicketCategory;
  priority: FmTicketPriority;
};

export function TicketAiAnalysisStatusPanel({
  ticketId,
  audience = "internal",
  canReview = false,
  onApplyRecommendation,
}: {
  ticketId: string;
  audience?: "internal" | "requester";
  canReview?: boolean;
  onApplyRecommendation?: (selection: AppliedAiRecommendation) => void;
}) {
  const queryClient = useQueryClient();
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
  const liveRegionId = useId();
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  const [modifyMode, setModifyMode] = useState(false);
  const [modifyCategory, setModifyCategory] = useState<FmTicketCategory>("other");
  const [modifyPriority, setModifyPriority] = useState<FmTicketPriority>("medium");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const recommendation = extractRecommendationView(
    (latest?.result as Record<string, unknown> | undefined) ||
      (latest?.result_json as Record<string, unknown> | undefined),
  );

  useEffect(() => {
    if (!recommendation) {
      return;
    }
    setModifyCategory(
      mapAiCategoryToTicket(recommendation.recommendedCategory) as FmTicketCategory,
    );
    setModifyPriority(
      mapAiPriorityToTicket(recommendation.recommendedPriority) as FmTicketPriority,
    );
  }, [recommendation]);

  const decisionMutation = useMutation({
    mutationFn: (payload: {
      decision: AiRecommendationDecision;
      final_category?: string;
      final_priority?: string;
    }) => {
      if (!latest?.id) {
        throw new Error("No AI analysis available.");
      }
      return decideFmTicketAiRecommendation(ticketId, latest.id, payload);
    },
    onSuccess: async (data, variables) => {
      setActionError(null);
      setModifyMode(false);
      setRecommendationsOpen(true);
      setActionMessage(getDecisionAnnouncement(variables.decision));
      await queryClient.invalidateQueries({
        queryKey: fmTicketsQueryKeys.aiAnalyses(ticketId),
      });
      await queryClient.invalidateQueries({
        queryKey: fmTicketsQueryKeys.history(ticketId),
      });

      if (
        variables.decision === "accepted" ||
        variables.decision === "modified"
      ) {
        const category = (data.final_category ||
          mapAiCategoryToTicket(data.recommended_category)) as FmTicketCategory;
        const priority = (data.final_priority ||
          mapAiPriorityToTicket(data.recommended_priority)) as FmTicketPriority;
        onApplyRecommendation?.({ category, priority });
      }
    },
    onError: () => {
      setActionError(
        "Recommendation decision could not be saved. Try again or continue manually.",
      );
    },
  });

  if (!shouldShowAiAnalysisPanel(uiStatus, { audience })) {
    return null;
  }

  const summary =
    typeof latest?.result_json?.analysis_summary === "string"
      ? latest.result_json.analysis_summary
      : null;
  const hasDecision = Boolean(latest?.decision);
  const showReviewActions =
    canReview &&
    audience === "internal" &&
    uiStatus === "completed" &&
    recommendation &&
    !hasDecision;

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

      <div className="sr-only" id={liveRegionId} role="status" aria-live="assertive">
        {actionMessage}
      </div>

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
            <div
              id={recommendationPanelId}
              className="space-y-4 border-t border-slate-200 px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p
                  className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-900"
                  role="status"
                >
                  Human review required
                </p>
                <p
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                    decisionBadgeClass(latest?.decision),
                  )}
                  role="status"
                >
                  {formatDecisionLabel(latest?.decision)}
                </p>
              </div>
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
                      <p className="text-sm font-medium text-slate-950">
                        {finding.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {finding.description}
                      </p>
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

              {hasDecision ? (
                <div className="rounded-md border border-slate-300 bg-white p-3">
                  <h3 className="text-sm font-semibold text-slate-950">
                    Recommendation comparison
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        AI recommendation
                      </p>
                      <p className="mt-1 text-sm text-slate-800">
                        Category: {latest?.recommended_category || "—"}
                      </p>
                      <p className="text-sm text-slate-800">
                        Priority: {latest?.recommended_priority || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Final selection
                      </p>
                      <p className="mt-1 text-sm text-slate-800">
                        Category:{" "}
                        {formatTicketCategoryLabel(latest?.final_category)}
                      </p>
                      <p className="text-sm text-slate-800">
                        Priority:{" "}
                        {formatTicketPriorityLabel(latest?.final_priority)}
                      </p>
                    </div>
                  </div>
                  {latest?.decision_timestamp ? (
                    <p className="mt-2 text-xs text-slate-600">
                      Decided{" "}
                      {new Date(latest.decision_timestamp).toLocaleString()}
                      {latest.decision_user?.email
                        ? ` by ${latest.decision_user.email}`
                        : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {showReviewActions ? (
                <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-950">
                    Review recommendation
                  </p>
                  <p className="text-xs text-slate-600">
                    Accept fills category and priority into the ticket form only.
                    Save or update the ticket to persist changes.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                      disabled={decisionMutation.isPending}
                      aria-label="Accept AI recommendation"
                      onClick={() =>
                        decisionMutation.mutate({ decision: "accepted" })
                      }
                    >
                      Accept recommendation
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                      disabled={decisionMutation.isPending}
                      aria-label="Modify AI recommendation"
                      aria-expanded={modifyMode}
                      onClick={() => setModifyMode((open) => !open)}
                    >
                      Modify recommendation
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                      disabled={decisionMutation.isPending}
                      aria-label="Ignore AI recommendation"
                      onClick={() =>
                        decisionMutation.mutate({ decision: "ignored" })
                      }
                    >
                      Ignore recommendation
                    </button>
                  </div>

                  {modifyMode ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm text-slate-700">
                        Final category
                        <select
                          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          value={modifyCategory}
                          aria-label="Final category for modified recommendation"
                          onChange={(event) =>
                            setModifyCategory(
                              event.target.value as FmTicketCategory,
                            )
                          }
                        >
                          {CATEGORY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm text-slate-700">
                        Final priority
                        <select
                          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          value={modifyPriority}
                          aria-label="Final priority for modified recommendation"
                          onChange={(event) =>
                            setModifyPriority(
                              event.target.value as FmTicketPriority,
                            )
                          }
                        >
                          {PRIORITY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                          disabled={decisionMutation.isPending}
                          aria-label="Confirm modified recommendation"
                          onClick={() =>
                            decisionMutation.mutate({
                              decision: "modified",
                              final_category: modifyCategory,
                              final_priority: modifyPriority,
                            })
                          }
                        >
                          Confirm modified values
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {actionError ? (
                <p className="text-sm text-red-700" role="alert">
                  {actionError}
                </p>
              ) : null}
              {actionMessage ? (
                <p className="text-sm text-slate-700" role="status">
                  {actionMessage}
                </p>
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
