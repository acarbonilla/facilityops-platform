"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { useAISimilarCases } from "@/hooks/use-reporting-overview";
import {
  AI_SIMILAR_DISCLAIMER,
  AI_SIMILAR_EMPTY_MESSAGE,
  createDefaultAISimilarFilters,
  formatSourceType,
  isAISimilarEmpty,
  resetAISimilarFilters,
  serializeAISimilarParams,
  similarityBadgeClass,
  sortSimilarCasesByScore,
} from "@/lib/reporting/ai-similar-cases";
import { validateReportingDateRange } from "@/lib/reporting/dates";
import {
  formatReportingError,
  formatReportingNumber,
  formatReportingPeriod,
} from "@/lib/reporting/display";
import {
  REPORTING_TICKET_PRIORITY_OPTIONS,
  REPORTING_TICKET_STATUS_OPTIONS,
} from "@/lib/reporting/options";
import type {
  AISimilarCaseCard,
  AISimilarCaseMatch,
  AISimilarCases,
  AISimilarFilterDraft,
} from "@/types/ai-similar-cases";

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

const SOURCE_OPTIONS = [
  { value: "all", label: "All sources" },
  { value: "fm_ticket", label: "FM Tickets" },
  { value: "maintenance_work_order", label: "Maintenance Work Orders" },
  { value: "inspection", label: "5S Inspections" },
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

function dateValidationMessage(draft: AISimilarFilterDraft): string | null {
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

function CaseSummary({
  title,
  caseCard,
}: {
  title: string;
  caseCard: AISimilarCaseCard;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
          {formatSourceType(caseCard.source_type)}
        </span>
      </div>
      <p className="text-sm text-slate-700">
        <span className="font-medium">{caseCard.reference}</span>
        {" — "}
        {caseCard.title}
      </p>
      <dl className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="font-medium text-slate-900">Category</dt>
          <dd>{caseCard.category || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Priority</dt>
          <dd>{caseCard.priority || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Status</dt>
          <dd>{caseCard.status || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Building</dt>
          <dd>{caseCard.building_code || "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Asset</dt>
          <dd>{caseCard.asset_code || "—"}</dd>
        </div>
      </dl>
      {caseCard.ai_decision_summary ? (
        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">AI Decision Summary</p>
          <p className="mt-1">
            Recommended {caseCard.ai_decision_summary.recommended_category || "—"} /{" "}
            {caseCard.ai_decision_summary.recommended_priority || "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {caseCard.ai_decision_summary.note}
          </p>
        </div>
      ) : null}
      {caseCard.human_decision_summary ? (
        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">Human Decision Summary</p>
          <p className="mt-1">
            Outcome: {caseCard.human_decision_summary.decision_outcome || "none"}
            {" · "}
            Final {caseCard.human_decision_summary.final_category || "—"} /{" "}
            {caseCard.human_decision_summary.final_priority || "—"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {caseCard.human_decision_summary.note}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SimilarCaseCard({ item }: { item: AISimilarCaseMatch }) {
  return (
    <li className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${similarityBadgeClass(item.similarity_score)}`}
        >
          Similarity {item.similarity_score}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
          {formatSourceType(item.source_type)}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{item.reference}</p>
      <div className="mt-3">
        <p className="text-sm font-medium text-slate-900">Why similar</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {item.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
      <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
        <p className="font-medium text-slate-900">Historical Outcome</p>
        <p className="mt-1">
          Status {item.historical_outcome.status || "—"} · Category{" "}
          {item.historical_outcome.resolved_category || "—"} · Priority{" "}
          {item.historical_outcome.resolved_priority || "—"} · Decision{" "}
          {item.historical_outcome.decision_outcome}
        </p>
        {item.historical_outcome.resolution_summary ? (
          <p className="mt-2 text-slate-600">
            {item.historical_outcome.resolution_summary}
          </p>
        ) : null}
      </div>
      {item.ai_decision_summary ? (
        <p className="mt-2 text-xs text-slate-500">
          AI Decision Summary:{" "}
          {item.ai_decision_summary.recommended_category || "—"} /{" "}
          {item.ai_decision_summary.recommended_priority || "—"}
        </p>
      ) : null}
      {item.human_decision_summary ? (
        <p className="mt-1 text-xs text-slate-500">
          Human Decision Summary:{" "}
          {item.human_decision_summary.decision_outcome || "none"}
        </p>
      ) : null}
    </li>
  );
}

function ResultsView({ data }: { data: AISimilarCases }) {
  const sorted = useMemo(
    () => sortSimilarCasesByScore(data.similar_cases),
    [data.similar_cases],
  );

  return (
    <div className="space-y-6">
      <SectionCard
        description="The case used as the similarity search input. Read-only."
        title="Current Case"
      >
        <CaseSummary caseCard={data.current_case} title="Search subject" />
      </SectionCard>

      <SectionCard
        description="Ranked historical matches with transparent scores and reasons."
        title="Top Similar Cases"
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Matches</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {formatReportingNumber(data.summary.match_count)}
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Top score</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {formatReportingNumber(data.summary.top_score)}
            </p>
          </article>
          <article className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Minimum similarity</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {formatReportingNumber(data.summary.min_similarity)}
            </p>
          </article>
        </div>

        {isAISimilarEmpty(data) ? (
          <EmptyState
            message={AI_SIMILAR_EMPTY_MESSAGE}
            title="No similar cases"
          />
        ) : (
          <ul className="space-y-4">
            {sorted.map((item) => (
              <SimilarCaseCard item={item} key={`${item.source_type}-${item.case_id}`} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Algorithm">
        <p className="text-sm text-slate-700">
          {data.algorithm.name} ({data.algorithm.version})
        </p>
        <p className="mt-2 text-sm text-slate-600">{data.algorithm.note}</p>
        <p className="mt-3 text-xs text-slate-500">{data.interpretation.note}</p>
      </SectionCard>
    </div>
  );
}

export function AISimilarCasesScreen() {
  const [draft, setDraft] = useState<AISimilarFilterDraft>(() =>
    createDefaultAISimilarFilters(),
  );
  const [applied, setApplied] = useState<AISimilarFilterDraft | null>(null);

  const dateError = dateValidationMessage(draft);
  const identityError =
    !draft.ticketId.trim() && !draft.analysisId.trim()
      ? "Enter a Ticket ID or Analysis ID to search similar cases."
      : null;
  const params = useMemo(
    () => (applied ? serializeAISimilarParams(applied) : null),
    [applied],
  );
  const query = useAISimilarCases(params);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Discover related historical FM Tickets, Maintenance Work Orders, and 5S Inspections with explainable rule-based similarity."
        title="AI Knowledge Base — Similar Cases"
      >
        <p className="text-sm text-slate-600">{AI_SIMILAR_DISCLAIMER}</p>
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
            Open AI Attention Center
          </Link>
        </p>
      </PageHeader>

      <SectionCard
        description="Reuse reporting date bounds. Provide a current ticket or analysis, then optionally narrow by category, priority, status, source, and minimum score."
        title="Search Filters"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormField htmlFor="similar-ticket-id" label="Ticket ID">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              id="similar-ticket-id"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  ticketId: event.target.value,
                }))
              }
              value={draft.ticketId}
            />
          </FormField>
          <FormField htmlFor="similar-analysis-id" label="Analysis ID">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              id="similar-analysis-id"
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  analysisId: event.target.value,
                }))
              }
              value={draft.analysisId}
            />
          </FormField>
          <FormField htmlFor="similar-date-from" label="Date From">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              id="similar-date-from"
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
          <FormField htmlFor="similar-date-to" label="Date To">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              id="similar-date-to"
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
            id="similar-category"
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
            id="similar-priority"
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
          <SelectField
            id="similar-status"
            label="Status"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                status: event.target.value,
              }))
            }
            options={[
              { value: "", label: "Completed statuses (default pool)" },
              ...REPORTING_TICKET_STATUS_OPTIONS,
            ]}
            value={draft.status}
          />
          <SelectField
            id="similar-source"
            label="Source"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                source: event.target.value,
              }))
            }
            options={SOURCE_OPTIONS}
            value={draft.source}
          />
          <FormField htmlFor="similar-min-score" label="Minimum Similarity">
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              id="similar-min-score"
              max={100}
              min={0}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  minSimilarity: event.target.value,
                }))
              }
              type="number"
              value={draft.minSimilarity}
            />
          </FormField>
        </div>

        {dateError || identityError ? (
          <p className="text-sm text-rose-700" role="alert">
            {identityError || dateError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={Boolean(dateError || identityError)}
            onClick={() => setApplied({ ...draft })}
            type="button"
          >
            Search similar cases
          </button>
          <button
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
            onClick={() => {
              const next = resetAISimilarFilters();
              setDraft(next);
              setApplied(null);
            }}
            type="button"
          >
            Reset
          </button>
        </div>
      </SectionCard>

      {!applied ? (
        <EmptyState
          message="Enter a Ticket ID or Analysis ID and apply filters to load similar historical cases."
          title="Ready to search"
        />
      ) : null}

      {applied && query.isPending ? (
        <LoadingState
          message="Scoring tenant-scoped historical cases."
          title="Loading similar cases"
        />
      ) : null}

      {applied && query.isError ? (
        <ErrorState
          message={formatReportingError(query.error)}
          title="Unable to load similar cases"
        />
      ) : null}

      {applied && query.data ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Period {formatReportingPeriod(query.data.period.start_date, query.data.period.end_date)}
          </p>
          <ResultsView data={query.data} />
        </div>
      ) : null}
    </div>
  );
}
