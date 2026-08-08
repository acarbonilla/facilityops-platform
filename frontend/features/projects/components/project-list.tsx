"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { DetailField } from "@/components/common/detail-field";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import {
  SelectField,
  type SelectOption,
} from "@/components/common/select-field";
import {
  useProjectList,
  useProjectMetrics,
} from "@/hooks/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import {
  canCreateProject,
  formatPersonLabel,
  formatProjectDate,
  formatProjectError,
  getProjectListLayoutClasses,
} from "@/lib/projects/display";
import { usesProjectWorkspaceMode } from "@/lib/projects/workspace";
import {
  clearIncompatibleProjectBuilding,
  DEFAULT_PROJECT_LIST_FILTERS,
  serializeProjectListParams,
} from "@/lib/projects/filters";
import {
  clampProgressPercent,
  formatProgressPercent,
  parseProgressPercent,
} from "@/lib/projects/progress";
import { getBuildings, getOrganizations } from "@/services/api/master-data";
import { masterDataQueryKeys } from "@/services/api/query-keys";
import type {
  ProjectListFilters,
  ProjectListItem,
  ProjectMetrics,
} from "@/types/projects";

import { ProjectPriorityBadge } from "./project-priority-badge";
import { ProjectStatusBadge } from "./project-status-badge";

