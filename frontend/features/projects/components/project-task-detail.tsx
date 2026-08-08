"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { useAuth } from "@/hooks/use-auth";
import {
  useAssignProjectTask,
  useDeleteProjectTask,
  useProjectDetail,
  useProjectHistory,
  useProjectLinkList,
  useProjectMembers,
  useProjectTaskDependencyReadiness,
  useProjectTaskDetail,
  useProjectTaskPredecessors,
  useProjectTaskSuccessors,
} from "@/hooks/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import {
  canTechnicianEditFullTaskForm,
} from "@/lib/projects/execution";
import {
  formatPersonLabel,
  formatProjectDate,
  formatProjectDateTime,
  formatProjectLabel,
} from "@/lib/projects/display";
import { formatDependencyReadinessMessage } from "@/lib/projects/dependencies";
import {
  formatActualExecutionRangeLabel,
  formatScheduleStatusSummary,
  formatVarianceDaysLabel,
} from "@/lib/projects/execution-variance";
import { formatDelayLabel } from "@/lib/projects/gantt";
import {
  filterLinksForProjectTask,
  formatProjectLinkAccessibilityLabel,
  formatProjectLinkRelationshipLabel,
  formatProjectLinkTargetLabel,
  formatProjectLinkTypeLabel,
  getProjectLinkTargetHref,
} from "@/lib/projects/links";
import {
  canAssignProjectTask,
  canCommentOnProjectTask,
  canDeleteProjectTask,
  canUpdateProjectTask,
  formatProjectTaskError,
  formatProjectTaskProgress,
  formatTaskPlannedScheduleLabel,
  isTaskRelatedHistoryAction,
  isTaskScheduleUnscheduled,
} from "@/lib/projects/tasks-display";
import { readProjectTaskFormFlash } from "@/lib/projects/tasks-form";
import {
  canManageProjectLinks,
  canReportProjectIssue,
  usesProjectWorkspaceMode,
} from "@/lib/projects/workspace";
import type {
  ProjectHistory,
  ProjectMember,
  ProjectOperationalLink,
  ProjectTaskDependency,
} from "@/types/projects";

import { ProjectTaskAttachments } from "./project-task-attachments";
import { ProjectTaskChecklist } from "./project-task-checklist";
import { ProjectTaskComments } from "./project-task-comments";
import { ProjectTaskExecutionPanel } from "./project-task-execution-panel";
import { ProjectTaskPriorityBadge } from "./project-task-priority-badge";
import { ProjectTaskStatusBadge } from "./project-task-status-badge";

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

function MetadataList({
  items,
}: {
  items: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          key={item.label}
        >
          <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {item.label}
          </dt>
          <dd className="mt-2 text-sm font-medium text-slate-900">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TaskHistorySummary({ entries }: { entries: ProjectHistory[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="No task history yet"
        message="Task-related project history will appear here as the task changes."
      />
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li
          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          key={entry.id}
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium text-slate-900">
                {formatProjectLabel(entry.action)}
              </p>
              <p className="mt-1 text-sm text-slate-700">{entry.description}</p>
            </div>
            <p className="shrink-0 text-xs text-slate-500">
              {formatProjectDateTime(entry.created_at)}
            </p>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {formatPersonLabel(entry.actor_email, "System")}
          </p>
        </li>
      ))}
    </ol>
  );
}

function buildPicOptions(
  members: ProjectMember[],
  projectManagerId: string | null | undefined,
  projectManagerEmail: string | null | undefined,
) {
  const options = members
    .filter((member) => member.is_active)
    .map((member) => ({
      value: member.user,
      label: `${member.user_name || member.user_email} (${member.user_email}) — ${formatProjectLabel(member.role)}`,
    }));

  if (
    projectManagerId &&
    !options.some((option) => option.value === projectManagerId)
  ) {
    options.unshift({
      value: projectManagerId,
      label: `${projectManagerEmail || "Project manager"} — Project Manager`,
    });
  }

  return options;
}

