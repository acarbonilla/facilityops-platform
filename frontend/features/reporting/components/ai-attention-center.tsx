"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { useAIAttentionCenter } from "@/hooks/use-reporting-overview";
import {
  AI_ATTENTION_EMPTY_MESSAGE,
  AI_ATTENTION_URGENCY_DISCLAIMER,
  createDefaultAIAttentionFilters,
  formatAttentionRate,
  isAIAttentionEmpty,
  resetAIAttentionFilters,
  serializeAIAttentionParams,
  sortAttentionItemsByUrgency,
  urgencyBadgeClass,
} from "@/lib/reporting/ai-attention-center";
import { validateReportingDateRange } from "@/lib/reporting/dates";
import {
  formatReportingError,
  formatReportingNumber,
  formatReportingPeriod,
} from "@/lib/reporting/display";
import type {
  AIAttentionCenter,
  AIAttentionFilterDraft,
  AIAttentionItem,
} from "@/types/ai-attention-center";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function dateValidationMessage(draft: AIAttentionFilterDraft): string | null {
  const error = validateReportingDateRange(draft.dateFrom, draft.dateTo);
  if (error === "blank") {
    return "Date From and Date To are required.";
  }
  if (error === "malformed") {
    return "Enter valid Date From and Date To values.";
  }
  if (error === "reversed") {
    return "Date From must be on or before Date To.";
  }
  if (error === "exceeds_max") {
    return "The reporting period cannot exceed 180 calendar days.";
  }
  return null;
}

function AttentionItemCard({ item }: { item: AIAttentionItem }) {
  return (
    <li className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
        <span
          className={`rounded-md border px-2 py-0.5 text-xs font-medium ${urgencyBadgeClass(item.priority.code)}`}
        >
          {item.priority.label}
        </span>
        <span className="text-xs font-medium text-slate-500">
          Urgency {item.urgency_score}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-700">{item.message}</p>
      <div className="mt-3 rounded-md bg-slate-50 p-3">
        <p className="text-sm font-medium text-slate-900">
          {item.suggested_action.title}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          {item.suggested_action.message}
        </p>
        <p className="mt-2 text-xs text-slate-500">{item.suggested_action.note}</p>
      </div>
    </li>
  );
}