const STATUS_OPTIONS: SelectOption[] = [
  { value: "draft", label: "Draft" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "delayed", label: "Delayed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const SORT_OPTIONS: SelectOption[] = [
  { value: "-updated", label: "Updated: newest first" },
  { value: "updated", label: "Updated: oldest first" },
  { value: "-created", label: "Created: newest first" },
  { value: "created", label: "Created: oldest first" },
  { value: "name", label: "Name: A to Z" },
  { value: "-name", label: "Name: Z to A" },
  { value: "project_code", label: "Code: ascending" },
  { value: "-project_code", label: "Code: descending" },
  { value: "status", label: "Status" },
  { value: "-status", label: "Status: reverse" },
  { value: "priority", label: "Priority: lowest first" },
  { value: "-priority", label: "Priority: highest first" },
  { value: "planned_end_date", label: "Planned end: earliest" },
  { value: "-planned_end_date", label: "Planned end: latest" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function ListProgressCell({
  value,
  projectName,
}: {
  value: string | number | null | undefined;
  projectName: string;
}) {
  const parsed = parseProgressPercent(value) ?? 0;
  const clamped = clampProgressPercent(parsed);
  const text = formatProgressPercent(clamped);

  return (
    <div className="flex min-w-[7.5rem] items-center gap-2">
      <div
        aria-label={`${projectName} completion ${text}`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(clamped)}
        aria-valuetext={text}
        className="h-2 w-16 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-slate-700"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-sm font-medium text-slate-900">{text}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">
        {value?.toLocaleString() ?? "—"}
      </p>
    </div>
  );
}

function ProjectMetricsSummary({
  metrics,
  isLoading,
}: {
  metrics?: ProjectMetrics;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
            key={`metric-skeleton-${index}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Total" value={metrics?.total} />
      <MetricCard label="In progress" value={metrics?.in_progress} />
      <MetricCard label="Delayed" value={metrics?.delayed} />
      <MetricCard label="Completed" value={metrics?.completed} />
    </div>
  );
}

function ProjectMobileCard({ project }: { project: ProjectListItem }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {project.project_code}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">
            {project.name}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {project.organization_name}
          </p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Priority
          </dt>
          <dd className="mt-1">
            <ProjectPriorityBadge priority={project.priority} />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Completion
          </dt>
          <dd className="mt-1">
            <ListProgressCell
              projectName={project.name}
              value={project.completion_percentage}
            />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Planned end
          </dt>
          <dd className="mt-1 text-slate-800">
            {formatProjectDate(project.planned_end_date)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Manager
          </dt>
          <dd className="mt-1 text-slate-800">
            {formatPersonLabel(project.project_manager_email)}
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <Link
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href={`/projects/${project.id}`}
        >
          View detail
        </Link>
      </div>
    </article>
  );
}

export function ProjectListScreen() {
  const { hasPermission, permissionsLoading, roles } = usePermissions();
  const workspaceMode = usesProjectWorkspaceMode({ roles, hasPermission });
  const [filters, setFilters] = useState<ProjectListFilters>(
    DEFAULT_PROJECT_LIST_FILTERS,
  );
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(filters.search.trim());
  const layout = getProjectListLayoutClasses();

  const queryParams = serializeProjectListParams(
    filters,
    page,
    deferredSearch,
  );
  const listQuery = useProjectList(queryParams);
  const metricsQuery = useProjectMetrics(queryParams);

  const organizationsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("organizations", { page_size: 100 }),
    queryFn: () => getOrganizations({ page_size: 100 }),
  });
  const buildingsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("buildings", { page_size: 100 }),
    queryFn: () => getBuildings({ page_size: 100 }),
  });

  const rows = listQuery.data?.results ?? [];
  const organizationOptions: SelectOption[] = (
    organizationsQuery.data?.results ?? []
  ).map((item) => ({ value: item.id, label: item.name }));
  const buildingOptions: SelectOption[] = (buildingsQuery.data?.results ?? [])
    .filter(
      (item) =>
        !filters.organization || item.organization === filters.organization,
    )
    .map((item) => ({ value: item.id, label: item.name }));

  const totalPages = Math.max(
    1,
    Math.ceil((listQuery.data?.count ?? 0) / filters.pageSize),
  );
  const showCreate =
    !permissionsLoading && !workspaceMode && canCreateProject(hasPermission);

  const columns: DataTableColumn<ProjectListItem>[] = [
    {
      header: "Code",
      cell: (item) => item.project_code,
      className: "min-w-32",
    },
    {
      header: "Name",
      cell: (item) => (
        <div className="min-w-0 whitespace-normal">
          <p className="font-medium text-slate-900">{item.name}</p>
          <p className="mt-1 text-xs text-slate-500">{item.organization_name}</p>
        </div>
      ),
      className: "min-w-72 whitespace-normal",
    },
    {
      header: "Status",
      cell: (item) => <ProjectStatusBadge status={item.status} />,
    },
    {
      header: "Priority",
      cell: (item) => <ProjectPriorityBadge priority={item.priority} />,
    },
    {
      header: "Completion",
      cell: (item) => (
        <ListProgressCell
          projectName={item.name}
          value={item.completion_percentage}
        />
      ),
      className: "min-w-40",
    },
    {
      header: "Planned end",
      cell: (item) => formatProjectDate(item.planned_end_date),
      className: "min-w-36 whitespace-normal",
    },
    {
      header: "Manager",
      cell: (item) => formatPersonLabel(item.project_manager_email),
      className: "min-w-48 whitespace-normal",
    },
    {
      header: "Actions",
      cell: (item) => (
        <Link
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href={`/projects/${item.id}`}
        >
          View detail
        </Link>
      ),
      className: "min-w-36 whitespace-normal",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        description={
          workspaceMode
            ? "Projects where you are a member or Person in Charge. Management controls stay with the Project Manager."
            : "Plan and track facility projects with status, priority, completion, and ownership filters."
        }
        eyebrow="Projects"
        title={workspaceMode ? "My Projects" : "Projects"}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <dl className="grid gap-4 sm:grid-cols-3">
            <DetailField label="Visible rows" value={rows.length} />
            <DetailField label="Current page" value={page} />
            <DetailField
              label="Total records"
              value={listQuery.data?.count ?? 0}
            />
          </dl>
          {showCreate ? (
            <Link
              className="inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              href="/projects/new"
            >
              New Project
            </Link>
          ) : null}
        </div>
      </PageHeader>

      <ProjectMetricsSummary
        isLoading={metricsQuery.isPending}
        metrics={metricsQuery.data}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Search and filters
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Search matches project code, name, description, and project
              manager. Filters and sort are applied by the projects API.
            </p>
          </div>
          <button
            className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setPage(1);
              setFilters(DEFAULT_PROJECT_LIST_FILTERS);
            }}
            type="button"
          >
            Reset filters
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField htmlFor="project-search" label="Search">
            <input
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              id="project-search"
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }));
              }}
              placeholder="Code, name, manager…"
              type="search"
              value={filters.search}
            />
          </FormField>
          <SelectField
            id="project-status"
            label="Status"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                status: event.target.value as ProjectListFilters["status"],
              }));
            }}
            options={STATUS_OPTIONS}
            placeholder="All statuses"
            value={filters.status}
          />
          <SelectField
            id="project-priority"
            label="Priority"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                priority: event.target
                  .value as ProjectListFilters["priority"],
              }));
            }}
            options={PRIORITY_OPTIONS}
            placeholder="All priorities"
            value={filters.priority}
          />
          <SelectField
            id="project-organization"
            label="Organization"
            onChange={(event) => {
              const organization = event.target.value;
              setPage(1);
              setFilters((current) => ({
                ...current,
                organization,
                building: clearIncompatibleProjectBuilding(
                  organization,
                  current.building,
                  buildingsQuery.data?.results ?? [],
                ),
              }));
            }}
            options={organizationOptions}
            placeholder="All organizations"
            value={filters.organization}
          />
          <SelectField
            id="project-building"
            label="Building"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                building: event.target.value,
              }));
            }}
            options={buildingOptions}
            placeholder="All buildings"
            value={filters.building}
          />
          <SelectField
            id="project-sort"
            label="Sort"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                sort: event.target.value,
              }));
            }}
            options={SORT_OPTIONS}
            value={filters.sort}
          />
        </div>
      </section>

      {listQuery.isPending ? (
        <div className="space-y-4" role="status">
          <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        </div>
      ) : null}

      {!listQuery.isPending && listQuery.isError ? (
        <ErrorState
          title="Unable to load projects"
          message={formatProjectError(
            listQuery.error,
            "Projects could not be loaded.",
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

      {!listQuery.isPending && !listQuery.isError && rows.length === 0 ? (
        <EmptyState
          title="No projects found"
          message="No projects matched the current search and filter combination."
        />
      ) : null}

      {!listQuery.isPending && !listQuery.isError && rows.length > 0 ? (
        <>
          <div className={layout.tableWrapper}>
            <DataTable
              caption="Project list"
              columns={columns}
              getRowKey={(item) => item.id}
              rows={rows}
            />
          </div>
          <div className={layout.cardsWrapper}>
            {rows.map((project) => (
              <ProjectMobileCard key={project.id} project={project} />
            ))}
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Pagination
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Page {page} of {totalPages}.{" "}
                  {(listQuery.data?.count ?? 0).toLocaleString()} total records.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField htmlFor="project-page-size" label="Rows per page">
                  <select
                    className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                    disabled={listQuery.isFetching}
                    id="project-page-size"
                    onChange={(event) => {
                      setPage(1);
                      setFilters((current) => ({
                        ...current,
                        pageSize: Number(event.target.value),
                      }));
                    }}
                    value={String(filters.pageSize)}
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </FormField>
                <div className="flex items-end gap-2 md:col-span-2">
                  <button
                    className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={page <= 1 || listQuery.isFetching}
                    onClick={() => setPage((current) => current - 1)}
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={page >= totalPages || listQuery.isFetching}
                    onClick={() => setPage((current) => current + 1)}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
