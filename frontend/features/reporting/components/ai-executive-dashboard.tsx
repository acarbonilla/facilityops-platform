"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { useExecutiveAIDashboard } from "@/hooks/use-reporting-overview";
import {
  EXECUTIVE_AI_DISCLAIMER,
  EXECUTIVE_AI_EMPTY_MESSAGE,
  createDefaultExecutiveAIFilters,
  decisionBarWidth,
  formatExecutiveRate,
  isExecutiveAIEmpty,
  resetExecutiveAIFilters,
  serializeExecutiveAIParams,
  statusBadgeClass,
  trendBadgeClass,
} from "@/lib/reporting/ai-executive-dashboard";
import { validateReportingDateRange } from "@/lib/reporting/dates";
import {
  formatReportingError,
  formatReportingNumber,
  formatReportingPeriod,
} from "@/lib/reporting/display";
import {
  REPORTING_TICKET_PRIORITY_OPTIONS,
} from "@/lib/reporting/options";
import type {
  ExecutiveAIDashboard,
  ExecutiveAIFilterDraft,
  ExecutiveAITrendEntry,
} from "@/types/ai-executive-dashboard";

const CATEGORY_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
  { value: "hvac", label: "HVAC" },
  { value: "civil", label: "Civil" },
  { value: "safety", label: "Safety" },
  { value: "cleaning", label: "Cleaning" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
];

const DECISION_OPTIONS = [
  { value: "", label: "All decisions" },
  { value: "accepted", label: "Accepted" },
  { value: "modified", label: "Modified" },
  { value: "ignored", label: "Ignored" },
  { value: "pending", label: "Pending" },
];

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