function DependencyLinkList({
  title,
  items,
  loading,
  emptyMessage,
  mode,
  projectId,
}: {
  title: string;
  items: ProjectTaskDependency[];
  loading: boolean;
  emptyMessage: string;
  mode: "predecessor" | "successor";
  projectId: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {loading ? (
        <div
          className="mt-3 h-12 animate-pulse rounded border border-slate-200 bg-slate-100"
          role="status"
        />
      ) : items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">{emptyMessage}</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm text-slate-800">
          {items.map((dep) => {
            const code =
              mode === "predecessor"
                ? dep.predecessor_task_code
                : dep.successor_task_code;
            const id =
              mode === "predecessor"
                ? dep.predecessor_task
                : dep.successor_task;
            return (
              <li key={dep.id}>
                <Link
                  className="font-medium text-blue-800 hover:underline"
                  href={`/projects/${projectId}/tasks/${id}`}
                >
                  {code}
                </Link>{" "}
                <span className="text-slate-500">(FS)</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ProjectTaskDetailScreen({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { hasPermission, permissionsLoading, roles } = usePermissions();
  const workspaceMode = usesProjectWorkspaceMode({ roles, hasPermission });
  const projectQuery = useProjectDetail(projectId);
  const detailQuery = useProjectTaskDetail(projectId, taskId);
  const membersQuery = useProjectMembers(projectId);
  const historyQuery = useProjectHistory(projectId);
  const predecessorsQuery = useProjectTaskPredecessors(projectId, taskId);
  const successorsQuery = useProjectTaskSuccessors(projectId, taskId);
  const readinessQuery = useProjectTaskDependencyReadiness(projectId, taskId);
  const linksQuery = useProjectLinkList(projectId, { page_size: 100 });
  const assignMutation = useAssignProjectTask(projectId, taskId);
  const deleteMutation = useDeleteProjectTask(projectId);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedPic, setSelectedPic] = useState("");

  useEffect(() => {
    setFlashMessage(readProjectTaskFormFlash());
  }, []);

  useEffect(() => {
    if (detailQuery.data?.person_in_charge) {
      setSelectedPic(detailQuery.data.person_in_charge);
    }
  }, [detailQuery.data?.person_in_charge]);

  const picOptions = useMemo(
    () =>
      buildPicOptions(
        membersQuery.data?.results ?? [],
        projectQuery.data?.project_manager,
        projectQuery.data?.project_manager_email,
      ),
    [membersQuery.data?.results, projectQuery.data],
  );

  const taskHistory = useMemo(() => {
    const entries = historyQuery.data?.results ?? [];
    const filtered = entries.filter((entry) => {
      if (isTaskRelatedHistoryAction(entry.action)) {
        return true;
      }
      const metadataTaskId = entry.metadata?.task_id;
      return metadataTaskId === taskId;
    });
    return filtered.slice(0, 20);
  }, [historyQuery.data?.results, taskId]);

  const taskLinks = useMemo(
    () =>
      filterLinksForProjectTask(linksQuery.data?.results ?? [], taskId),
    [linksQuery.data?.results, taskId],
  );

  if (detailQuery.isPending) {
    return (
      <div className="space-y-6" role="status">
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title="Unable to load task"
        message={formatProjectTaskError(
          detailQuery.error,
          "The selected task could not be loaded.",
        )}
        action={
          <button
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            onClick={() => void detailQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        }
      />
    );
  }

  const task = detailQuery.data;
  const isAssignedToCurrentUser = Boolean(
    user?.id && task.person_in_charge === user.id,
  );
  const canUpdate = !permissionsLoading && canUpdateProjectTask(hasPermission);
  const canFullEdit = canTechnicianEditFullTaskForm({
    usesWorkspaceMode: workspaceMode,
    hasPermission,
  });
  const canEditChecklist =
    canUpdate && (!workspaceMode || isAssignedToCurrentUser);
  const canDelete =
    !permissionsLoading &&
    !workspaceMode &&
    canDeleteProjectTask(hasPermission);
  const canAssign =
    !permissionsLoading &&
    !workspaceMode &&
    canAssignProjectTask(hasPermission);
  const canComment =
    !permissionsLoading && canCommentOnProjectTask(hasPermission);
  const canReportIssue =
    !permissionsLoading && canReportProjectIssue(hasPermission);
  const showLinkManagement =
    !permissionsLoading &&
    !workspaceMode &&
    canManageProjectLinks(hasPermission);

  return (
    <div className="space-y-6">
      {flashMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {flashMessage}
        </div>
      ) : null}
      {deleteError ? (
        <ErrorState title="Unable to delete task" message={deleteError} />
      ) : null}

      <PageHeader
        description={`Task ${task.task_code}. Overview of assignment, schedule, checklist, comments, attachments, and history.`}
        eyebrow="Project tasks"
        title={task.name}
      >
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/projects/${projectId}/tasks`}
          >
            Back to tasks
          </Link>
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/projects/${projectId}`}
          >
            Project detail
          </Link>
          {canFullEdit ? (
            <Link
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              href={`/projects/${projectId}/tasks/${task.id}/edit`}
            >
              Edit task
            </Link>
          ) : null}
          {canDelete ? (
            <button
              className="inline-flex items-center rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={deleteMutation.isPending}
              onClick={() => {
                const confirmed = window.confirm(
                  `Delete task ${task.task_code}? This soft-deletes the task record.`,
                );
                if (!confirmed) {
                  return;
                }
                setDeleteError(null);
                void deleteMutation
                  .mutateAsync(task.id)
                  .then(() => {
                    router.replace(`/projects/${projectId}/tasks`);
                    router.refresh();
                  })
                  .catch((error: unknown) => {
                    setDeleteError(
                      formatProjectTaskError(
                        error,
                        "Task could not be deleted.",
                      ),
                    );
                  });
              }}
              type="button"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </button>
          ) : null}
        </div>
      </PageHeader>

      <SectionCard
        description="Status, priority, and progress are read from the task record. Checklist completion does not auto-update progress."
        title="Overview"
      >
        <div className="flex flex-wrap items-center gap-3">
          <ProjectTaskStatusBadge status={task.status} />
          <ProjectTaskPriorityBadge priority={task.priority} />
          <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            {formatProjectTaskProgress(task.progress_percentage)} progress
          </span>
          {task.is_milestone ? (
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-800">
              Milestone
            </span>
          ) : null}
          {task.is_delayed ? (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
              {formatDelayLabel({
                isDelayed: true,
                delayDays: task.delay_days,
              })}
            </span>
          ) : null}
          {!task.is_dependency_ready ? (
            <span className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-900">
              Dependency blocked
            </span>
          ) : null}
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">
          {task.description?.trim() || "No description provided."}
        </p>
      </SectionCard>

      <ProjectTaskExecutionPanel
        canReportIssue={canReportIssue}
        canUpdate={canUpdate}
        isAssignedToCurrentUser={isAssignedToCurrentUser}
        projectId={projectId}
        task={task}
      />

      <SectionCard title="Task information">
        <MetadataList
          items={[
            { label: "Task code", value: task.task_code },
            {
              label: "Person in charge",
              value: formatPersonLabel(task.person_in_charge_email),
            },
            {
              label: task.is_milestone ? "Milestone date" : "Planned schedule",
              value: formatTaskPlannedScheduleLabel({
                planned_start: task.planned_start,
                planned_end: task.planned_end,
                is_milestone: task.is_milestone,
              }),
            },
            ...(task.is_milestone || isTaskScheduleUnscheduled(task)
              ? []
              : [
                  {
                    label: "Planned start",
                    value: formatProjectDate(task.planned_start),
                  },
                  {
                    label: "Planned end",
                    value: formatProjectDate(task.planned_end),
                  },
                ]),
            {
              label: "Actual execution",
              value: formatActualExecutionRangeLabel({
                actual_start: task.actual_start,
                actual_end: task.actual_end,
                status: task.status,
              }),
            },
            {
              label: "Actual start",
              value: task.actual_start
                ? formatProjectDate(task.actual_start)
                : "Not started",
            },
            {
              label: "Actual end",
              value: task.actual_end
                ? formatProjectDate(task.actual_end)
                : task.actual_start &&
                    task.status !== "completed" &&
                    task.status !== "cancelled"
                  ? "Still in progress"
                  : "Not completed",
            },
            {
              label: "Start variance",
              value: formatVarianceDaysLabel(task.start_variance_days, "start"),
            },
            {
              label: "Completion variance",
              value: formatVarianceDaysLabel(
                task.completion_variance_days,
                "completion",
              ),
            },
            {
              label: "Schedule status",
              value: formatScheduleStatusSummary(task),
            },
            { label: "Sequence", value: String(task.sequence) },
            {
              label: "Created",
              value: formatProjectDateTime(task.created_at),
            },
            {
              label: "Updated",
              value: formatProjectDateTime(task.updated_at),
            },
          ]}
        />
      </SectionCard>

      <SectionCard
        description="Assign a person in charge from active project members or the project manager."
        title="Assignment"
      >
        {assignError ? (
          <ErrorState title="Unable to assign task" message={assignError} />
        ) : null}
        {canAssign ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <SelectField
                id="task-assign-pic"
                label="Person in charge"
                onChange={(event) => setSelectedPic(event.target.value)}
                options={picOptions}
                placeholder="Select PIC"
                value={selectedPic}
              />
            </div>
            <button
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              disabled={assignMutation.isPending || !selectedPic}
              onClick={() => {
                setAssignError(null);
                void assignMutation
                  .mutateAsync({ person_in_charge: selectedPic })
                  .catch((error: unknown) => {
                    setAssignError(
                      formatProjectTaskError(
                        error,
                        "Task could not be assigned.",
                      ),
                    );
                  });
              }}
              type="button"
            >
              {assignMutation.isPending ? "Assigning…" : "Assign PIC"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Current PIC: {formatPersonLabel(task.person_in_charge_email)}
          </p>
        )}
        {picOptions.length === 0 ? (
          <EmptyState
            title="No assignable members"
            message="Add project members on the project detail page before assigning a PIC."
            action={
              <Link
                className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href={`/projects/${projectId}`}
              >
                Open project members
              </Link>
            }
          />
        ) : null}
      </SectionCard>

      <SectionCard
        description="Finish-to-start predecessors must be completed before this task can move into active statuses."
        title="Dependencies & readiness"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/projects/${projectId}/gantt`}
          >
            Open project Gantt
          </Link>
        </div>
        <p className="text-sm text-slate-700">
          {formatDependencyReadinessMessage(
            readinessQuery.data ?? {
              is_dependency_ready: task.is_dependency_ready,
              blocking_predecessor_count: task.blocking_predecessor_count,
              blocking_predecessors: [],
              predecessor_count: task.predecessor_count,
              successor_count: task.successor_count,
            },
          )}
        </p>
        {readinessQuery.data?.blocking_predecessors?.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {readinessQuery.data.blocking_predecessors.map((pred) => (
              <li key={pred.id}>
                <Link
                  className="font-medium text-blue-800 hover:underline"
                  href={`/projects/${projectId}/tasks/${pred.id}`}
                >
                  {pred.task_code}
                </Link>{" "}
                — {pred.name} ({formatProjectLabel(pred.status)})
              </li>
            ))}
          </ul>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2">
          <DependencyLinkList
            emptyMessage="No predecessors."
            items={predecessorsQuery.data ?? []}
            loading={predecessorsQuery.isPending}
            mode="predecessor"
            projectId={projectId}
            title="Predecessors"
          />
          <DependencyLinkList
            emptyMessage="No successors."
            items={successorsQuery.data ?? []}
            loading={successorsQuery.isPending}
            mode="successor"
            projectId={projectId}
            title="Successors"
          />
        </div>
      </SectionCard>

      <SectionCard
        description="Operational records linked specifically to this task."
        title="Linked records"
      >
        {showLinkManagement ? (
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              href={`/projects/${projectId}/links`}
            >
              Manage linked records
            </Link>
          </div>
        ) : null}
        {linksQuery.isPending ? (
          <div
            aria-label="Loading linked records"
            className="h-16 animate-pulse rounded-lg border border-slate-200 bg-slate-100"
            role="status"
          />
        ) : null}
        {!linksQuery.isPending && taskLinks.length === 0 ? (
          <EmptyState
            message="No operational links reference this task yet."
            title="No linked records for this task"
          />
        ) : null}
        {taskLinks.length > 0 ? (
          <ul className="space-y-3">
            {taskLinks.map((link: ProjectOperationalLink) => {
              const href = getProjectLinkTargetHref(link);
              const accessLabel = formatProjectLinkAccessibilityLabel(
                link.target_accessible,
              );
              return (
                <li
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  key={link.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {formatProjectLinkTypeLabel(link.link_type)} ·{" "}
                        {formatProjectLinkRelationshipLabel(link.relationship)}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {href ? (
                          <Link
                            className="text-blue-800 hover:underline"
                            href={href}
                          >
                            {formatProjectLinkTargetLabel(link)}
                          </Link>
                        ) : (
                          formatProjectLinkTargetLabel(link)
                        )}
                      </p>
                    </div>
                    <span
                      aria-label={`Access: ${accessLabel}`}
                      className={
                        link.target_accessible
                          ? "rounded-full border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                          : "rounded-full border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900"
                      }
                    >
                      {accessLabel}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </SectionCard>

      <ProjectTaskChecklist
        canEdit={canEditChecklist}
        items={task.checklist_items ?? []}
        projectId={projectId}
        taskId={task.id}
      />

      <ProjectTaskComments
        canComment={canComment}
        comments={task.comments ?? []}
        projectId={projectId}
        taskId={task.id}
      />

      <ProjectTaskAttachments
        taskId={task.id}
        taskStatus={task.status}
      />

      <SectionCard
        description="Task-related entries filtered from project history."
        title="History"
      >
        {historyQuery.isPending ? (
          <div
            className="h-24 animate-pulse rounded-lg border border-slate-200 bg-slate-100"
            role="status"
          />
        ) : (
          <TaskHistorySummary entries={taskHistory} />
        )}
      </SectionCard>
    </div>
  );
}
