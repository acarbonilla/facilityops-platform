"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { useMyWorkTaskList } from "@/hooks/use-projects";
import { formatProjectDate, formatProjectLabel } from "@/lib/projects/display";
import {
  emptyMyWorkMessage,
  formatDelayDaysLabel,
  formatMyWorkProgress,
  formatTechnicianTaskStatusLabel,
  MY_WORK_ROUTE,
} from "@/lib/projects/my-work";
import type { MyWorkListParams, ProjectPriority, ProjectTaskStatus } from "@/types/projects";

export function MyWorkTaskListScreen() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProjectTaskStatus | "">("");
  const [priority, setPriority] = useState<ProjectPriority | "">("");
  const [page, setPage] = useState(1);

  const params = useMemo<MyWorkListParams>(() => {
    const next: MyWorkListParams = {
      page,
      page_size: 20,
    };
    if (search.trim()) {
      next.search = search.trim();
    }
    if (status) {
      next.status = status;
    }
    if (priority) {
      next.priority = priority;
    }
    return next;
  }, [page, priority, search, status]);

  const listQuery = useMyWorkTaskList(params);
  const rows = listQuery.data?.results ?? [];
  const totalPages = listQuery.data
    ? Math.max(1, Math.ceil(listQuery.data.count / 20))
    : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        description="All personally assigned Project tasks with search and filters."
        eyebrow="Technician workspace"
        title="Assigned Work"
      >
        <Link
          className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          href={MY_WORK_ROUTE}
        >
          Back to My Work
        </Link>
      </PageHeader>

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Search
          <input
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2"
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Task or project"
            type="search"
            value={search}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Status
          <select
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2"
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as ProjectTaskStatus | "");
            }}
            value={status}
          >
            <option value="">All</option>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="on_hold">Paused</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Priority
          <select
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2"
            onChange={(event) => {
              setPage(1);
              setPriority(event.target.value as ProjectPriority | "");
            }}
            value={priority}
          >
            <option value="">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
      </section>

      {listQuery.isPending ? (
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" role="status" />
      ) : null}

      {listQuery.isError ? (
        <ErrorState
          title="Unable to load assigned tasks"
          message="The assigned work list could not be loaded."
        />
      ) : null}

      {!listQuery.isPending && !listQuery.isError && rows.length === 0 ? (
        <EmptyState {...emptyMyWorkMessage("assigned")} />
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => (
                <tr className="border-b border-slate-100" key={task.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <div>{task.task_code}</div>
                    <div className="text-slate-600">{task.name}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {task.project_code}
                    <div className="text-slate-500">{task.project_name}</div>
                  </td>
                  <td className="px-4 py-3">
                    {formatTechnicianTaskStatusLabel(task.status)}
                  </td>
                  <td className="px-4 py-3">{formatProjectLabel(task.priority)}</td>
                  <td className="px-4 py-3">
                    <span
                      aria-label={`Progress ${formatMyWorkProgress(task.progress_percentage)}`}
                    >
                      {formatMyWorkProgress(task.progress_percentage)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {task.is_delayed
                      ? formatDelayDaysLabel(task.delay_days)
                      : formatProjectDate(task.planned_end)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-blue-800 hover:underline"
                      href={`/projects/${task.project_id}/tasks/${task.id}`}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <button
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            Previous
          </button>
          <p className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </p>
          <button
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
            type="button"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
