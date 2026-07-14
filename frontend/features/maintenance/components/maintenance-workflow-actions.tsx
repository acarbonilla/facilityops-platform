"use client";

import { useMemo, useState } from "react";

import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { SwitchField } from "@/components/common/switch-field";
import { useCancelWorkOrder } from "@/hooks/use-cancel-work-order";
import { useCompleteWorkOrder } from "@/hooks/use-complete-work-order";
import { useHoldWorkOrder } from "@/hooks/use-hold-work-order";
import { usePermissions } from "@/hooks/use-permissions";
import { useReopenWorkOrder } from "@/hooks/use-reopen-work-order";
import { useResumeWorkOrder } from "@/hooks/use-resume-work-order";
import { useStartWorkOrder } from "@/hooks/use-start-work-order";
import { useSubmitWorkOrder } from "@/hooks/use-submit-work-order";
import { formatDateTime, formatMaintenanceLabel } from "@/lib/maintenance/display";
import { getSourceTicketInvalidationId } from "@/lib/maintenance/ticket-sync";
import { getMaintenanceWorkflowActions } from "@/lib/maintenance/workflow";
import type {
  MaintenanceCancelPayload,
  MaintenanceCompletePayload,
  MaintenanceHoldPayload,
  MaintenanceReopenPayload,
  MaintenanceSimpleWorkflowPayload,
  MaintenanceStatusHistory,
  MaintenanceWorkOrderDetail,
  MaintenanceWorkflowAction,
} from "@/types/maintenance";

import { MaintenanceStatusBadge } from "./maintenance-status-badge";
import { SectionCard } from "./maintenance-shared";

type WorkflowDialogKey =
  | "submit"
  | "start"
  | "hold"
  | "resume"
  | "complete"
  | "cancel"
  | "reopen"
  | null;

