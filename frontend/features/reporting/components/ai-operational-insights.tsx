"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { useAIOperationalInsights } from "@/hooks/use-reporting-overview";
import {
  AI_OPERATIONAL_EMPTY_MESSAGE,
  AI_OPERATIONAL_HEALTH_DISCLAIMER,
  badgeToneClass,
  buildOperationalHighlightCards,
  createDefaultAIOperationalFilters,
  formatOperationalRate,
  formatTrendDirection,
  isAIOperationalEmpty,
  resetAIOperationalFilters,
  serializeAIOperationalParams,
} from "@/lib/reporting/ai-operational-insights";
import { validateReportingDateRange } from "@/lib/reporting/dates";
import {
  formatReportingError,
  formatReportingNumber,
  formatReportingPeriod,
} from "@/lib/reporting/display";
import type {
  AIOperationalFilterDraft,
  AIOperationalInsights,
} from "@/types/ai-operational-insights";

function MetricCard({
  label,
  value,
  badgeLabel,
  badgeCode,
}: {
  label: string;
  value: string;
  badgeLabel?: string;
  badgeCode?: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {badgeLabel ? (
          <span
            className={`rounded-md border px-2 py-0.5 text-xs font-medium ${badgeToneClass(badgeCode)}`}
          >
            {badgeLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </article>
  );
}

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

function dateValidationMessage(draft: AIOperationalFilterDraft): string | null {
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

function HealthPanel({ data }: { data: AIOperationalInsights }) {
  const health = data.health_score;
  return (
    <SectionCard
      description={AI_OPERATIONAL_HEALTH_DISCLAIMER}
      title="AI Operational Health"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">Score</p>
          <p
            aria-label={`AI Operational Health score ${health.score}`}
            className="mt-2 text-5xl font-semibold tracking-tight text-slate-950"
          >
            {health.score}
          </p>
          <span
            className={`mt-3 inline-flex rounded-md border px-2.5 py-1 text-sm font-medium ${badgeToneClass(health.band)}`}
          >
            {health.label}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          {(
            [
              ["Acceptance", health.components.acceptance],
              ["Agreement", health.components.agreement],
              ["Pending throughput", health.components.pending_throughput],
              ["Confidence", health.components.confidence],
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

function TrendSummary({ data }: { data: AIOperationalInsights }) {
  const rows = [
    ["Acceptance", data.trend.acceptance],
    ["Override", data.trend.override],
    ["Confidence", data.trend.confidence],
    ["Agreement", data.trend.agreement],
    ["Volume", data.trend.volume],
  ] as const;

  return (
    <SectionCard
      description={`Compared with ${formatReportingPeriod(data.comparison_period.start_date, data.comparison_period.end_date)}.`}
      title="Trend Summary"
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <caption className="sr-only">
            Trend comparison for acceptance, override, confidence, agreement,
            and volume
          </caption>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium" scope="col">
                Metric
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Direction
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Current
              </th>
              <th className="px-3 py-2 font-medium" scope="col">
                Previous
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(([label, metric]) => (
              <tr key={label}>
                <th className="px-3 py-2 font-medium text-slate-900" scope="row">
                  {label}
                </th>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${badgeToneClass(metric.badge.code)}`}
                  >
                    {formatTrendDirection(metric.direction)}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {label === "Volume"
                    ? formatReportingNumber(metric.current ?? 0)
                    : label === "Confidence"
                      ? metric.current == null
                        ? "—"
                        : Number(metric.current).toFixed(1)
                      : formatOperationalRate(metric.current)}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {label === "Volume"
                    ? formatReportingNumber(metric.previous ?? 0)
                    : label === "Confidence"
                      ? metric.previous == null
                        ? "—"
                        : Number(metric.previous).toFixed(1)
                      : formatOperationalRate(metric.previous)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function OverrideTable({
  title,
  rows,
}: {
  title: string;
  rows: AIOperationalInsights["category_overrides"];
}) {
  return (
    <SectionCard title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">No overrides in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium" scope="col">
                  Recommended
                </th>
                <th className="px-3 py-2 font-medium" scope="col">
                  Final
                </th>
                <th className="px-3 py-2 font-medium" scope="col">
                  Count
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={`${row.recommended}-${row.final}`}>
                  <td className="px-3 py-2">{row.recommended}</td>
                  <td className="px-3 py-2">{row.final}</td>
                  <td className="px-3 py-2">
                    {formatReportingNumber(row.count)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

export function AIOperationalInsightsScreen() {
  const [draft, setDraft] = useState<AIOperationalFilterDraft>(() =>
    createDefaultAIOperationalFilters(),
  );
  const [applied, setApplied] = useState<AIOperationalFilterDraft>(() =>
    createDefaultAIOperationalFilters(),
  );
  const validationError = dateValidationMessage(draft);
  const params = useMemo(
    () => serializeAIOperationalParams(applied),
    [applied],
  );
  const query = useAIOperationalInsights(params);
  const data = query.data;
  const cards = data ? buildOperationalHighlightCards(data) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        description="Rule-based operational intelligence derived from AI recommendation analytics. Informational only — no automatic workflow changes."
        title="AI Operational Insights"
      >
        <p className="text-sm text-slate-600">
          <Link
            className="font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            href="/reporting/ai-insights"
          >
            Open AI Recommendation Insights
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
        description="Select an inclusive reporting window. Trends compare against the previous equivalent period."
        title="Filters"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Date From" htmlFor="ai-ops-date-from">
            <input
              id="ai-ops-date-from"
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
          <FormField label="Date To" htmlFor="ai-ops-date-to">
            <input
              id="ai-ops-date-to"
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
              const next = resetAIOperationalFilters();
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
          message="Loading AI operational insights."
          title="Loading insights"
        />
      ) : null}

      {query.isError ? (
        <ErrorState
          message={formatReportingError(query.error)}
          title="Unable to load operational insights"
        />
      ) : null}

      {data && isAIOperationalEmpty(data) ? (
        <EmptyState
          title="No insights for this period"
          message={AI_OPERATIONAL_EMPTY_MESSAGE}
        />
      ) : null}

      {data && !isAIOperationalEmpty(data) ? (
        <>
          <HealthPanel data={data} />

          <section aria-label="Insight cards" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <MetricCard
                key={card.key}
                badgeCode={card.badge.code}
                badgeLabel={card.badge.label}
                label={card.label}
                value={card.value}
              />
            ))}
          </section>

          <SectionCard title="Key Insights">
            <ul className="space-y-3">
              {data.insights.map((insight) => (
                <li
                  key={insight.code}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-950">
                      {insight.title}
                    </h3>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-xs font-medium ${badgeToneClass(insight.badge.code)}`}
                    >
                      {insight.badge.label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{insight.message}</p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <TrendSummary data={data} />

          <SectionCard
            description="Suggestions are informational and never execute automatically."
            title="Operational Recommendations"
          >
            <ul className="space-y-3">
              {data.recommendations.map((item) => (
                <li
                  key={item.code}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <h3 className="text-base font-semibold text-slate-950">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">{item.message}</p>
                  <p className="mt-2 text-xs text-slate-500">{item.note}</p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <OverrideTable
              rows={data.category_overrides}
              title="Top Category Overrides"
            />
            <OverrideTable
              rows={data.priority_overrides}
              title="Top Priority Overrides"
            />
          </div>

          <SectionCard title="Pending Review Summary">
            <p className="text-sm text-slate-700">
              {formatReportingNumber(data.summary.pending_review_count)} of{" "}
              {formatReportingNumber(data.summary.recommendation_count)}{" "}
              recommendations are pending human review. Acceptance rate{" "}
              {formatOperationalRate(data.summary.acceptance_rate)}.
            </p>
          </SectionCard>

          <SectionCard title="Manager Notes">
            <p className="text-sm text-slate-600">{data.manager_notes.message}</p>
          </SectionCard>

          <p className="text-sm text-slate-500">{data.interpretation.note}</p>
        </>
      ) : null}
    </div>
  );
}