function MetricCard({
  label,
  value,
  badge,
  badgeClass,
}: {
  label: string;
  value: string;
  badge?: string;
  badgeClass?: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {badge ? (
          <span
            className={`rounded-md border px-2 py-0.5 text-xs font-medium ${badgeClass || "border-slate-200 bg-slate-50 text-slate-800"}`}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </article>
  );
}

function dateValidationMessage(draft: ExecutiveAIFilterDraft): string | null {
  const error = validateReportingDateRange(draft.dateFrom, draft.dateTo);
  if (error === "blank") return "Date From and Date To are required.";
  if (error === "malformed") return "Enter valid Date From and Date To values.";
  if (error === "reversed") return "Date From must be on or before Date To.";
  if (error === "exceeds_max") {
    return "The reporting period cannot exceed 180 calendar days.";
  }
  return null;
}

function asTrend(
  value: unknown,
): ExecutiveAITrendEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as ExecutiveAITrendEntry;
  if (!entry.direction) return null;
  return entry;
}

function ResultsView({ data }: { data: ExecutiveAIDashboard }) {
  const summary = data.summary;
  const exec = data.executive_summary;
  const decisionTotal = data.decision_distribution.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  const comparisonRows = [
    ["Recommendation volume", asTrend(data.period_comparison.recommendation_volume)],
    ["Acceptance rate", asTrend(data.period_comparison.acceptance_rate)],
    ["Override rate", asTrend(data.period_comparison.modification_rate)],
    ["Pending reviews", asTrend(data.period_comparison.pending_review_count)],
    ["Full agreement", asTrend(data.period_comparison.full_agreement_rate)],
    ["Average confidence", asTrend(data.period_comparison.average_confidence)],
  ] as const;

  return (
    <div className="space-y-6">
      <SectionCard
        description="Deterministic, rule-based management summary. No generative AI."
        title="Executive Summary"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${statusBadgeClass(exec.status)}`}
          >
            {exec.label}
          </span>
          <p className="text-base font-medium text-slate-950">{exec.headline}</p>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {exec.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
        <dl className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-3">
          <div>
            <dt className="font-medium text-slate-900">Positive trend</dt>
            <dd>{exec.positive_trend || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">Primary concern</dt>
            <dd>{exec.primary_concern || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">Recommended review</dt>
            <dd>{exec.recommended_review_area || "—"}</dd>
          </div>
        </dl>
      </SectionCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          badge={summary.operational_health_label || undefined}
          badgeClass={statusBadgeClass(
            summary.operational_health_band === "healthy"
              ? "healthy"
              : summary.operational_health_band === "attention"
                ? "needs_attention"
                : "stable",
          )}
          label="AI Operational Health"
          value={formatReportingNumber(summary.operational_health_score)}
        />
        <MetricCard
          badge={summary.attention_urgency_label || undefined}
          label="Attention Urgency"
          value={formatReportingNumber(summary.attention_urgency_score)}
        />
        <MetricCard
          label="Acceptance Rate"
          value={formatExecutiveRate(summary.acceptance_rate)}
        />
        <MetricCard
          label="AI Decision Pending"
          value={formatReportingNumber(summary.pending_review_count)}
        />
        <MetricCard
          label="AI Ready · Awaiting Classification"
          value={formatReportingNumber(
            summary.ai_ready_awaiting_classification_count ?? 0,
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Completed Analyses"
          value={formatReportingNumber(summary.completed_analyses)}
        />
        <MetricCard
          label="Average Confidence"
          value={
            summary.average_confidence === null ||
            summary.average_confidence === undefined
              ? "—"
              : formatReportingNumber(summary.average_confidence)
          }
        />
        <MetricCard
          label="Category Agreement"
          value={formatExecutiveRate(summary.category_agreement_rate)}
        />
        <MetricCard
          label="Priority Agreement"
          value={formatExecutiveRate(summary.priority_agreement_rate)}
        />
        <MetricCard
          label="Override Rate"
          value={formatExecutiveRate(summary.override_rate)}
        />
      </div>

      <SectionCard
        description="Current versus previous equal-length period. Stable = rate delta within ±0.05."
        title="Period Comparison"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <caption className="sr-only">
              Period comparison of executive AI metrics
            </caption>
            <thead className="border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2 pr-4 font-medium">Metric</th>
                <th className="py-2 pr-4 font-medium">Trend</th>
                <th className="py-2 pr-4 font-medium">Current</th>
                <th className="py-2 font-medium">Previous</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map(([label, entry]) => (
                <tr className="border-b border-slate-100" key={label}>
                  <td className="py-2 pr-4 text-slate-900">{label}</td>
                  <td className="py-2 pr-4">
                    {entry ? (
                      <span
                        className={`rounded-md border px-2 py-0.5 text-xs font-medium ${trendBadgeClass(entry.direction)}`}
                      >
                        {entry.label}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 pr-4 text-slate-700">
                    {entry?.current ?? "—"}
                  </td>
                  <td className="py-2 text-slate-700">
                    {entry?.previous ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        description="Accepted, modified, ignored, and pending recommendation outcomes."
        title="Decision Distribution"
      >
        <ul className="space-y-3" aria-label="Decision distribution bars">
          {data.decision_distribution.map((item) => (
            <li key={item.decision}>
              <div className="mb-1 flex justify-between text-sm text-slate-700">
                <span>{item.label}</span>
                <span>{formatReportingNumber(item.count)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-slate-800"
                  style={{ width: decisionBarWidth(item.count, decisionTotal) }}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Reviewed {formatReportingNumber(summary.reviewed_count)} · Accepted{" "}
          {formatReportingNumber(summary.accepted_count)} · Modified{" "}
          {formatReportingNumber(summary.modified_count)} · Ignored{" "}
          {formatReportingNumber(summary.ignored_count)}
        </p>
      </SectionCard>

      <SectionCard
        description="Category agreement, priority agreement, and confidence by human review outcome."
        title="Agreement and Confidence"
      >
        <dl className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-medium text-slate-900">Category agreement</dt>
            <dd>{formatExecutiveRate(summary.category_agreement_rate)}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">Priority agreement</dt>
            <dd>{formatExecutiveRate(summary.priority_agreement_rate)}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">Full agreement</dt>
            <dd>{formatExecutiveRate(summary.full_agreement_rate)}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">Average confidence</dt>
            <dd>
              {summary.average_confidence === null ||
              summary.average_confidence === undefined
                ? "—"
                : formatReportingNumber(summary.average_confidence)}
            </dd>
          </div>
        </dl>
        {data.confidence_by_decision.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm text-slate-700" aria-label="Confidence by decision">
            {data.confidence_by_decision.map((item) => (
              <li key={item.decision}>
                {item.label}:{" "}
                {item.average_confidence === null ||
                item.average_confidence === undefined
                  ? "—"
                  : formatReportingNumber(item.average_confidence)}{" "}
                ({formatReportingNumber(item.count)} rows)
              </li>
            ))}
          </ul>
        ) : null}
        {data.confidence_bands.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm text-slate-700" aria-label="Confidence bands">
            {data.confidence_bands.map((item) => (
              <li key={item.band}>
                {item.label}: {formatReportingNumber(item.count)} (
                {(item.percentage * 100).toFixed(1)}%)
              </li>
            ))}
          </ul>
        ) : null}
        {data.decision_trend.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">
                Decision trend by period grain
              </caption>
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2 pr-4 font-medium">Period</th>
                  <th className="py-2 pr-4 font-medium">Accepted</th>
                  <th className="py-2 pr-4 font-medium">Modified</th>
                  <th className="py-2 pr-4 font-medium">Ignored</th>
                  <th className="py-2 font-medium">Pending</th>
                </tr>
              </thead>
              <tbody>
                {data.decision_trend.map((row) => (
                  <tr className="border-b border-slate-100" key={row.period}>
                    <td className="py-2 pr-4 text-slate-900">{row.period}</td>
                    <td className="py-2 pr-4">{row.accepted}</td>
                    <td className="py-2 pr-4">{row.modified}</td>
                    <td className="py-2 pr-4">{row.ignored}</td>
                    <td className="py-2">{row.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Top Category Overrides">
          {data.top_category_overrides.length === 0 ? (
            <p className="text-sm text-slate-600">No category overrides in period.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-700">
              {data.top_category_overrides.map((item) => (
                <li
                  className="rounded-lg border border-slate-200 p-3"
                  key={`${item.recommended}-${item.final}`}
                >
                  {item.recommended} → {item.final}: {item.count} (
                  {(item.percentage * 100).toFixed(1)}%)
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Top Priority Overrides">
          {data.top_priority_overrides.length === 0 ? (
            <p className="text-sm text-slate-600">No priority overrides in period.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-700">
              {data.top_priority_overrides.map((item) => (
                <li
                  className="rounded-lg border border-slate-200 p-3"
                  key={`${item.recommended}-${item.final}`}
                >
                  {item.recommended} → {item.final}: {item.count} (
                  {(item.percentage * 100).toFixed(1)}%)
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        description="Reused from FO-090 Attention Center and FO-089 Operational Insights."
        title="Operational Health & Attention"
      >
        <p className="text-sm text-slate-700">
          Health {data.operational_health.label || "—"} (
          {formatReportingNumber(data.operational_health.score ?? 0)}) · Urgency{" "}
          {summary.attention_urgency_label || "—"} (
          {formatReportingNumber(summary.attention_urgency_score)}) · Critical{" "}
          {formatReportingNumber(data.attention_summary.critical_count)}
        </p>
        <ul className="mt-4 space-y-3">
          {data.attention_summary.top_attention_items.map((item) => (
            <li
              className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700"
              key={`${item.code}-${item.title}`}
            >
              <p className="font-medium text-slate-950">{item.title}</p>
              <p className="mt-1">{item.message}</p>
            </li>
          ))}
        </ul>
        {data.operational_insights.length > 0 ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {data.operational_insights.map((item) => (
              <li key={`${item.code}-${item.title}`}>
                <span className="font-medium">{item.title}</span>
                {item.message ? ` — ${item.message}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </SectionCard>

      <SectionCard title="Knowledge Reuse">
        <p className="text-sm text-slate-700">
          Status: {data.knowledge_summary.status} (
          {data.knowledge_summary.available ? "available" : "deferred"})
        </p>
        <p className="mt-2 text-sm text-slate-600">{data.knowledge_summary.reason}</p>
        <p className="mt-2 text-xs text-slate-500">
          Corpus proxies — recommendations{" "}
          {String(data.knowledge_summary.corpus_signals.recommendation_count ?? "—")}
          , reviewed{" "}
          {String(data.knowledge_summary.corpus_signals.reviewed_count ?? "—")}.{" "}
          {data.knowledge_summary.advisory_note}
        </p>
        <p className="mt-3 text-sm">
          <Link
            className="font-medium text-blue-700 underline-offset-2 hover:underline"
            href="/reporting/ai-similar-cases"
          >
            Open AI Similar Cases
          </Link>
        </p>
      </SectionCard>

      <p className="text-xs text-slate-500">{data.interpretation.note}</p>
    </div>
  );
}

export function ExecutiveAIDashboardScreen() {
  const [draft, setDraft] = useState<ExecutiveAIFilterDraft>(() =>
    createDefaultExecutiveAIFilters(),
  );
  const [applied, setApplied] = useState<ExecutiveAIFilterDraft>(() =>
    createDefaultExecutiveAIFilters(),
  );

  const dateError = dateValidationMessage(draft);
  const params = useMemo(
    () => serializeExecutiveAIParams(applied),
    [applied],
  );
  const query = useExecutiveAIDashboard(params);

  return (
    <div className="space-y-6">
      <PageHeader
        description="A consolidated view of AI usage, human review behavior, operational health, and management attention across FacilityOps."
        title="Executive AI Dashboard"
      >
        <p className="text-sm text-slate-600">{EXECUTIVE_AI_DISCLAIMER}</p>
        <p className="text-sm text-slate-600">
          <Link
            className="font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            href="/reporting"
          >
            Back to Reporting
          </Link>
          {" · "}
          <Link
            className="font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            href="/reporting/ai-attention-center"
          >
            Attention Center
          </Link>
          {" · "}
          <Link
            className="font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            href="/reporting/ai-insights"
          >
            AI Insights
          </Link>
        </p>
      </PageHeader>

      <SectionCard
        description="Date bounds reuse reporting conventions. Category, priority, and decision filters are forwarded to FO-088/089/090 where supported."
        title="Filters"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField htmlFor="exec-date-from" label="Date From">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              id="exec-date-from"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
              type="date"
              value={draft.dateFrom}
            />
          </FormField>
          <FormField htmlFor="exec-date-to" label="Date To">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              id="exec-date-to"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
              type="date"
              value={draft.dateTo}
            />
          </FormField>
          <SelectField
            id="exec-decision"
            label="Decision"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                decision: event.target.value,
              }))
            }
            options={DECISION_OPTIONS}
            value={draft.decision}
          />
          <SelectField
            id="exec-category"
            label="Category"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
            options={CATEGORY_OPTIONS}
            value={draft.category}
          />
          <SelectField
            id="exec-priority"
            label="Priority"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                priority: event.target.value,
              }))
            }
            options={[
              { value: "", label: "All priorities" },
              ...REPORTING_TICKET_PRIORITY_OPTIONS,
            ]}
            value={draft.priority}
          />
        </div>
        {dateError ? (
          <p className="text-sm text-rose-700" role="alert">
            {dateError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={Boolean(dateError)}
            onClick={() => setApplied({ ...draft })}
            type="button"
          >
            Apply filters
          </button>
          <button
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
            onClick={() => {
              const next = resetExecutiveAIFilters();
              setDraft(next);
              setApplied(next);
            }}
            type="button"
          >
            Reset
          </button>
        </div>
        {query.data?.generated_at ? (
          <p className="text-xs text-slate-500">
            Last updated {query.data.generated_at}
          </p>
        ) : null}
      </SectionCard>

      {query.isPending ? (
        <LoadingState
          message="Assembling executive AI metrics from existing reporting services."
          title="Loading executive dashboard"
        />
      ) : null}

      {query.isError ? (
        <ErrorState
          message={formatReportingError(query.error)}
          title="Unable to load executive dashboard"
        />
      ) : null}

      {query.data && isExecutiveAIEmpty(query.data) ? (
        <EmptyState
          message={EXECUTIVE_AI_EMPTY_MESSAGE}
          title="No executive AI data"
        />
      ) : null}

      {query.data && !isExecutiveAIEmpty(query.data) ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Period{" "}
            {formatReportingPeriod(
              query.data.period.start_date,
              query.data.period.end_date,
            )}
          </p>
          <ResultsView data={query.data} />
        </div>
      ) : null}
    </div>
  );
}