function MaintenanceWorkflowConfirmDialog({
  children,
  confirmLabel,
  description,
  isBusy,
  onClose,
  onConfirm,
  title,
}: {
  children?: React.ReactNode;
  confirmLabel: string;
  description: string;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div
        aria-labelledby="maintenance-workflow-dialog-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <div>
          <h3
            className="text-xl font-semibold tracking-tight text-slate-950"
            id="maintenance-workflow-dialog-title"
          >
            {title}
          </h3>
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        </div>
        {children ? <div className="mt-5 space-y-4">{children}</div> : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
          <button
            className="inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy}
            onClick={() => void onConfirm()}
            type="button"
          >
            {isBusy ? "Saving..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MaintenanceHoldDialog({
  isBusy,
  onClose,
  onConfirm,
}: {
  isBusy: boolean;
  onClose: () => void;
  onConfirm: (payload: MaintenanceHoldPayload) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <MaintenanceWorkflowConfirmDialog
      confirmLabel="Place on hold"
      description="Hold requires a reason so the workflow history remains auditable."
      isBusy={isBusy}
      onClose={onClose}
      onConfirm={async () => {
        await onConfirm({
          reason: reason.trim(),
          notes: notes.trim(),
        });
      }}
      title="Hold Work Order"
    >
      <FormField
        description="Required hold reason."
        htmlFor="maintenance-hold-reason"
        label="Reason"
      >
        <input
          className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          id="maintenance-hold-reason"
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
      </FormField>
      <FormField
        description="Optional supporting notes."
        htmlFor="maintenance-hold-notes"
        label="Notes"
      >
        <textarea
          className="block min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          id="maintenance-hold-notes"
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
      </FormField>
    </MaintenanceWorkflowConfirmDialog>
  );
}

export function MaintenanceCompleteDialog({
  isBusy,
  onClose,
  onConfirm,
}: {
  isBusy: boolean;
  onClose: () => void;
  onConfirm: (payload: MaintenanceCompletePayload) => void | Promise<void>;
}) {
  const [completionNotes, setCompletionNotes] = useState("");
  const [actualHours, setActualHours] = useState("");
  const [completedAt, setCompletedAt] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [downtimeMinutes, setDowntimeMinutes] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(false);

  return (
    <MaintenanceWorkflowConfirmDialog
      confirmLabel="Complete work order"
      description="Completion requires notes, actual hours, and any remaining completion metadata your team wants recorded."
      isBusy={isBusy}
      onClose={onClose}
      onConfirm={async () => {
        await onConfirm({
          completion_notes: completionNotes.trim(),
          actual_hours: actualHours.trim(),
          completed_at: completedAt ? new Date(completedAt).toISOString() : undefined,
          resolution_summary: resolutionSummary.trim(),
          downtime_minutes: downtimeMinutes ? Number(downtimeMinutes) : undefined,
          follow_up_required: followUpRequired,
        });
      }}
      title="Complete Work Order"
    >
      <FormField
        description="Required completion notes."
        htmlFor="maintenance-complete-notes"
        label="Completion notes"
      >
        <textarea
          className="block min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          id="maintenance-complete-notes"
          onChange={(event) => setCompletionNotes(event.target.value)}
          value={completionNotes}
        />
      </FormField>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          description="Required actual hours."
          htmlFor="maintenance-complete-hours"
          label="Actual hours"
        >
          <input
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            id="maintenance-complete-hours"
            onChange={(event) => setActualHours(event.target.value)}
            type="number"
            value={actualHours}
          />
        </FormField>
        <FormField
          description="Optional completion timestamp. Defaults to now."
          htmlFor="maintenance-complete-at"
          label="Completed at"
        >
          <input
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            id="maintenance-complete-at"
            onChange={(event) => setCompletedAt(event.target.value)}
            type="datetime-local"
            value={completedAt}
          />
        </FormField>
        <FormField
          description="Optional resolution summary."
          htmlFor="maintenance-resolution-summary"
          label="Resolution summary"
        >
          <input
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            id="maintenance-resolution-summary"
            onChange={(event) => setResolutionSummary(event.target.value)}
            value={resolutionSummary}
          />
        </FormField>
        <FormField
          description="Optional downtime in minutes."
          htmlFor="maintenance-downtime-minutes"
          label="Downtime minutes"
        >
          <input
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            id="maintenance-downtime-minutes"
            onChange={(event) => setDowntimeMinutes(event.target.value)}
            type="number"
            value={downtimeMinutes}
          />
        </FormField>
      </div>
      <SwitchField
        checked={followUpRequired}
        description="Flag whether follow-up work is still needed."
        label="Follow up required"
        onChange={(event) => setFollowUpRequired(event.target.checked)}
      />
    </MaintenanceWorkflowConfirmDialog>
  );
}

export function MaintenanceCancelDialog({
  isBusy,
  onClose,
  onConfirm,
}: {
  isBusy: boolean;
  onClose: () => void;
  onConfirm: (payload: MaintenanceCancelPayload) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <MaintenanceWorkflowConfirmDialog
      confirmLabel="Cancel work order"
      description="Cancellation requires a reason so the maintenance audit trail stays explicit."
      isBusy={isBusy}
      onClose={onClose}
      onConfirm={async () => {
        await onConfirm({
          reason: reason.trim(),
          notes: notes.trim(),
        });
      }}
      title="Cancel Work Order"
    >
      <FormField
        description="Required cancellation reason."
        htmlFor="maintenance-cancel-reason"
        label="Reason"
      >
        <input
          className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          id="maintenance-cancel-reason"
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
      </FormField>
      <FormField
        description="Optional cancellation notes."
        htmlFor="maintenance-cancel-notes"
        label="Notes"
      >
        <textarea
          className="block min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          id="maintenance-cancel-notes"
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
      </FormField>
    </MaintenanceWorkflowConfirmDialog>
  );
}

export function MaintenanceReopenDialog({
  isBusy,
  onClose,
  onConfirm,
}: {
  isBusy: boolean;
  onClose: () => void;
  onConfirm: (payload: MaintenanceReopenPayload) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <MaintenanceWorkflowConfirmDialog
      confirmLabel="Reopen work order"
      description="Reopening clears the work order back into an active workflow cycle and requires a reason."
      isBusy={isBusy}
      onClose={onClose}
      onConfirm={async () => {
        await onConfirm({
          reason: reason.trim(),
          notes: notes.trim(),
        });
      }}
      title="Reopen Work Order"
    >
      <FormField
        description="Required reopen reason."
        htmlFor="maintenance-reopen-reason"
        label="Reason"
      >
        <input
          className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          id="maintenance-reopen-reason"
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
      </FormField>
      <FormField
        description="Optional notes for the new workflow cycle."
        htmlFor="maintenance-reopen-notes"
        label="Notes"
      >
        <textarea
          className="block min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          id="maintenance-reopen-notes"
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
      </FormField>
    </MaintenanceWorkflowConfirmDialog>
  );
}

function findWorkflowError(errors: Array<unknown>) {
  return errors.find((error) => Boolean(error)) ?? null;
}

export function MaintenanceWorkflowActions({
  workOrder,
}: {
  workOrder: MaintenanceWorkOrderDetail;
}) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const [activeDialog, setActiveDialog] = useState<WorkflowDialogKey>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sourceTicketId = getSourceTicketInvalidationId(workOrder.source_ticket);
  const submitMutation = useSubmitWorkOrder(workOrder.id);
  const startMutation = useStartWorkOrder(workOrder.id, sourceTicketId);
  const holdMutation = useHoldWorkOrder(workOrder.id, sourceTicketId);
  const resumeMutation = useResumeWorkOrder(workOrder.id, sourceTicketId);
  const completeMutation = useCompleteWorkOrder(workOrder.id, sourceTicketId);
  const cancelMutation = useCancelWorkOrder(workOrder.id, sourceTicketId);
  const reopenMutation = useReopenWorkOrder(workOrder.id, sourceTicketId);

  const allActions = useMemo(
    () => getMaintenanceWorkflowActions(workOrder.status),
    [workOrder.status],
  );
  const canManage = hasPermission("maintenance.manage");
  const availableActions = useMemo(
    () =>
      allActions.filter(
        (action) =>
          !permissionsLoading &&
          (canManage ||
            hasPermission(action.permission) ||
            hasPermission(
              action.permission.replace("maintenance.", "maintenance.work_order."),
            )),
      ),
    [allActions, canManage, hasPermission, permissionsLoading],
  );
  const workflowError = findWorkflowError([
    submitMutation.error,
    startMutation.error,
    holdMutation.error,
    resumeMutation.error,
    completeMutation.error,
    cancelMutation.error,
    reopenMutation.error,
  ]);
  const isBusy =
    submitMutation.isPending ||
    startMutation.isPending ||
    holdMutation.isPending ||
    resumeMutation.isPending ||
    completeMutation.isPending ||
    cancelMutation.isPending ||
    reopenMutation.isPending;

  async function handleSimpleAction(
    action: MaintenanceWorkflowAction,
    payload?: MaintenanceSimpleWorkflowPayload,
  ) {
    setSuccessMessage(null);

    if (action.key === "submit") {
      await submitMutation.mutateAsync(payload);
    } else if (action.key === "start") {
      await startMutation.mutateAsync(payload);
    } else if (action.key === "resume") {
      await resumeMutation.mutateAsync(payload);
    }

    setSuccessMessage(`${action.label} completed successfully.`);
    setActiveDialog(null);
  }

  return (
    <SectionCard
      title="Workflow Actions"
      description="Available actions depend on the current status and maintenance workflow permissions. All actions remain enforced by the backend even if a user calls the API directly."
    >
      {workflowError ? (
        <ErrorState
          message={
            workflowError instanceof Error
              ? workflowError.message
              : "The maintenance workflow action could not be completed."
          }
          title="Workflow action failed"
        />
      ) : null}

      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {successMessage}
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700">Current status</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <MaintenanceStatusBadge status={workOrder.status} />
          <span className="text-sm text-slate-600">
            {formatMaintenanceLabel(workOrder.status)}
          </span>
        </div>
      </div>

      {availableActions.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          No workflow actions are currently available for this work order and account.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {availableActions.map((action) => (
            <button
              className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-blue-300 hover:bg-blue-50"
              key={action.key}
              onClick={() => {
                setSuccessMessage(null);
                setActiveDialog(action.key);
              }}
              type="button"
            >
              <p className="font-semibold text-slate-950">{action.label}</p>
              <p className="mt-1 text-sm text-slate-600">{action.description}</p>
            </button>
          ))}
        </div>
      )}

      {activeDialog === "submit" ? (
        <MaintenanceWorkflowConfirmDialog
          confirmLabel="Submit work order"
          description="Submit this draft work order into the active maintenance queue."
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onConfirm={async () => {
            await handleSimpleAction(
              availableActions.find((action) => action.key === "submit")!,
            );
          }}
          title="Submit Work Order"
        />
      ) : null}

      {activeDialog === "start" ? (
        <MaintenanceWorkflowConfirmDialog
          confirmLabel="Start work order"
          description="Move this assigned work order into active execution."
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onConfirm={async () => {
            await handleSimpleAction(
              availableActions.find((action) => action.key === "start")!,
            );
          }}
          title="Start Work Order"
        />
      ) : null}

      {activeDialog === "hold" ? (
        <MaintenanceHoldDialog
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onConfirm={async (payload) => {
            setSuccessMessage(null);
            await holdMutation.mutateAsync(payload);
            setSuccessMessage("Work order placed on hold successfully.");
            setActiveDialog(null);
          }}
        />
      ) : null}

      {activeDialog === "resume" ? (
        <MaintenanceWorkflowConfirmDialog
          confirmLabel="Resume work order"
          description="Resume this on-hold work order and return it to active execution."
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onConfirm={async () => {
            await handleSimpleAction(
              availableActions.find((action) => action.key === "resume")!,
            );
          }}
          title="Resume Work Order"
        />
      ) : null}

      {activeDialog === "complete" ? (
        <MaintenanceCompleteDialog
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onConfirm={async (payload) => {
            setSuccessMessage(null);
            await completeMutation.mutateAsync(payload);
            setSuccessMessage("Work order completed successfully.");
            setActiveDialog(null);
          }}
        />
      ) : null}

      {activeDialog === "cancel" ? (
        <MaintenanceCancelDialog
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onConfirm={async (payload) => {
            setSuccessMessage(null);
            await cancelMutation.mutateAsync(payload);
            setSuccessMessage("Work order cancelled successfully.");
            setActiveDialog(null);
          }}
        />
      ) : null}

      {activeDialog === "reopen" ? (
        <MaintenanceReopenDialog
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onConfirm={async (payload) => {
            setSuccessMessage(null);
            await reopenMutation.mutateAsync(payload);
            setSuccessMessage("Work order reopened successfully.");
            setActiveDialog(null);
          }}
        />
      ) : null}
    </SectionCard>
  );
}

