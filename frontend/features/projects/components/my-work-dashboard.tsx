"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { useAuth } from "@/hooks/use-auth";
import {
  useMyWorkDashboard,
  usePauseProjectTask,
  useResumeProjectTask,
  useStartProjectTask,
} from "@/hooks/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import { formatPersonLabel, formatProjectDate, formatProjectLabel } from "@/lib/projects/display";
import {
  emptyMyWorkMessage,
  formatBlockReasonLabel,
  formatDelayDaysLabel,
  formatMyWorkProgress,
  formatTechnicianTaskStatusLabel,
  getMyWorkQuickActions,
  MY_WORK_TASKS_ROUTE,
  summarizeMyWorkCards,
} from "@/lib/projects/my-work";
import { canUpdateProjectTask } from "@/lib/projects/tasks-display";
import type { MyWorkAssignedTask, MyWorkProjectCard } from "@/types/projects";

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
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
        {action}
      </div>
      {children}
    </section>
  );
}

function QuickActionButtons({ task }: { task: MyWorkAssignedTask }) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const canUpdate =
    !permissionsLoading && canUpdateProjectTask(hasPermission);
  const actions = getMyWorkQuickActions(task, {
    isAssignedToCurrentUser: true,
    canUpdate,
  });
  const startMutation = useStartProjectTask(task.project_id, task.id);
  const pauseMutation = usePauseProjectTask(task.project_id, task.id);
  const resumeMutation = useResumeProjectTask(task.project_id, task.id);
  const pending =
    startMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending;

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.includes("start") ? (
        <button
          aria-label={`Start task ${task.task_code}`}
          className="min-h-11 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          disabled={pending}
          onClick={() => void startMutation.mutateAsync()}
          type="button"
        >
          Start
        </button>
      ) : null}
      {actions.includes("pause") ? (
        <button
          aria-label={`Pause task ${task.task_code}`}
          className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          disabled={pending}
          onClick={() => void pauseMutation.mutateAsync()}
          type="button"
        >
          Pause
        </button>
      ) : null}
      {actions.includes("resume") ? (
        <button
          aria-label={`Resume task ${task.task_code}`}
          className="min-h-11 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          disabled={pending}
          onClick={() => void resumeMutation.mutateAsync()}
          type="button"
        >
          Resume
        </button>
      ) : null}
    </div>
  );
}

function TaskCard({ task }: { task: MyWorkAssignedTask }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {task.project_code} · {task.task_code}
          </p>
          <h3 className="text-base font-semibold text-slate-950">
            <Link
              className="text-blue-800 hover:underline"
              href={`/projects/${task.project_id}/tasks/${task.id}`}
            >
              {task.name}
            </Link>
          </h3>
          <p className="text-sm text-slate-700">{task.project_name}</p>
          <dl className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Status
              </dt>
              <dd>{formatTechnicianTaskStatusLabel(task.status)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Priority
              </dt>
              <dd>{formatProjectLabel(task.priority)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Progress
              </dt>
              <dd aria-label={`Progress ${formatMyWorkProgress(task.progress_percentage)}`}>
                {formatMyWorkProgress(task.progress_percentage)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Due
              </dt>
              <dd>
                {task.is_delayed
                  ? formatDelayDaysLabel(task.delay_days)
                  : formatProjectDate(task.planned_end)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Checklist
              </dt>
              <dd>{task.checklist_completion_label}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                Readiness
              </dt>
              <dd>
                {task.is_dependency_ready
                  ? "Ready"
                  : formatBlockReasonLabel(task.block_reason)}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-white"
            href={`/projects/${task.project_id}/tasks/${task.id}`}
          >
            Open
          </Link>
          <QuickActionButtons task={task} />
        </div>
      </div>
    </article>
  );
}

function TaskList({
  tasks,
  empty,
}: {
  tasks: MyWorkAssignedTask[];
  empty: { title: string; message: string };
}) {
  if (tasks.length === 0) {
    return <EmptyState title={empty.title} message={empty.message} />;
  }
  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <li key={task.id}>
          <TaskCard task={task} />
        </li>
      ))}
    </ul>
  );
}

