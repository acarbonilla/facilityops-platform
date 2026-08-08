"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import {
  SelectField,
  type SelectOption,
} from "@/components/common/select-field";
import {
  useProjectDetail,
  useProjectTimeline,
} from "@/hooks/use-projects";
import {
  formatPersonLabel,
  formatProjectDateTime,
  formatProjectLabel,
} from "@/lib/projects/display";
import {
  DEFAULT_PROJECT_TIMELINE_LIST_FILTERS,
  formatProjectTimelineCategoryLabel,
  formatProjectTimelineError,
  formatTimelineMetadataValue,
  serializeProjectTimelineListParams,
} from "@/lib/projects/timeline";
import type {
  ProjectTimelineEntry,
  ProjectTimelineListFilters,
} from "@/types/projects";

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "project", label: "Project" },
  { value: "task", label: "Task" },
  { value: "issue", label: "Issue" },
  { value: "note", label: "Note" },
  { value: "attachment", label: "Attachment" },
  { value: "comment", label: "Comment" },
  { value: "status", label: "Status" },
  { value: "assignment", label: "Assignment" },
  { value: "dependency", label: "Dependency" },
  { value: "checklist", label: "Checklist" },
];

const SORT_OPTIONS: SelectOption[] = [
  { value: "-timestamp", label: "Newest first" },
  { value: "timestamp", label: "Oldest first" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function TimelineEntryCard({ entry }: { entry: ProjectTimelineEntry }) {
  const [expanded, setExpanded] = useState(false);
  const metadataEntries = Object.entries(entry.metadata ?? {});
  const actorLabel = entry.actor
    ? formatPersonLabel(entry.actor.email || entry.actor.name, entry.actor.name)
    : "System";

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
              {formatProjectTimelineCategoryLabel(entry.category)}
            </span>
            <span className="text-xs text-slate-500">
              {formatProjectLabel(entry.event_type)}
            </span>
          </div>
          <h3 className="text-base font-semibold text-slate-950">
            {entry.title}
          </h3>
          {entry.description ? (
            <p className="text-sm text-slate-700">{entry.description}</p>
          ) : null}
          {entry.related_object ? (
            <p className="text-xs text-slate-500">
              Related: {formatProjectLabel(entry.related_object.type)}
              {entry.related_object.code
                ? ` (${entry.related_object.code})`
                : ""}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-xs text-slate-500">
            {formatProjectDateTime(entry.timestamp)}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-700">{actorLabel}</p>
        </div>
      </div>

      {metadataEntries.length > 0 ? (
        <div className="mt-4">
          <button
            aria-expanded={expanded}
            className="text-sm font-medium text-blue-700 hover:text-blue-800"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {expanded ? "Hide metadata" : "Show metadata"}
          </button>
          {expanded ? (
            <dl className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-2">
              {metadataEntries.map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">
                    {formatProjectLabel(key)}
                  </dt>
                  <dd className="mt-1 break-words text-slate-800">
                    {formatTimelineMetadataValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function ProjectTimelinePage({ projectId }: { projectId: string }) {
  const projectQuery = useProjectDetail(projectId);
  const [filters, setFilters] = useState<ProjectTimelineListFilters>(
    DEFAULT_PROJECT_TIMELINE_LIST_FILTERS,
  );
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(filters.search.trim());
  const listParams = serializeProjectTimelineListParams(
    filters,
    page,
    deferredSearch,
  );
  const listQuery = useProjectTimeline(projectId, listParams);

  const projectName = projectQuery.data?.name ?? "Project";
  const entries = listQuery.data?.results ?? [];
  const totalCount = listQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        description={`Activity stream for ${projectName}. Filter by category, actor, and date range.`}
        eyebrow="Project timeline"
        title="Timeline"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/projects/${projectId}`}
          >
            Back to project
          </Link>
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/projects/${projectId}/notes`}
          >
            Notes
          </Link>
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/projects/${projectId}/issues`}
          >
            Issues
          </Link>
        </div>
      </PageHeader>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField label="Search" htmlFor="timeline-search">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              id="timeline-search"
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }));
              }}
              placeholder="Title, description…"
              value={filters.search}
            />
          </FormField>
          <SelectField
            id="timeline-category"
            label="Category"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                category: event.target
                  .value as ProjectTimelineListFilters["category"],
              }));
            }}
            options={CATEGORY_OPTIONS}
            placeholder="All categories"
            value={filters.category}
          />
          <FormField label="Event type" htmlFor="timeline-event-type">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              id="timeline-event-type"
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  eventType: event.target.value,
                }));
              }}
              placeholder="e.g. note_created"
              value={filters.eventType}
            />
          </FormField>
          <FormField label="Date from" htmlFor="timeline-date-from">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              id="timeline-date-from"
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }));
              }}
              type="date"
              value={filters.dateFrom}
            />
          </FormField>
          <FormField label="Date to" htmlFor="timeline-date-to">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              id="timeline-date-to"
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }));
              }}
              type="date"
              value={filters.dateTo}
            />
          </FormField>
          <SelectField
            id="timeline-sort"
            label="Sort"
            onChange={(event) => {
              setFilters((current) => ({
                ...current,
                sort: event.target.value,
              }));
            }}
            options={SORT_OPTIONS}
            value={filters.sort}
          />
          <SelectField
            id="timeline-page-size"
            label="Page size"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                pageSize: Number(event.target.value) || 20,
              }));
            }}
            options={PAGE_SIZE_OPTIONS.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
            value={String(filters.pageSize)}
          />
        </div>
      </section>

      {listQuery.isError ? (
        <ErrorState
          title="Unable to load timeline"
          message={formatProjectTimelineError(
            listQuery.error,
            "Timeline could not be loaded.",
          )}
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => void listQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          }
        />
      ) : null}

      {listQuery.isPending ? (
        <div
          className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
          role="status"
          aria-label="Loading timeline"
        />
      ) : entries.length === 0 ? (
        <EmptyState
          title="No timeline events"
          message="Project activity will appear here as notes, issues, tasks, and other changes are recorded."
        />
      ) : (
        <>
          <ol className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <TimelineEntryCard entry={entry} />
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Showing {entries.length} of {totalCount} events
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                Previous
              </button>
              <span className="px-2 py-2 text-sm text-slate-700">
                Page {page} of {totalPages}
              </span>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
