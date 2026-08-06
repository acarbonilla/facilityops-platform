"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import {
  useAssignProjectTask,
  useDeleteProjectTask,
  useProjectDetail,
  useProjectHistory,
  useProjectMembers,
  useProjectTaskDetail,
} from "@/hooks/use-projects";
import { usePermissions } from "@/hooks/use-permissions";
import {
  formatPersonLabel,
  formatProjectDate,
  formatProjectDateTime,
  formatProjectLabel,
} from "@/lib/projects/display";
import {
  canAssignProjectTask,
  canCommentOnProjectTask,
  canDeleteProjectTask,
  canUpdateProjectTask,
  formatProjectTaskError,
  formatProjectTaskProgress,
  isTaskRelatedHistoryAction,
} from "@/lib/projects/tasks-display";
import { readProjectTaskFormFlash } from "@/lib/projects/tasks-form";
import type {
  ProjectHistory,
  ProjectMember,
} from "@/types/projects";

import { ProjectTaskAttachments } from "./project-task-attachments";
import { ProjectTaskChecklist } from "./project-task-checklist";
import { ProjectTaskComments } from "./project-task-comments";
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

export function ProjectTaskDetailScreen({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}) {
  const router = useRouter();
  const { hasPermission, permissionsLoading } = usePermissions();
  const projectQuery = useProjectDetail(projectId);
  const detailQuery = useProjectTaskDetail(projectId, taskId);
  const membersQuery = useProjectMembers(projectId);
  const historyQuery = useProjectHistory(projectId);
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
  const canEdit = !permissionsLoading && canUpdateProjectTask(hasPermission);
  const canDelete = !permissionsLoading && canDeleteProjectTask(hasPermission);
  const canAssign = !permissionsLoading && canAssignProjectTask(hasPermission);
  const canComment =
    !permissionsLoading && canCommentOnProjectTask(hasPermission);

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
          {canEdit ? (
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
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">
          {task.description?.trim() || "No description provided."}
        </p>
      </SectionCard>

      <SectionCard title="Task information">
        <MetadataList
          items={[
            { label: "Task code", value: task.task_code },
            {
              label: "Person in charge",
              value: formatPersonLabel(task.person_in_charge_email),
            },
            {
              label: "Planned start",
              value: formatProjectDate(task.planned_start),
            },
            {
              label: "Planned end",
              value: formatProjectDate(task.planned_end),
            },
            {
              label: "Actual start",
              value: formatProjectDate(task.actual_start),
            },
            {
              label: "Actual end",
              value: formatProjectDate(task.actual_end),
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

      <ProjectTaskChecklist
        canEdit={canEdit}
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