export function MaintenanceStatusTimeline({
  statusHistory,
}: {
  statusHistory: MaintenanceStatusHistory[];
}) {
  const orderedHistory = [...statusHistory].sort(
    (left, right) =>
      new Date(right.changed_at).getTime() - new Date(left.changed_at).getTime(),
  );

  return (
    <SectionCard
      title="Status Timeline"
      description="Chronological workflow transitions recorded by the backend status history model."
    >
      {orderedHistory.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          No workflow transitions have been recorded for this work order yet.
        </div>
      ) : (
        <ol className="space-y-4">
          {orderedHistory.map((entry) => (
            <li
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              key={entry.id}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-950">
                      {formatMaintenanceLabel(entry.action)}
                    </span>
                    <MaintenanceStatusBadge status={entry.to_status} />
                  </div>
                  <p className="text-sm text-slate-700">
                    {formatMaintenanceLabel(entry.from_status, "None")}
                    {" -> "}
                    {formatMaintenanceLabel(entry.to_status)}
                  </p>
                  {entry.reason ? (
                    <p className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">Reason:</span>
                      {" "}
                      {entry.reason}
                    </p>
                  ) : null}
                  {entry.note ? (
                    <p className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">Notes:</span>
                      {" "}
                      {entry.note}
                    </p>
                  ) : null}
                </div>
                <div className="text-sm text-slate-500">
                  <p>{entry.changed_by_email || "System"}</p>
                  <p className="mt-1">{formatDateTime(entry.changed_at)}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