function ProjectCard({ project }: { project: MyWorkProjectCard }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {project.project_code}
      </p>
      <h3 className="mt-1 text-base font-semibold text-slate-950">
        <Link
          className="text-blue-800 hover:underline"
          href={`/projects/${project.id}`}
        >
          {project.name}
        </Link>
      </h3>
      <dl className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Status
          </dt>
          <dd>{formatProjectLabel(project.status)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Accomplishment
          </dt>
          <dd>{formatMyWorkProgress(project.accomplishment_percentage)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Project manager
          </dt>
          <dd>{formatPersonLabel(project.project_manager_email)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Planned end
          </dt>
          <dd>{formatProjectDate(project.planned_end_date)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            My tasks
          </dt>
          <dd>
            {project.my_task_count} · {project.my_completed_task_count} completed ·{" "}
            {project.my_overdue_task_count} overdue
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function MyWorkDashboardScreen() {
  const { user } = useAuth();
  const dashboardQuery = useMyWorkDashboard();
  const [statusFilter, setStatusFilter] = useState("");
  const data = dashboardQuery.data;

  const cards = useMemo(
    () => summarizeMyWorkCards(data?.summary),
    [data?.summary],
  );

  if (dashboardQuery.isPending) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading My Work">
        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (dashboardQuery.isError || !data) {
    return (
      <ErrorState
        title="Unable to load My Work"
        message="Assigned Project work could not be loaded."
        action={
          <button
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white"
            onClick={() => void dashboardQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        }
      />
    );
  }

  const filteredAssigned = statusFilter
    ? data.assigned_tasks.filter((task) => task.status === statusFilter)
    : data.assigned_tasks;

  return (
    <div className="space-y-6">
      <PageHeader
        description={`Personalized assigned Project work for ${user?.email || "you"}. Full execution stays on Task Detail.`}
        eyebrow="Technician workspace"
        title="My Work"
      >
        <Link
          className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          href={MY_WORK_TASKS_ROUTE}
        >
          All assigned tasks
        </Link>
      </PageHeader>

      <section aria-label="Workload summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            key={card.id}
          >
            <p className="text-sm font-medium text-slate-600">{card.label}</p>
            <p
              aria-label={`${card.label}: ${card.value}`}
              className="mt-2 text-3xl font-semibold tracking-tight text-slate-950"
            >
              {card.value}
            </p>
          </article>
        ))}
      </section>

      <Section
        description="Simple counts only — not a productivity score."
        title="Workload"
      >
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ["Assigned", data.workload.assigned],
              ["In progress", data.workload.in_progress],
              ["Overdue", data.workload.overdue],
              ["Blocked", data.workload.blocked],
              ["Paused", data.workload.paused],
              ["Completed", data.workload.completed],
            ] as const
          ).map(([label, value]) => (
            <div
              className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              key={label}
            >
              <dt className="text-xs uppercase tracking-wide text-slate-500">
                {label}
              </dt>
              <dd
                aria-label={`${label}: ${value}`}
                className="mt-1 text-xl font-semibold text-slate-950"
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Today's Work" description="Active window, due today, or in progress.">
        <TaskList tasks={data.today} empty={emptyMyWorkMessage("today")} />
      </Section>

      <Section title="Overdue" description="Planned end before today (FO-105 delay).">
        <TaskList tasks={data.overdue} empty={emptyMyWorkMessage("overdue")} />
      </Section>

      <Section title="Due Today">
        <TaskList tasks={data.due_today} empty={emptyMyWorkMessage("today")} />
      </Section>

      <Section title="Due This Week" description={`Through ${data.week_end}.`}>
        <TaskList
          tasks={data.due_this_week}
          empty={{
            title: "Nothing else due this week",
            message: "No additional assigned tasks are due later this week.",
          }}
        />
      </Section>

      <Section title="Blocked / Paused">
        <TaskList tasks={data.blocked} empty={emptyMyWorkMessage("blocked")} />
      </Section>

      <Section
        action={
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Status filter
            <select
              className="min-h-11 rounded-md border border-slate-300 px-3 py-2"
              onChange={(event) => setStatusFilter(event.target.value)}
              value={statusFilter}
            >
              <option value="">All active</option>
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="on_hold">Paused</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
        }
        description="Personally assigned tasks only."
        title="My Assigned Tasks"
      >
        <TaskList
          tasks={filteredAssigned}
          empty={emptyMyWorkMessage("assigned")}
        />
      </Section>

      <Section title="My Projects">
        {data.projects.length === 0 ? (
          <EmptyState {...emptyMyWorkMessage("projects")} />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {data.projects.map((project) => (
              <li key={project.id}>
                <ProjectCard project={project} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Upcoming">
        <TaskList tasks={data.upcoming} empty={emptyMyWorkMessage("upcoming")} />
      </Section>

      <Section title="Unscheduled Work">
        <TaskList
          tasks={data.unscheduled}
          empty={emptyMyWorkMessage("unscheduled")}
        />
      </Section>

      <Section title="Recently Completed" description="Last 14 days.">
        <TaskList
          tasks={data.recently_completed}
          empty={emptyMyWorkMessage("completed")}
        />
      </Section>

      <Section
        description="Open Project Issues you reported while executing tasks."
        title="Open Blockers"
      >
        {data.blockers.length === 0 ? (
          <EmptyState
            title="No open blockers"
            message="You have no open Project Issues reported from task execution."
          />
        ) : (
          <ul className="space-y-3">
            {data.blockers.map((issue) => (
              <li
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                key={issue.id}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {issue.project_code} · {formatProjectLabel(issue.severity)}
                </p>
                <Link
                  className="mt-1 inline-block text-sm font-semibold text-blue-800 hover:underline"
                  href={`/projects/${issue.project_id}/issues/${issue.id}`}
                >
                  {issue.title}
                </Link>
                <p className="mt-1 text-sm text-slate-700">
                  {issue.project_name} · {formatProjectLabel(issue.status)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
