"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import {
  useCreateProjectDependency,
  useDeleteProjectDependency,
  useProjectDependencies,
  useProjectGantt,
  useProjectProgress,
} from "@/hooks/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import {
  canManageProjectDependencies,
  formatDependencyReadinessMessage,
  validateDependencyForm,
} from "@/lib/projects/dependencies";
import { formatProjectError } from "@/lib/projects/display";
import {
  fitGanttRangeToProject,
  formatGanttViewportLabel,
  jumpGanttRangeToToday,
  rezoomPreservingFocal,
  shiftGanttRange,
  type GanttDateRange,
  type GanttZoomScale,
} from "@/lib/projects/gantt";
import {
  clampProgressPercent,
  formatProgressPercent,
  parseProgressPercent,
} from "@/lib/projects/progress";
import { formatProjectTaskError } from "@/lib/projects/tasks-display";

import {
  ProjectGanttChart,
  ProjectGanttScheduleTable,
} from "./project-gantt-chart";

const ZOOM_OPTIONS: Array<{ value: GanttZoomScale; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function buildInitialRange(
  zoom: GanttZoomScale,
  project: {
    planned_start_date?: string | null;
    planned_end_date?: string | null;
  } | null,
  tasks: Array<{
    planned_start: string | null;
    planned_end: string | null;
  }>,
): GanttDateRange {
  return fitGanttRangeToProject({
    plannedStart: project?.planned_start_date,
    plannedEnd: project?.planned_end_date,
    taskStarts: tasks.map((task) => task.planned_start),
    taskEnds: tasks.map((task) => task.planned_end),
    zoom,
  });
}

export function ProjectGanttPage({ projectId }: { projectId: string }) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const ganttQuery = useProjectGantt(projectId);
  const progressQuery = useProjectProgress(projectId);
  const depsQuery = useProjectDependencies(projectId);
  const createDep = useCreateProjectDependency(projectId);
  const deleteDep = useDeleteProjectDependency(projectId);

  const [zoom, setZoom] = useState<GanttZoomScale>("week");
  const [range, setRange] = useState<GanttDateRange | null>(null);
  const [predecessorTask, setPredecessorTask] = useState("");
  const [successorTask, setSuccessorTask] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManageDeps =
    !permissionsLoading && canManageProjectDependencies(hasPermission);

  const data = ganttQuery.data;
  const tasks = useMemo(() => data?.tasks ?? [], [data?.tasks]);
  const dependencies = useMemo(
    () => data?.dependencies ?? [],
    [data?.dependencies],
  );
  const summary = data?.summary;

  const taskCodeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      map.set(task.id, task.task_code);
    }
    return map;
  }, [tasks]);

  const activeRange = useMemo(() => {
    if (range) {
      return range;
    }
    if (!data) {
      return fitGanttRangeToProject({ zoom });
    }
    return buildInitialRange(zoom, data.project, data.tasks);
  }, [data, range, zoom]);

  const unscheduled = useMemo(
    () => tasks.filter((task) => !task.is_scheduled),
    [tasks],
  );

  const taskOptions = useMemo(
    () =>
      tasks.map((task) => ({
        value: task.id,
        label: `${task.task_code} — ${task.name}`,
      })),
    [tasks],
  );

  const dependencyRows = depsQuery.data ?? [];

  if (ganttQuery.isPending) {
    return (
      <div className="space-y-6" role="status">
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
      </div>
    );
  }

  if (ganttQuery.isError || !data) {
    return (
      <ErrorState
        title="Unable to load Gantt"
        message={formatProjectError(
          ganttQuery.error,
          "The project schedule could not be loaded.",
        )}
        action={
          <button
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            onClick={() => void ganttQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        }
      />
    );
  }

  const project = data.project;
  const accomplishmentPercent =
    parseProgressPercent(
      progressQuery.data?.project_completion_percentage,
    ) ?? null;
  const accomplishmentClamped =
    accomplishmentPercent === null
      ? null
      : clampProgressPercent(accomplishmentPercent);
  const accomplishmentText =
    accomplishmentClamped === null
      ? null
      : formatProgressPercent(accomplishmentClamped);

  return (
    <div className="max-w-full space-y-6 overflow-x-hidden">
      <PageHeader
        description={`Schedule and finish-to-start dependencies for ${project.project_code}. Date edits stay on the task form — this chart is read-only.`}
        eyebrow="Project Gantt"
        title={project.name}
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
            href={`/projects/${projectId}/tasks`}
          >
            Tasks
          </Link>
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/projects/${projectId}/progress`}
          >
            Progress
          </Link>
        </div>
      </PageHeader>

      {summary ? (
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          {[
            { label: "Total tasks", value: summary.total_tasks },
            { label: "Scheduled", value: summary.scheduled_tasks },
            { label: "Unscheduled", value: summary.unscheduled_tasks },
            { label: "Milestones", value: summary.milestones },
            { label: "Delayed", value: summary.delayed_tasks },
            {
              label: "Dependency blocked",
              value: summary.dependency_blocked_tasks,
            },
          ].map((item) => (
            <div
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              key={item.label}
            >
              <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                {item.label}
              </dt>
              <dd className="mt-2 text-2xl font-semibold text-slate-950">
                {item.value.toLocaleString()}
              </dd>
            </div>
          ))}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Accomplishment
            </dt>
            <dd className="mt-2 text-2xl font-semibold text-slate-950">
              {progressQuery.isPending
                ? "…"
                : (accomplishmentText ?? "—")}
            </dd>
            {accomplishmentClamped !== null ? (
              <div
                aria-label={`Accomplishment: ${accomplishmentText}`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.round(accomplishmentClamped)}
                aria-valuetext={accomplishmentText ?? undefined}
                className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
              >
                <div
                  className="h-full rounded-full bg-slate-700"
                  style={{ width: `${accomplishmentClamped}%` }}
                />
              </div>
            ) : null}
          </div>
        </dl>
      ) : null}

      <section
        aria-label="Gantt timeline controls"
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div role="group" aria-label="Zoom scale">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Zoom
            </p>
            <div className="flex flex-wrap gap-2">
              {ZOOM_OPTIONS.map((option) => (
                <button
                  aria-pressed={zoom === option.value}
                  className={`rounded-md border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    zoom === option.value
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                  key={option.value}
                  onClick={() => {
                    setZoom(option.value);
                    setRange((current) =>
                      rezoomPreservingFocal(
                        current ?? activeRange,
                        option.value,
                      ),
                    );
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            aria-label="Previous date range"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() =>
              setRange(shiftGanttRange(activeRange, zoom, -1))
            }
            type="button"
          >
            Previous
          </button>
          <button
            aria-label="Next date range"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => setRange(shiftGanttRange(activeRange, zoom, 1))}
            type="button"
          >
            Next
          </button>
          <button
            aria-label="Jump timeline to today"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() =>
              setRange(jumpGanttRangeToToday(activeRange, zoom))
            }
            type="button"
          >
            Today
          </button>
          <button
            aria-label="Fit timeline to project dates"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() =>
              setRange(buildInitialRange(zoom, project, tasks))
            }
            type="button"
          >
            Fit project
          </button>
        </div>
        <p className="text-sm font-medium text-slate-800" aria-live="polite">
          Viewport: {formatGanttViewportLabel(activeRange)}
        </p>
        <p className="text-xs text-slate-600 md:hidden">
          On phones, use the Schedule table below as the primary schedule view.
          The interactive drag/pan Gantt is available from tablet widths upward.
        </p>
      </section>

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          message="Create tasks with planned dates to populate the Gantt chart."
          action={
            <Link
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              href={`/projects/${projectId}/tasks/new`}
            >
              Create task
            </Link>
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <ProjectGanttChart
              dependencies={dependencies}
              projectId={projectId}
              range={activeRange}
              tasks={tasks}
              zoom={zoom}
            />
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-950">
              Schedule table
            </h2>
            <p className="text-sm text-slate-600">
              Accessible schedule for all viewports. On mobile this is the
              primary timeline view.
            </p>
            <ProjectGanttScheduleTable
              projectId={projectId}
              taskCodeById={taskCodeById}
              tasks={tasks}
            />
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950">
              Unscheduled tasks ({unscheduled.length})
            </h2>
            <p className="text-sm text-slate-600">
              Tasks without both planned start and end dates are listed here —
              no dates are invented for the chart.
            </p>
            {unscheduled.length === 0 ? (
              <p className="text-sm text-slate-600">
                All tasks have planned dates.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                {unscheduled.map((task) => (
                  <li
                    className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    key={task.id}
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {task.task_code} · {task.name}
                      </p>
                      <p className="text-sm text-slate-600">
                        {formatDependencyReadinessMessage({
                          is_dependency_ready: task.is_dependency_ready,
                          blocking_predecessor_count:
                            task.blocking_predecessor_count,
                          blocking_predecessors: [],
                          predecessor_count: task.predecessor_count,
                        })}
                      </p>
                    </div>
                    <Link
                      className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      href={`/projects/${projectId}/tasks/${task.id}/edit`}
                    >
                      Edit dates
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-label="Gantt legend"
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
          >
            <h2 className="text-lg font-semibold text-slate-950">Legend</h2>
            <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-4 w-10 rounded-md border border-blue-700 bg-blue-200"
                />
                Task bar (blue fill = progress)
              </li>
              <li className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 rotate-45 border border-indigo-700 bg-indigo-500"
                />
                Milestone diamond
              </li>
              <li className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-4 w-0.5 bg-rose-600"
                />
                Today marker
              </li>
              <li>
                <span className="rounded bg-amber-100 px-1 text-xs font-semibold text-amber-900">
                  Delayed
                </span>{" "}
                — planned end passed, not completed
              </li>
              <li>
                <span className="rounded bg-rose-100 px-1 text-xs font-semibold text-rose-900">
                  Dependency blocked
                </span>{" "}
                — unfinished predecessors
              </li>
              <li>Gray arrows — finish-to-start dependency links</li>
            </ul>
          </section>
        </>
      )}

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Dependency management
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Create finish-to-start (FS) links between tasks on this project.
          </p>
        </div>

        {actionError ? (
          <ErrorState title="Dependency action failed" message={actionError} />
        ) : null}

        {canManageDeps ? (
          <form
            className="grid gap-4 md:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              setFormError(null);
              setActionError(null);
              const validation = validateDependencyForm({
                predecessorTask,
                successorTask,
              });
              if (!validation.valid) {
                setFormError(validation.errors.join(" "));
                return;
              }
              void createDep
                .mutateAsync({
                  predecessor_task: predecessorTask,
                  successor_task: successorTask,
                  dependency_type: "finish_to_start",
                })
                .then(() => {
                  setPredecessorTask("");
                  setSuccessorTask("");
                })
                .catch((error: unknown) => {
                  setActionError(
                    formatProjectTaskError(
                      error,
                      "Dependency could not be created.",
                    ),
                  );
                });
            }}
          >
            <SelectField
              id="gantt-predecessor"
              label="Predecessor"
              onChange={(event) => setPredecessorTask(event.target.value)}
              options={taskOptions}
              placeholder="Select predecessor"
              value={predecessorTask}
            />
            <SelectField
              id="gantt-successor"
              label="Successor"
              onChange={(event) => setSuccessorTask(event.target.value)}
              options={taskOptions}
              placeholder="Select successor"
              value={successorTask}
            />
            <div className="flex items-end">
              <button
                className="inline-flex w-full items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={createDep.isPending}
                type="submit"
              >
                {createDep.isPending ? "Creating…" : "Add FS dependency"}
              </button>
            </div>
            {formError ? (
              <p className="md:col-span-3 text-sm text-rose-700" role="alert">
                {formError}
              </p>
            ) : null}
          </form>
        ) : (
          <p className="text-sm text-slate-600">
            You can view dependencies but do not have permission to create or
            remove them.
          </p>
        )}

        {depsQuery.isPending ? (
          <div
            className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-100"
            role="status"
          />
        ) : depsQuery.isError ? (
          <ErrorState
            title="Unable to load dependencies"
            message={formatProjectTaskError(
              depsQuery.error,
              "Dependency list could not be loaded.",
            )}
          />
        ) : dependencyRows.length === 0 ? (
          <EmptyState
            title="No dependencies"
            message="Link tasks with finish-to-start dependencies to show connectors on the chart."
          />
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {dependencyRows.map((dep) => (
              <li
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                key={dep.id}
              >
                <p className="text-sm text-slate-800">
                  <span className="font-semibold">
                    {dep.predecessor_task_code}
                  </span>{" "}
                  →{" "}
                  <span className="font-semibold">
                    {dep.successor_task_code}
                  </span>{" "}
                  <span className="text-slate-500">(finish-to-start)</span>
                </p>
                {canManageDeps ? (
                  <button
                    className="inline-flex items-center rounded-md border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    disabled={deleteDep.isPending}
                    onClick={() => {
                      const confirmed = window.confirm(
                        `Remove dependency ${dep.predecessor_task_code} → ${dep.successor_task_code}?`,
                      );
                      if (!confirmed) return;
                      setActionError(null);
                      void deleteDep.mutateAsync(dep.id).catch((error: unknown) => {
                        setActionError(
                          formatProjectTaskError(
                            error,
                            "Dependency could not be removed.",
                          ),
                        );
                      });
                    }}
                    type="button"
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
