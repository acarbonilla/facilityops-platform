"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { useAIRecommendationInsights } from "@/hooks/use-reporting-overview";
import {
  AI_INSIGHTS_CATEGORY_OPTIONS,
  AI_INSIGHTS_CONFIDENCE_DISCLAIMER,
  AI_INSIGHTS_DECISION_OPTIONS,
  AI_INSIGHTS_EMPTY_MESSAGE,
  AI_INSIGHTS_PRIORITY_OPTIONS,
  buildAIInsightsSummaryCards,
  createDefaultAIInsightsFilters,
  decisionBarWidth,
  formatAIInsightsConfidence,
  formatAIInsightsRate,
  isAIInsightsEmpty,
  resetAIInsightsFilters,
  serializeAIInsightsParams,
} from "@/lib/reporting/ai-insights";
import { validateReportingDateRange } from "@/lib/reporting/dates";
import {
  formatReportingCategoryLabel,
  formatReportingError,
  formatReportingNumber,
  formatReportingPeriod,
  formatReportingPriorityLabel,
} from "@/lib/reporting/display";
import type {
  AIInsightsFilterDraft,
  AIRecommendationInsights,
} from "@/types/ai-insights";

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
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

function dateValidationMessage(draft: AIInsightsFilterDraft): string | null {
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

function DecisionDistribution({
  data,
}: {
  data: AIRecommendationInsights;
}) {
  const maxCount = Math.max(
    ...data.decision_distribution.map((row) => row.count),
    0,
  );

  return (
    <div className="space-y-4">
      <ul className="space-y-3" aria-label="Decision distribution">
        {data.decision_distribution.map((row) => (
          <li key={row.decision} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-900">{row.label}</span>
              <span className="tabular-nums text-slate-700">
                {formatReportingNumber(row.count)}
              </span>
            </div>
            <div
              aria-hidden="true"
              className="h-2 overflow-hidden rounded bg-slate-100"
            >
              <div
                className="h-full rounded bg-slate-700"
                style={{ width: `${decisionBarWidth(row.count, maxCount)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <caption className="sr-only">
            Decision distribution counts for accepted, modified, ignored, and
            pending recommendations
          </caption>
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 font-semibold text-slate-700" scope="col">
                Decision
              </th>
              <th className="px-3 py-2 font-semibold text-slate-700" scope="col">
                Count
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.decision_distribution.map((row) => (
              <tr key={`table-${row.decision}`}>
                <th className="px-3 py-2 font-medium text-slate-900" scope="row">
                  {row.label}
                </th>
                <td className="px-3 py-2 text-slate-700">
                  {formatReportingNumber(row.count)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrendTable({ data }: { data: AIRecommendationInsights }) {
  if (data.decision_trend.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No recommendation decisions fall in this period.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <caption className="sr-only">
          Recommendation decision trend by {data.decision_trend[0]?.grain}
        </caption>
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 font-semibold text-slate-700" scope="col">
              Period
            </th>
            <th className="px-3 py-2 font-semibold text-slate-700" scope="col">
              Accepted
            </th>
            <th className="px-3 py-2 font-semibold text-slate-700" scope="col">
              Modified
            </th>
            <th className="px-3 py-2 font-semibold text-slate-700" scope="col">
              Ignored
            </th>
            <th className="px-3 py-2 font-semibold text-slate-700" scope="col">
              Pending
            </th>
            <th className="px-3 py-2 font-semibold text-slate-700" scope="col">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.decision_trend.map((row) => (
            <tr key={row.period}>
              <th className="px-3 py-2 font-medium text-slate-900" scope="row">
                {row.period}
              </th>
              <td className="px-3 py-2 text-slate-700">{row.accepted}</td>
              <td className="px-3 py-2 text-slate-700">{row.modified}</td>
              <td className="px-3 py-2 text-slate-700">{row.ignored}</td>
              <td className="px-3 py-2 text-slate-700">{row.pending}</td>
              <td className="px-3 py-2 text-slate-700">{row.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverrideTable({
  caption,
  recommendedLabel,
  finalLabel,
  rows,
}: {
  caption: string;
  recommendedLabel: string;
  finalLabel: string;
  rows: AIRecommendationInsights["category_overrides"];
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No modified recommendations changed this field in the selected period.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 font-semibold text-slate-700" scope="col">
              {recommendedLabel}
            </th>
            <th className="px-3 py-2 font-semibold text-slate-700" scope="col">
              {finalLabel}
            </th>
            <th className="px-3 py-2 font-semibold text-slate-700" scope="col">
              Count
            </th>
            <th className="px-3 py-2 font-semibold text-slate-700" scope="col">
              Share
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={`${row.recommended}->${row.final}`}>
              <th className="px-3 py-2 font-medium text-slate-900" scope="row">
                {row.recommended}
              </th>
              <td className="px-3 py-2 text-slate-700">
                {finalLabel.toLowerCase().includes("priority")
                  ? formatReportingPriorityLabel(row.final)
                  : formatReportingCategoryLabel(row.final)}
              </td>
              <td className="px-3 py-2 text-slate-700">{row.count}</td>
              <td className="px-3 py-2 text-slate-700">
                {formatAIInsightsRate(row.percentage)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AIRecommendationInsightsScreen() {
  const defaults = useMemo(() => createDefaultAIInsightsFilters(), []);
  const [draft, setDraft] = useState<AIInsightsFilterDraft>(defaults);
  const [applied, setApplied] = useState<AIInsightsFilterDraft>(defaults);

  const queryParams = useMemo(
    () => serializeAIInsightsParams(applied),
    [applied],
  );
  const insightsQuery = useAIRecommendationInsights(queryParams);
  const validationMessage = dateValidationMessage(draft);
  const applyEnabled = !validationMessage;

  const data = insightsQuery.data;
  const cards = data ? buildAIInsightsSummaryCards(data) : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="Reporting"
        title="AI Recommendation Insights"
        description="Review how FacilityOps AI recommendations are used and how often Facilities teams accept, modify, or ignore them."
      >
        <Link
          href="/reporting"
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
        >
          Back to Reporting
        </Link>
      </PageHeader>

      <SectionCard
        title="Filters"
        description="Date bounds are inclusive. Maximum range is 180 calendar days."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField label="Date From" htmlFor="ai-insights-date-from">
            <input
              id="ai-insights-date-from"
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
          <FormField label="Date To" htmlFor="ai-insights-date-to">
            <input
              id="ai-insights-date-to"
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
          <SelectField
            label="Decision"
            id="ai-insights-decision"
            value={draft.decision}
            placeholder="All decisions"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                decision: event.target.value,
              }))
            }
            options={[...AI_INSIGHTS_DECISION_OPTIONS]}
          />
          <SelectField
            label="Category"
            id="ai-insights-category"
            value={draft.category}
            placeholder="All categories"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
            options={[...AI_INSIGHTS_CATEGORY_OPTIONS]}
          />
          <SelectField
            label="Priority"
            id="ai-insights-priority"
            value={draft.priority}
            placeholder="All priorities"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                priority: event.target.value,
              }))
            }
            options={[...AI_INSIGHTS_PRIORITY_OPTIONS]}
          />
        </div>
        {validationMessage ? (
          <p className="text-sm text-rose-700" role="alert">
            {validationMessage}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!applyEnabled}
            onClick={() => setApplied(draft)}
          >
            Apply filters
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
            onClick={() => {
              const next = resetAIInsightsFilters();
              setDraft(next);
              setApplied(next);
            }}
          >
            Reset filters
          </button>
        </div>
      </SectionCard>

      {insightsQuery.isLoading ? (
        <LoadingState
          title="Loading AI recommendation insights"
          message="Calculating tenant-scoped recommendation analytics."
        />
      ) : null}

      {insightsQuery.isError ? (
        <ErrorState
          title="Unable to load AI insights"
          message={formatReportingError(insightsQuery.error)}
          action={
            <button
              type="button"
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => {
                void insightsQuery.refetch();
              }}
            >
              Retry
            </button>
          }
        />
      ) : null}

      {data && isAIInsightsEmpty(data) ? (
        <EmptyState
          title="No AI recommendation activity"
          message={AI_INSIGHTS_EMPTY_MESSAGE}
        />
      ) : null}

      {data && !isAIInsightsEmpty(data) ? (
        <>
          <p className="text-sm text-slate-600">
            Showing{" "}
            {formatReportingPeriod(data.period.start_date, data.period.end_date)}
            . Rates use reviewed decisions as the denominator unless noted.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <MetricCard
                key={card.key}
                label={card.label}
                value={card.value}
              />
            ))}
          </div>

          <SectionCard
            title="Decision Distribution"
            description="Accepted, modified, ignored, and pending review counts."
          >
            <DecisionDistribution data={data} />
          </SectionCard>

          <SectionCard
            title="Recommendation Trend"
            description="Decisions grouped by day, week, or month based on the selected range."
          >
            <TrendTable data={data} />
          </SectionCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Category Override Insights"
              description="Common AI category → final human category changes for modified recommendations."
            >
              <OverrideTable
                caption="Category override pairs"
                recommendedLabel="AI category"
                finalLabel="Final category"
                rows={data.category_overrides}
              />
            </SectionCard>
            <SectionCard
              title="Priority Override Insights"
              description="Common AI priority → final human priority changes for modified recommendations."
            >
              <OverrideTable
                caption="Priority override pairs"
                recommendedLabel="AI priority"
                finalLabel="Final priority"
                rows={data.priority_overrides}
              />
            </SectionCard>
          </div>

          <SectionCard
            title="Confidence Insights"
            description={AI_INSIGHTS_CONFIDENCE_DISCLAIMER}
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <caption className="sr-only">
                    Average confidence by decision
                  </caption>
                  <thead className="bg-slate-50">
                    <tr>
                      <th
                        className="px-3 py-2 font-semibold text-slate-700"
                        scope="col"
                      >
                        Decision
                      </th>
                      <th
                        className="px-3 py-2 font-semibold text-slate-700"
                        scope="col"
                      >
                        Count
                      </th>
                      <th
                        className="px-3 py-2 font-semibold text-slate-700"
                        scope="col"
                      >
                        Average confidence
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.confidence_by_decision.map((row) => (
                      <tr key={row.decision}>
                        <th
                          className="px-3 py-2 font-medium text-slate-900"
                          scope="row"
                        >
                          {row.label}
                        </th>
                        <td className="px-3 py-2 text-slate-700">{row.count}</td>
                        <td className="px-3 py-2 text-slate-700">
                          {formatAIInsightsConfidence(row.average_confidence)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <caption className="sr-only">
                    Confidence bands. Low below 50, Medium 50 to 74, High 75 to
                    89, Very High 90 to 100.
                  </caption>
                  <thead className="bg-slate-50">
                    <tr>
                      <th
                        className="px-3 py-2 font-semibold text-slate-700"
                        scope="col"
                      >
                        Band
                      </th>
                      <th
                        className="px-3 py-2 font-semibold text-slate-700"
                        scope="col"
                      >
                        Bounds
                      </th>
                      <th
                        className="px-3 py-2 font-semibold text-slate-700"
                        scope="col"
                      >
                        Count
                      </th>
                      <th
                        className="px-3 py-2 font-semibold text-slate-700"
                        scope="col"
                      >
                        Share
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.confidence_bands.map((row) => (
                      <tr key={row.band}>
                        <th
                          className="px-3 py-2 font-medium text-slate-900"
                          scope="row"
                        >
                          {row.label}
                        </th>
                        <td className="px-3 py-2 text-slate-700">{row.bounds}</td>
                        <td className="px-3 py-2 text-slate-700">{row.count}</td>
                        <td className="px-3 py-2 text-slate-700">
                          {formatAIInsightsRate(row.percentage)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-sm text-slate-600">{data.interpretation.note}</p>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
