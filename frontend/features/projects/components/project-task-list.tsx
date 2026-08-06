"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";

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
  useProjectTaskList,
} from "@/hooks/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import {
  formatPersonLabel,
  formatProjectDate,
} from "@/lib/projects/display";
import {
  canCreateProjectTask,
  formatProjectTaskError,
  formatProjectTaskProgress,
  getProjectTaskListLayoutClasses,
} from "@/lib/projects/tasks-display";
import {
  DEFAULT_PROJECT_TASK_LIST_FILTERS,
  serializeProjectTaskListParams,
} from "@/lib/projects/tasks-filters";
import type {
  ProjectTaskListFilters,
  ProjectTaskListItem,
} from "@/types/projects";

import { ProjectTaskPriorityBadge } from "./project-task-priority-badge";
import { ProjectTaskStatusBadge } from "./project-task-status-badge";

const STATUS_OPTIONS: SelectOption[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "on_hold", label: "On Hold" },
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
  { value: "sequence", label: "Sequence: ascending" },
  { value: "-sequence", label: "Sequence: descending" },
  { value: "name", label: "Name: A to Z" },
  { value: "-name", label: "Name: Z to A" },
  { value: "status", label: "Status" },
  { value: "-status", label: "Status: reverse" },
  { value: "priority", label: "Priority: lowest first" },
  { value: "-priority", label: "Priority: highest first" },
  { value: "planned_end", label: "Planned end: earliest" },
  { value: "-planned_end", label: "Planned end: latest" },
  { value: "-updated", label: "Updated: newest first" },
  { value: "updated", label: "Updated: oldest first" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const MILESTONE_OPTIONS: SelectOption[] = [
  { value: "true", label: "Milestones only" },
  { value: "false", label: "Non-milestones" },
];

function TaskMobileCard({
  projectId,
  task,
}: {
  projectId: string;
  task: ProjectTaskListItem;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {task.task_code}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-950">
            {task.name}
          </h3>
        </div>
        <ProjectTaskStatusBadge status={task.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Priority
          </dt>
          <dd className="mt-1">
            <ProjectTaskPriorityBadge priority={task.priority} />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Progress
          </dt>
          <dd className="mt-1 font-medium text-slate-900">
            {formatProjectTaskProgress(task.progress_percentage)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Planned end
          </dt>
          <dd className="mt-1 text-slate-800">
            {formatProjectDate(task.planned_end)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">PIC</dt>
          <dd className="mt-1 text-slate-800">
            {formatPersonLabel(task.person_in_charge_email)}
          </dd>
        </div>
      </dl>
      <div className="mt-4">
        <Link
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href={`/projects/${projectId}/tasks/${task.id}`}
        >
          View detail
        </Link>
      </div>
    </article>
  );
}

export function ProjectTaskListScreen({ projectId }: { projectId: string }) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const projectQuery = useProjectDetail(projectId);
  const [filters, setFilters] = useState<ProjectTaskListFilters>(
    DEFAULT_PROJECT_TASK_LIST_FILTERS,
  );
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(filters.search.trim());
  const listParams = serializeProjectTaskListParams(
    filters,
    page,
    deferredSearch,
  );
  const listQuery = useProjectTaskList(projectId, listParams);
  const layout = getProjectTaskListLayoutClasses();
  const canCreate =
    !permissionsLoading && canCreateProjectTask(hasPermission);

  const columns: DataTableColumn<ProjectTaskListItem>[] = [
    {
      header: "Code",
      cell: (task) => (
        <span className="font-medium text-slate-900">{task.task_code}</span>
      ),
    },
    {
      header: "Name",
      cell: (task) => (
        <div className="min-w-0 whitespace-normal">
          <p className="font-medium text-slate-900">{task.name}</p>
          {task.is_milestone ? (
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Milestone
            </p>
          ) : null}
        </div>
      ),
      className: "min-w-56 whitespace-normal",
    },
    {
      header: "Status",
      cell: (task) => <ProjectTaskStatusBadge status={task.status} />,
    },
    {
      header: "Priority",
      cell: (task) => <ProjectTaskPriorityBadge priority={task.priority} />,
    },
    {
      header: "Progress",
      cell: (task) => formatProjectTaskProgress(task.progress_percentage),
    },
    {
      header: "PIC",
      cell: (task) => formatPersonLabel(task.person_in_charge_email),
      className: "min-w-40 whitespace-normal",
    },
    {
      header: "Planned end",
      cell: (task) => formatProjectDate(task.planned_end),
    },
    {
      header: "Actions",
      cell: (task) => (
        <Link
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href={`/projects/${projectId}/tasks/${task.id}`}
        >
          View
        </Link>
      ),
    },
  ];

  const projectName = projectQuery.data?.name ?? "Project";
  const tasks = listQuery.data?.results ?? [];
  const totalCount = listQuery.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        description={`Tasks for ${projectName}. Assign PIC, track status, and manage checklists without Gantt or dependency views.`}
        eyebrow="Project tasks"
        title="Tasks"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/projects/${projectId}`}
          >
            Back to project
          </Link>
          {canCreate ? (
            <Link
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              href={`/projects/${projectId}/tasks/new`}
            >
              New task
            </Link>
          ) : null}
        </div>
      </PageHeader>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField label="Search" htmlFor="task-search">
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              id="task-search"
              onChange={(event) => {
                setPage(1);
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }));
              }}
              placeholder="Code, name, PIC…"
              value={filters.search}
            />
          </FormField>
          <SelectField
            id="task-status"
            label="Status"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                status: event.target
                  .value as ProjectTaskListFilters["status"],
              }));
            }}
            options={STATUS_OPTIONS}
            placeholder="All statuses"
            value={filters.status}
          />
          <SelectField
            id="task-priority"
            label="Priority"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                priority: event.target
                  .value as ProjectTaskListFilters["priority"],
              }));
            }}
            options={PRIORITY_OPTIONS}
            placeholder="All priorities"
            value={filters.priority}
          />
          <SelectField
            id="task-milestone"
            label="Milestone"
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                isMilestone: event.target
                  .value as ProjectTaskListFilters["isMilestone"],
              }));
            }}
            options={MILESTONE_OPTIONS}
            placeholder="All tasks"
            value={filters.isMilestone}
          />
          <SelectField
            id="task-sort"
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
            id="task-page-size"
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
          title="Unable to load tasks"
          message={formatProjectTaskError(
            listQuery.error,
            "Task list could not be loaded.",
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
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No tasks found"
          message="Create a task or adjust filters to see project work items."
          action={
            canCreate ? (
              <Link
                className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                href={`/projects/${projectId}/tasks/new`}
              >
                Create task
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className={layout.tableWrapper}>
            <DataTable
              columns={columns}
              getRowKey={(task) => task.id}
              rows={tasks}
            />
          </div>
          <div className={layout.cardsWrapper}>
            {tasks.map((task) => (
              <TaskMobileCard
                key={task.id}
                projectId={projectId}
                task={task}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Showing {tasks.length} of {totalCount} tasks
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
