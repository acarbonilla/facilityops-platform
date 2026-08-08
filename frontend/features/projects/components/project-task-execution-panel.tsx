"use client";

import { useMemo, useState } from "react";

import { ErrorState } from "@/components/common/error-state";
import {
  useCompleteProjectTask,
  usePauseProjectTask,
  useReportProjectTaskBlocker,
  useResumeProjectTask,
  useStartProjectTask,
  useUpdateProjectTaskProgress,
} from "@/hooks/use-projects";
import {
  clampTechnicianProgressInput,
  describeProgressRule,
  formatTechnicianTaskStatusLabel,
  getAvailableTechnicianActions,
} from "@/lib/projects/execution";
import { formatProjectTaskError } from "@/lib/projects/tasks-display";
import type { ProjectTaskDetail } from "@/types/projects";

type Props = {
  projectId: string;
  task: ProjectTaskDetail;
  isAssignedToCurrentUser: boolean;
  canUpdate: boolean;
  canReportIssue: boolean;
};

export function ProjectTaskExecutionPanel({
  projectId,
  task,
  isAssignedToCurrentUser,
  canUpdate,
  canReportIssue,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [progressInput, setProgressInput] = useState(
    String(Math.round(Number(task.progress_percentage) || 0)),
  );
  const [blockerOpen, setBlockerOpen] = useState(false);
  const [blockerTitle, setBlockerTitle] = useState("");
  const [blockerDescription, setBlockerDescription] = useState("");
  const [blockerSeverity, setBlockerSeverity] = useState("high");

  const startMutation = useStartProjectTask(projectId, task.id);
  const pauseMutation = usePauseProjectTask(projectId, task.id);
  const resumeMutation = useResumeProjectTask(projectId, task.id);
  const completeMutation = useCompleteProjectTask(projectId, task.id);
  const progressMutation = useUpdateProjectTaskProgress(projectId, task.id);
  const blockerMutation = useReportProjectTaskBlocker(projectId, task.id);

  const actions = useMemo(
    () =>
      getAvailableTechnicianActions(task.status, {
        isAssignedToCurrentUser,
        canUpdate,
        isDependencyReady: Boolean(task.is_dependency_ready),
      }),
    [
      task.status,
      task.is_dependency_ready,
      isAssignedToCurrentUser,
      canUpdate,
    ],
  );

  if (!isAssignedToCurrentUser || !canUpdate) {
    return null;
  }

  const busy =
    startMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    completeMutation.isPending ||
    progressMutation.isPending ||
    blockerMutation.isPending;

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (err: unknown) {
      setError(formatProjectTaskError(err, "Task execution failed."));
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Task execution
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Field workflow for your assigned task. Status:{" "}
          <span className="font-medium text-slate-900">
            {formatTechnicianTaskStatusLabel(task.status)}
          </span>
          . {describeProgressRule(task.status)}
        </p>
      </div>

      {error ? <ErrorState title="Unable to update task" message={error} /> : null}

      {!task.is_dependency_ready ? (
        <p
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="status"
        >
          Predecessors are incomplete. Start and resume stay blocked until
          dependencies are ready.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {actions.includes("start") ? (
          <button
            className="min-h-11 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            disabled={busy}
            onClick={() => void run(() => startMutation.mutateAsync())}
            type="button"
          >
            Start work
          </button>
        ) : null}
        {actions.includes("pause") ? (
          <button
            className="min-h-11 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            disabled={busy}
            onClick={() => void run(() => pauseMutation.mutateAsync())}
            type="button"
          >
            Pause
          </button>
        ) : null}
        {actions.includes("resume") ? (
          <button
            className="min-h-11 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            disabled={busy}
            onClick={() => void run(() => resumeMutation.mutateAsync())}
            type="button"
          >
            Resume
          </button>
        ) : null}
        {actions.includes("complete") ? (
          <button
            className="min-h-11 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
            disabled={busy}
            onClick={() => {
              const confirmed = window.confirm(
                `Mark task ${task.task_code} complete at 100%?`,
              );
              if (!confirmed) {
                return;
              }
              void run(() => completeMutation.mutateAsync(undefined));
            }}
            type="button"
          >
            Complete task
          </button>
        ) : null}
        {actions.includes("report_blocker") && canReportIssue ? (
          <button
            className="min-h-11 rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50 disabled:opacity-60"
            disabled={busy}
            onClick={() => setBlockerOpen((open) => !open)}
            type="button"
          >
            Report blocker
          </button>
        ) : null}
      </div>

      {actions.includes("progress") ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <label
            className="block text-sm font-medium text-slate-800"
            htmlFor={`task-progress-${task.id}`}
          >
            Progress percentage
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={clampTechnicianProgressInput(progressInput)}
              className="w-full accent-blue-700"
              id={`task-progress-${task.id}`}
              max={100}
              min={0}
              onChange={(event) => setProgressInput(event.target.value)}
              step={1}
              type="range"
              value={clampTechnicianProgressInput(progressInput)}
            />
            <div className="flex items-center gap-2">
              <input
                aria-label="Progress percent value"
                className="w-20 rounded-md border border-slate-300 px-2 py-2 text-sm"
                inputMode="numeric"
                onChange={(event) => setProgressInput(event.target.value)}
                value={progressInput}
              />
              <span className="text-sm text-slate-600" aria-hidden="true">
                %
              </span>
              <button
                className="min-h-11 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    progressMutation.mutateAsync({
                      progress_percentage:
                        clampTechnicianProgressInput(progressInput),
                    }),
                  )
                }
                type="button"
              >
                Save progress
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {blockerOpen ? (
        <form
          className="space-y-3 rounded-lg border border-rose-200 bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await blockerMutation.mutateAsync({
                title: blockerTitle.trim(),
                description: blockerDescription.trim(),
                severity: blockerSeverity,
              });
              setBlockerTitle("");
              setBlockerDescription("");
              setBlockerOpen(false);
            });
          }}
        >
          <h3 className="text-sm font-semibold text-slate-900">Report blocker</h3>
          <p className="text-xs text-slate-600">
            Creates a Project Issue. Does not create an FM Ticket.
          </p>
          <label className="block text-sm font-medium text-slate-800" htmlFor="blocker-title">
            Title
          </label>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            id="blocker-title"
            onChange={(event) => setBlockerTitle(event.target.value)}
            required
            value={blockerTitle}
          />
          <label
            className="block text-sm font-medium text-slate-800"
            htmlFor="blocker-description"
          >
            Description
          </label>
          <textarea
            className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            id="blocker-description"
            onChange={(event) => setBlockerDescription(event.target.value)}
            value={blockerDescription}
          />
          <label
            className="block text-sm font-medium text-slate-800"
            htmlFor="blocker-severity"
          >
            Severity
          </label>
          <select
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            id="blocker-severity"
            onChange={(event) => setBlockerSeverity(event.target.value)}
            value={blockerSeverity}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <div className="flex flex-wrap gap-2">
            <button
              className="min-h-11 rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60"
              disabled={busy || !blockerTitle.trim()}
              type="submit"
            >
              Submit blocker
            </button>
            <button
              className="min-h-11 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setBlockerOpen(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
