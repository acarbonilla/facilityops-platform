"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
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
  useProjectIssueList,
} from "@/hooks/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import {
  formatPersonLabel,
  formatProjectDate,
} from "@/lib/projects/display";
import {
  canManageProjectIssues,
  formatProjectIssueError,
  getProjectIssueListLayoutClasses,
} from "@/lib/projects/issues-display";
import {
  DEFAULT_PROJECT_ISSUE_LIST_FILTERS,
  serializeProjectIssueListParams,
} from "@/lib/projects/issues-filters";
import { readProjectIssueFormFlash } from "@/lib/projects/issues-form";
import type {
  ProjectIssueListFilters,
  ProjectIssueListItem,
} from "@/types/projects";

import { ProjectIssueSeverityBadge } from "./project-issue-severity-badge";
import { ProjectIssueStatusBadge } from "./project-issue-status-badge";

const STATUS_OPTIONS: SelectOption[] = [
  { value: "open", label: "Open" },
  { value: "investigating", label: "Investigating" },
  { value: "blocked", label: "Blocked" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

const SEVERITY_OPTIONS: SelectOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const SORT_OPTIONS: SelectOption[] = [
  { value: "-updated_at", label: "Updated: newest" },
  { value: "updated_at", label: "Updated: oldest" },
  { value: "due_date", label: "Due date: earliest" },
  { value: "-due_date", label: "Due date: latest" },
  { value: "severity", label: "Severity: lowest first" },
  { value: "-severity", label: "Severity: highest first" },
  { value: "status", label: "Status" },
  { value: "title", label: "Title: A to Z" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function IssueMobileCard({
  projectId,
  issue,
}: {
  projectId: string;
  issue: ProjectIssueListItem;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-950">
            {issue.title}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {issue.comments_count} comment
            {issue.comments_count === 1 ? "" : "s"}
          </p>
        </div>
        <ProjectIssueStatusBadge status={issue.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Severity
          </dt>
          <dd className="mt-1">
            <ProjectIssueSeverityBadge severity={issue.severity} />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Due date
          </dt>
          <dd className="mt-1 text-slate-800">
            {formatProjectDate(issue.due_date)}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Owner
          </dt>
          <dd className="mt-1 text-slate-800">
            {formatPersonLabel(issue.owner_email, "Unassigned")}
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <Link
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href={`/projects/${projectId}/issues/${issue.id}`}
        >
          View detail
        </Link>
      </div>
    </article>
  );
}

export function ProjectIssuesListScreen({
  projectId,
}: {
  projectId: string;
}) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const projectQuery = useProjectDetail(projectId);
  const [filters, setFilters] = useState<ProjectIssueListFilters>(
    DEFAULT_PROJECT_ISSUE_LIST_FILTERS,
  );
  const [page, setPage] = useState(1);
  const [flash, setFlash] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(filters.search.trim());
  const listParams = serializeProjectIssueListParams(
    filters,
    page,
    deferredSearch,
  );
  const listQuery = useProjectIssueList(projectId, listParams);
  const layout = getProjectIssueListLayoutClasses();
  const canManage =
    !permissionsLoading && canManageProjectIssues(hasPermission);

  useEffect(() => {
    setFlash(readProjectIssueFormFlash());
  }, []);

  const columns: DataTableColumn<ProjectIssueListItem>[] = [
    {
      header: "Title",
      cell: (issue) => (
        <span className="font-medium text-slate-900">{issue.title}</span>
      ),
      className: "min-w-48 whitespace-normal",
    },
    {
      header: "Status",
      cell: (issue) => <ProjectIssueStatusBadge status={issue.status} />,
    },
    {
      header: "Severity",
      cell: (issue) => (
        <ProjectIssueSeverityBadge severity={issue.severity} />
      ),
    },
    {
      header: "Owner",
      cell: (issue) => formatPersonLabel(issue.owner_email, "Unassigned"),
      className: "min-w-40 whitespace-normal",
    },
    {
      header: "Due",
      cell: (issue) => formatProjectDate(issue.due_date),
    },
    {
      header: "Comments",
      cell: (issue) => String(issue.comments_count),
    },
    {
      header: "Actions",
      cell: (issue) => (
        <Link
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href={`/projects/${projectId}/issues/${issue.id}`}
        >
          View
        </Link>
      ),
    },
  ];

  const projectName = projectQuery.data?.name ?? "Project";
  const issues = listQuery.data?.results ?? [];
  const totalCount = listQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        description={`Issues for ${projectName}. Track blockers, risks, and follow-ups.`}
        eyebrow="Project issues"
        title="Issues"
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
            href={`/projects/${projectId}/timeline`}
          >
            Timeline
          </Link>
          {canManage ? (
            <Link
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              href={`/projects/${projectId}/issues/new`}
            >
              New issue
            </Link>
          ) : null}
        </div>
      </PageHeader>

      {flash ? (
        <p
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          {flash}
        </p>
      ) : null}

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField label="Search" htmlFor="issue-search">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              id="issue-search"
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }));
              }}
              placeholder="Title or description…"
              value={filters.search}
            />
          </FormField>
          <SelectField
            id="issue-status"
            label="Status"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                status: event.target
                  .value as ProjectIssueListFilters["status"],
              }));
            }}
            options={STATUS_OPTIONS}
            placeholder="All statuses"
            value={filters.status}
          />
          <SelectField
            id="issue-severity"
            label="Severity"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                severity: event.target
                  .value as ProjectIssueListFilters["severity"],
              }));
            }}
            options={SEVERITY_OPTIONS}
            placeholder="All severities"
            value={filters.severity}
          />
          <FormField label="Due from" htmlFor="issue-due-from">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              id="issue-due-from"
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  dueDateFrom: event.target.value,
                }));
              }}
              type="date"
              value={filters.dueDateFrom}
            />
          </FormField>
          <FormField label="Due to" htmlFor="issue-due-to">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              id="issue-due-to"
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  dueDateTo: event.target.value,
                }));
              }}
              type="date"
              value={filters.dueDateTo}
            />
          </FormField>
          <SelectField
            id="issue-sort"
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
            id="issue-page-size"
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
          title="Unable to load issues"
          message={formatProjectIssueError(
            listQuery.error,
            "Issue list could not be loaded.",
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
        />
      ) : issues.length === 0 ? (
        <EmptyState
          title="No issues found"
          message="Create an issue or adjust filters to see project risks and blockers."
          action={
            canManage ? (
              <Link
                className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                href={`/projects/${projectId}/issues/new`}
              >
                Create issue
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className={layout.tableWrapper}>
            <DataTable
              columns={columns}
              getRowKey={(issue) => issue.id}
              rows={issues}
            />
          </div>
          <div className={layout.cardsWrapper}>
            {issues.map((issue) => (
              <IssueMobileCard
                key={issue.id}
                projectId={projectId}
                issue={issue}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Showing {issues.length} of {totalCount} issues
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
