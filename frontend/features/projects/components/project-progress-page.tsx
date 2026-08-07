"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import {
  useProjectDetail,
  useProjectProgress,
  useProjectProgressHistory,
  useRecalculateProjectProgress,
} from "@/hooks/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import {
  formatPersonLabel,
  formatProjectDate,
  formatProjectDateTime,
  formatProjectLabel,
} from "@/lib/projects/display";
import {
  buildProgressSparklinePoints,
  canRecalculateProjectProgress,
  clampProgressPercent,
  formatProgressPercent,
  formatProgressSourceLabel,
  formatProgressTrendLabel,
  formatProjectProgressError,
  formatScheduleElapsedLabel,
  parseProgressPercent,
} from "@/lib/projects/progress";
import type {
  ProjectProgressSnapshot,
  ProjectProgressSummary,
  ProjectProgressTaskSummary,
} from "@/types/projects";

function SectionCard({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}

function AccessibleProgressBar({
  value,
  label,
  size = "md",
}: {
  value: string | number | null | undefined;
  label: string;
  size?: "sm" | "md";
}) {
  const parsed = parseProgressPercent(value) ?? 0;
  const clamped = clampProgressPercent(parsed);
  const text = formatProgressPercent(clamped);
  const heightClass = size === "sm" ? "h-2" : "h-3";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        <span className="text-sm font-semibold text-slate-950">{text}</span>
      </div>
      <div
        aria-label={`${label}: ${text}`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(clamped)}
        aria-valuetext={text}
        className={`w-full overflow-hidden rounded-full bg-slate-200 ${heightClass}`}
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-slate-700"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function CompactProgressBar({
  value,
  label,
}: {
  value: string | number | null | undefined;
  label: string;
}) {
  const parsed = parseProgressPercent(value) ?? 0;
  const clamped = clampProgressPercent(parsed);
  const text = formatProgressPercent(clamped);

  return (
    <div className="flex min-w-[8rem] items-center gap-2">
      <div
        aria-label={`${label}: ${text}`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(clamped)}
        aria-valuetext={text}
        className="h-2 w-20 overflow-hidden rounded-full bg-slate-200"
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

function TaskSummaryRow({
  task,
  projectId,
}: {
  task: ProjectProgressTaskSummary;
  projectId: string;
}) {
  return (
    <li className="flex flex-col gap-1 border-b border-slate-100 px-1 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link
          className="font-medium text-blue-700 hover:text-blue-800"
          href={`/projects/${projectId}/tasks/${task.id}`}
        >
          {task.task_code} — {task.name}
        </Link>
        <p className="mt-1 text-xs text-slate-500">
          {formatProjectLabel(task.status)}
          {task.is_milestone ? " · Milestone" : ""}
          {task.planned_end
            ? ` · Due ${formatProjectDate(task.planned_end)}`
            : ""}
        </p>
      </div>
      <span className="text-sm font-medium text-slate-800">
        {formatProgressPercent(task.progress_percentage)}
      </span>
    </li>
  );
}

function ProgressSparkline({
  snapshots,
}: {
  snapshots: ProjectProgressSnapshot[];
}) {
  const geometry = useMemo(() => {
    const chronological = [...snapshots].reverse();
    return buildProgressSparklinePoints(
      chronological.map((item) => item.completion_percentage),
    );
  }, [snapshots]);

  if (geometry.values.length < 2) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Completion trend (visual)
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Use the history table below for exact values. Sparkline is supplementary.
      </p>
      <svg
        aria-hidden="true"
        className="mt-3 w-full max-w-xs text-slate-700"
        height={geometry.height}
        role="img"
        viewBox={`0 0 ${geometry.width} ${geometry.height}`}
        width={geometry.width}
      >
        <polyline
          fill="none"
          points={geometry.points}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

function HistoryTable({
  rows,
  projectId,
}: {
  rows: ProjectProgressSnapshot[];
  projectId: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No progress history"
        message="Snapshots appear when accomplishment or related counts change."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <caption className="sr-only">
          Project progress history snapshots for project {projectId}
        </caption>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-semibold" scope="col">
              Recorded
            </th>
            <th className="px-3 py-2 font-semibold" scope="col">
              Completion
            </th>
            <th className="px-3 py-2 font-semibold" scope="col">
              Source
            </th>
            <th className="px-3 py-2 font-semibold" scope="col">
              Tasks
            </th>
            <th className="px-3 py-2 font-semibold" scope="col">
              Triggered by
            </th>
            <th className="px-3 py-2 font-semibold" scope="col">
              Related task
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                {formatProjectDateTime(row.recorded_at)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">
                {formatProgressPercent(row.completion_percentage)}
              </td>
              <td className="px-3 py-2 text-slate-700">
                {formatProgressSourceLabel(row.source)}
              </td>
              <td className="px-3 py-2 text-slate-700">
                {row.completed_task_count}/{row.included_task_count} completed
                {row.blocked_task_count > 0
                  ? ` · ${row.blocked_task_count} blocked`
                  : ""}
                {row.delayed_task_count > 0
                  ? ` · ${row.delayed_task_count} delayed`
                  : ""}
              </td>
              <td className="px-3 py-2 text-slate-700">
                {row.triggered_by
                  ? formatPersonLabel(
                      row.triggered_by.email || row.triggered_by.name,
                      row.triggered_by.name,
                    )
                  : "System"}
              </td>
              <td className="px-3 py-2 text-slate-700">
                {row.related_task ? (
                  <Link
                    className="text-blue-700 hover:text-blue-800"
                    href={`/projects/${projectId}/tasks/${row.related_task.id}`}
                  >
                    {row.related_task.task_code}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProgressDashboardBody({
  projectId,
  summary,
  history,
  canRecalculate,
  onRecalculate,
  recalculatePending,
  recalculateError,
}: {
  projectId: string;
  summary: ProjectProgressSummary;
  history: ProjectProgressSnapshot[];
  canRecalculate: boolean;
  onRecalculate: () => void;
  recalculatePending: boolean;
  recalculateError: string | null;
}) {
  const milestoneHint =
    summary.milestone_total > 0
      ? `${summary.milestone_completed} of ${summary.milestone_total} complete`
      : "No milestones";

  return (
    <div className="space-y-6">
      <SectionCard
        actions={
          canRecalculate ? (
            <button
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={recalculatePending}
              onClick={onRecalculate}
              type="button"
            >
              {recalculatePending ? "Recalculating…" : "Recalculate progress"}
            </button>
          ) : null
        }
        description="Accomplishment is the average of included task progress (cancelled tasks excluded). Schedule elapsed is separate."
        title="Accomplishment"
      >
        {recalculateError ? (
          <ErrorState title="Recalculation failed" message={recalculateError} />
        ) : null}
        <AccessibleProgressBar
          label="Project accomplishment"
          value={summary.project_completion_percentage}
        />
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            hint={formatScheduleElapsedLabel(
              summary.schedule_elapsed_percentage,
            )}
            label="Trend"
            value={formatProgressTrendLabel(summary.trend)}
          />
          <StatCard
            hint={`${summary.included_task_count} included · ${summary.excluded_task_count} excluded`}
            label="Tasks counted"
            value={summary.total_task_count.toLocaleString()}
          />
          <StatCard
            hint={milestoneHint}
            label="Milestones"
            value={`${summary.milestone_completed}/${summary.milestone_total}`}
          />
          <StatCard
            label="Last update"
            value={
              summary.last_progress_update_at
                ? formatProjectDateTime(summary.last_progress_update_at)
                : "—"
            }
          />
        </dl>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          description="Status breakdown across all project tasks."
          title="Task summary"
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Not started" value={summary.not_started_count} />
            <StatCard label="In progress" value={summary.in_progress_count} />
            <StatCard label="Completed" value={summary.completed_count} />
            <StatCard label="On hold" value={summary.on_hold_count} />
            <StatCard label="Cancelled" value={summary.cancelled_count} />
            <StatCard
              hint="Status = blocked"
              label="Blocked (status)"
              value={summary.status_blocked_count}
            />
          </dl>
        </SectionCard>

        <SectionCard
          description="Delay and dependency signals (text labels, not color-only)."
          title="Delay & blocked"
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Delayed tasks" value={summary.delayed_task_count} />
            <StatCard
              label="Completed late"
              value={summary.completed_late_count}
            />
            <StatCard
              label="Dependency blocked"
              value={summary.dependency_blocked_count}
            />
            <StatCard
              label="Unscheduled"
              value={summary.unscheduled_task_count}
            />
          </dl>
        </SectionCard>
      </div>

      <SectionCard
        description="Open collaboration issues affecting delivery risk."
        title="Issue summary"
      >
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Open" value={summary.open_issue_count} />
          <StatCard label="Overdue" value={summary.overdue_issue_count} />
          <StatCard label="Resolved" value={summary.resolved_issue_count} />
          <StatCard
            label="High / critical open"
            value={summary.high_critical_open_issue_count}
          />
          <StatCard label="Blocked issues" value={summary.blocked_issue_count} />
        </dl>
        <div className="pt-2">
          <Link
            className="text-sm font-medium text-blue-700 hover:text-blue-800"
            href={`/projects/${projectId}/issues`}
          >
            View project issues
          </Link>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          description="Next incomplete milestone by planned end."
          title="Next milestone"
        >
          {summary.next_milestone ? (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-3">
              <TaskSummaryRow
                projectId={projectId}
                task={summary.next_milestone}
              />
            </ul>
          ) : (
            <EmptyState
              title="No upcoming milestone"
              message="All milestones are complete, or none are defined."
            />
          )}
        </SectionCard>

        <SectionCard
          description="Incomplete tasks due within the next 14 days."
          title="Upcoming due tasks"
        >
          {summary.upcoming_due_tasks.length > 0 ? (
            <ul className="rounded-lg border border-slate-200 px-3">
              {summary.upcoming_due_tasks.map((task) => (
                <TaskSummaryRow
                  key={task.id}
                  projectId={projectId}
                  task={task}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No upcoming due tasks"
              message="Nothing is due in the next two weeks."
            />
          )}
        </SectionCard>
      </div>

      <SectionCard
        description="Primary accessible history is the table. Optional sparkline is visual-only."
        title="Progress history"
      >
        <ProgressSparkline snapshots={history} />
        <HistoryTable projectId={projectId} rows={history} />
      </SectionCard>
    </div>
  );
}

export function ProjectProgressPage({ projectId }: { projectId: string }) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const projectQuery = useProjectDetail(projectId);
  const progressQuery = useProjectProgress(projectId);
  const [historyPage, setHistoryPage] = useState(1);
  const historyQuery = useProjectProgressHistory(projectId, {
    page: historyPage,
    page_size: 20,
    ordering: "-recorded_at",
  });
  const recalculateMutation = useRecalculateProjectProgress(projectId);
  const [recalculateError, setRecalculateError] = useState<string | null>(null);

  const canRecalculate =
    !permissionsLoading && canRecalculateProjectProgress(hasPermission);

  const projectName = projectQuery.data?.name ?? "Project";
  const historyRows = historyQuery.data?.results ?? [];
  const historyCount = historyQuery.data?.count ?? 0;
  const historyPages = Math.max(1, Math.ceil(historyCount / 20));

  if (progressQuery.isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading progress">
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
      </div>
    );
  }

  if (progressQuery.isError || !progressQuery.data) {
    return (
      <ErrorState
        title="Unable to load progress"
        message={formatProjectProgressError(
          progressQuery.error,
          "Project progress could not be loaded.",
        )}
        action={
          <button
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            onClick={() => void progressQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description={`Accomplishment, schedule elapsed, blockers, and progress history for ${projectName}.`}
        eyebrow="Project progress"
        title="Progress & accomplishment"
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
            href={`/projects/${projectId}/gantt`}
          >
            Gantt
          </Link>
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/projects/${projectId}/timeline`}
          >
            Timeline
          </Link>
        </div>
      </PageHeader>

      <ProgressDashboardBody
        canRecalculate={canRecalculate}
        history={historyRows}
        onRecalculate={() => {
          setRecalculateError(null);
          void recalculateMutation
            .mutateAsync()
            .then(async () => {
              await historyQuery.refetch();
            })
            .catch((error: unknown) => {
              setRecalculateError(
                formatProjectProgressError(
                  error,
                  "Progress could not be recalculated.",
                ),
              );
            });
        }}
        projectId={projectId}
        recalculateError={recalculateError}
        recalculatePending={recalculateMutation.isPending}
        summary={progressQuery.data}
      />

      {historyQuery.isError ? (
        <ErrorState
          title="Unable to load progress history"
          message={formatProjectProgressError(
            historyQuery.error,
            "Progress history could not be loaded.",
          )}
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => void historyQuery.refetch()}
              type="button"
            >
              Retry history
            </button>
          }
        />
      ) : null}

      {historyPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            History page {historyPage} of {historyPages} ({historyCount}{" "}
            snapshots)
          </p>
          <div className="flex gap-2">
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={historyPage <= 1}
              onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
              type="button"
            >
              Previous
            </button>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={historyPage >= historyPages}
              onClick={() =>
                setHistoryPage((page) => Math.min(historyPages, page + 1))
              }
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { CompactProgressBar, AccessibleProgressBar };