function UrgencyPanel({ data }: { data: AIAttentionCenter }) {
  const urgency = data.urgency_score;
  return (
    <SectionCard
      description={AI_ATTENTION_URGENCY_DISCLAIMER}
      title="Overall Attention Score"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">Attention Urgency</p>
          <p
            aria-label={`Attention Urgency score ${urgency.score}`}
            className="mt-2 text-5xl font-semibold tracking-tight text-slate-950"
          >
            {urgency.score}
          </p>
          <span
            className={`mt-3 inline-flex rounded-md border px-2.5 py-1 text-sm font-medium ${urgencyBadgeClass(urgency.level.code)}`}
          >
            {urgency.level.label}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          {(
            [
              ["Pending", urgency.components.pending],
              ["Override", urgency.components.override],
              ["Health inverse", urgency.components.health_inverse],
              ["Trend", urgency.components.trend],
              ["Confidence", urgency.components.confidence],
              ["Volume", urgency.components.volume],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-slate-600">{label}</dt>
              <dd className="mt-1 font-semibold text-slate-950">
                {value.toFixed(1)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </SectionCard>
  );
}

export function AIAttentionCenterScreen() {
  const [draft, setDraft] = useState<AIAttentionFilterDraft>(() =>
    createDefaultAIAttentionFilters(),
  );
  const [applied, setApplied] = useState<AIAttentionFilterDraft>(() =>
    createDefaultAIAttentionFilters(),
  );
  const validationError = dateValidationMessage(draft);
  const params = useMemo(
    () => serializeAIAttentionParams(applied),
    [applied],
  );
  const query = useAIAttentionCenter(params);
  const data = query.data;
  const queue = data
    ? sortAttentionItemsByUrgency(data.attention_items)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        description="Prioritized informational work queue derived from AI operational insights. Human decision-making remains final — no automatic workflow changes."
        title="AI Attention Center"
      >
        <p className="text-sm text-slate-600">
          <Link
            className="font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            href="/reporting/ai-operational-insights"
          >
            Open AI Operational Insights
          </Link>
          {" · "}
          <Link
            className="font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            href="/reporting"
          >
            Back to Reporting
          </Link>
        </p>
      </PageHeader>

      <SectionCard
        description="Select an inclusive reporting window used to derive attention items."
        title="Filters"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Date From" htmlFor="ai-attention-date-from">
            <input
              id="ai-attention-date-from"
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={draft.dateFrom}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Date To" htmlFor="ai-attention-date-to">
            <input
              id="ai-attention-date-to"
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={draft.dateTo}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
            />
          </FormField>
        </div>
        {validationError ? (
          <p className="text-sm text-rose-700" role="alert">
            {validationError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={Boolean(validationError)}
            onClick={() => setApplied(draft)}
            type="button"
          >
            Apply filters
          </button>
          <button
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            onClick={() => {
              const next = resetAIAttentionFilters();
              setDraft(next);
              setApplied(next);
            }}
            type="button"
          >
            Reset
          </button>
        </div>
      </SectionCard>

      {query.isPending ? (
        <LoadingState
          message="Loading AI attention center."
          title="Loading attention queue"
        />
      ) : null}

      {query.isError ? (
        <ErrorState
          message={formatReportingError(query.error)}
          title="Unable to load attention center"
        />
      ) : null}

      {data && isAIAttentionEmpty(data) ? (
        <EmptyState
          title="No attention items"
          message={AI_ATTENTION_EMPTY_MESSAGE}
        />
      ) : null}

      {data && !isAIAttentionEmpty(data) ? (
        <>
          <UrgencyPanel data={data} />

          <section
            aria-label="Attention summary cards"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            {(
              [
                ["Attention items", String(data.summary.attention_count)],
                ["Critical items", String(data.summary.critical_count)],
                [
                  "Pending reviews",
                  String(data.summary.pending_review_count),
                ],
                [
                  "Operational health",
                  String(data.summary.operational_health_score),
                ],
              ] as const
            ).map(([label, value]) => (
              <article
                key={label}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-medium text-slate-600">{label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">
                  {value}
                </p>
              </article>
            ))}
          </section>

          <SectionCard title="Critical Items">
            {data.critical_items.length === 0 ? (
              <p className="text-sm text-slate-600">
                No critical attention items in this period.
              </p>
            ) : (
              <ul className="space-y-3">
                {sortAttentionItemsByUrgency(data.critical_items).map((item) => (
                  <AttentionItemCard key={`critical-${item.code}`} item={item} />
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            description="Sorted by urgency score (highest first)."
            title="Attention Queue"
          >
            <ul className="space-y-3" aria-label="Attention queue">
              {queue.map((item) => (
                <AttentionItemCard key={item.code} item={item} />
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            description={`Compared with ${formatReportingPeriod(data.comparison_period.start_date, data.comparison_period.end_date)}.`}
            title="Trend Indicators"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <caption className="sr-only">
                  Trend indicators for acceptance, override, confidence,
                  agreement, and volume
                </caption>
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium" scope="col">
                      Metric
                    </th>
                    <th className="px-3 py-2 font-medium" scope="col">
                      Direction
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(["acceptance", "override", "confidence", "agreement", "volume"] as const).map(
                    (key) => {
                      const metric = data.trend[key];
                      return (
                        <tr key={key}>
                          <th
                            className="px-3 py-2 font-medium capitalize text-slate-900"
                            scope="row"
                          >
                            {key}
                          </th>
                          <td className="px-3 py-2 text-slate-700">
                            {metric?.direction ?? "stable"}
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Pending Review Summary">
              <p className="text-sm text-slate-700">
                {formatReportingNumber(
                  data.pending_review_summary.pending_review_count,
                )}{" "}
                of{" "}
                {formatReportingNumber(
                  data.pending_review_summary.recommendation_count,
                )}{" "}
                recommendations are pending review.
              </p>
            </SectionCard>
            <SectionCard title="Operational Health Summary">
              <p className="text-sm text-slate-700">
                AI Operational Health is {data.operational_health.score} (
                {data.operational_health.label}).
              </p>
            </SectionCard>
          </div>

          <SectionCard title="Recent AI Review Activity">
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-slate-600">Acceptance</dt>
                <dd className="font-semibold text-slate-950">
                  {formatAttentionRate(
                    data.recent_review_activity.accepted_rate,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600">Modification</dt>
                <dd className="font-semibold text-slate-950">
                  {formatAttentionRate(
                    data.recent_review_activity.modification_rate,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600">Ignore</dt>
                <dd className="font-semibold text-slate-950">
                  {formatAttentionRate(data.recent_review_activity.ignore_rate)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-600">Full agreement</dt>
                <dd className="font-semibold text-slate-950">
                  {formatAttentionRate(
                    data.recent_review_activity.full_agreement_rate,
                  )}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              {data.recent_review_activity.note}
            </p>
          </SectionCard>

          <SectionCard title="Suggested Actions">
            <ul className="space-y-3">
              {queue.map((item) => (
                <li
                  key={`action-${item.code}`}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <h3 className="text-base font-semibold text-slate-950">
                    {item.suggested_action.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">
                    {item.suggested_action.message}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <p className="text-sm text-slate-500">{data.interpretation.note}</p>
        </>
      ) : null}
    </div>
  );
}
