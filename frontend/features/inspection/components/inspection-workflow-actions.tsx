"use client";

import { useMemo, useState } from "react";

import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { UserDirectoryPicker } from "@/components/common/user-directory-picker";
import { useAssignInspection } from "@/hooks/use-assign-inspection";
import { useCancelInspection } from "@/hooks/use-cancel-inspection";
import { useCompleteInspection } from "@/hooks/use-complete-inspection";
import { usePermissions } from "@/hooks/use-permissions";
import { useReopenInspection } from "@/hooks/use-reopen-inspection";
import { useStartInspection } from "@/hooks/use-start-inspection";
import { useVerifyInspection } from "@/hooks/use-verify-inspection";
import {
  buildInspectionAssignPayload,
  getInspectionWorkflowActions,
} from "@/lib/inspection/workflow";
import { createUserDirectoryEmailFallback } from "@/lib/users/directory";
import type {
  InspectionAssignPayload,
  InspectionCancelPayload,
  InspectionDetail,
  InspectionReopenPayload,
  InspectionSimpleWorkflowPayload,
  InspectionStatusHistory,
  InspectionWorkflowAction,
} from "@/types/inspection";

import { InspectionStatusBadge } from "./inspection-status-badge";

type WorkflowDialogKey = InspectionWorkflowAction["key"] | null;

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatLabel(value?: string | null, fallback = "Not recorded") {
  if (!value) {
    return fallback;
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function findWorkflowError(errors: Array<unknown>) {
  return errors.find((error) => Boolean(error)) ?? null;
}

function WorkflowSectionCard({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

function InspectionWorkflowConfirmDialog({
  children,
  confirmLabel,
  description,
  error,
  isBusy,
  onClose,
  onConfirm,
  title,
}: {
  children?: React.ReactNode;
  confirmLabel: string;
  description: string;
  error?: string | null;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div
        aria-labelledby="inspection-workflow-dialog-title"
        aria-modal="true"
        className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <div>
          <h3
            className="text-xl font-semibold tracking-tight text-slate-950"
            id="inspection-workflow-dialog-title"
          >
            {title}
          </h3>
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        </div>
        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            {error}
          </p>
        ) : null}
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

function InspectionSimpleActionDialog({
  confirmLabel,
  description,
  isBusy,
  onClose,
  onConfirm,
  title,
}: {
  confirmLabel: string;
  description: string;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: (payload: InspectionSimpleWorkflowPayload) => void | Promise<void>;
  title: string;
}) {
  const [note, setNote] = useState("");

  return (
    <InspectionWorkflowConfirmDialog
      confirmLabel={confirmLabel}
      description={description}
      isBusy={isBusy}
      onClose={onClose}
      onConfirm={async () => {
        await onConfirm({ note: note.trim() || undefined });
      }}
      title={title}
    >
      <FormField
        description="Optional workflow note recorded in backend history."
        htmlFor="inspection-workflow-note"
        label="Note"
      >
        <textarea
          className="block min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          id="inspection-workflow-note"
          onChange={(event) => setNote(event.target.value)}
          value={note}
        />
      </FormField>
    </InspectionWorkflowConfirmDialog>
  );
}

function InspectionAssignDialog({
  inspection,
  isBusy,
  onClose,
  onConfirm,
  permissionEnabled,
}: {
  inspection: InspectionDetail;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: (payload: InspectionAssignPayload) => void | Promise<void>;
  permissionEnabled: boolean;
}) {
  const [inspector, setInspector] = useState(inspection.inspector ?? "");
  const [supervisor, setSupervisor] = useState(inspection.supervisor ?? "");
  const [note, setNote] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const inspectorFallback = useMemo(
    () =>
      createUserDirectoryEmailFallback(
        inspection.inspector,
        inspection.inspector_email,
      ),
    [inspection.inspector, inspection.inspector_email],
  );
  const supervisorFallback = useMemo(
    () =>
      createUserDirectoryEmailFallback(
        inspection.supervisor,
        inspection.supervisor_email,
      ),
    [inspection.supervisor, inspection.supervisor_email],
  );

  return (
    <InspectionWorkflowConfirmDialog
      confirmLabel="Assign inspection"
      description="Assign an inspector and/or supervisor from the active user directory."
      error={validationError}
      isBusy={isBusy}
      onClose={onClose}
      onConfirm={async () => {
        const payload = buildInspectionAssignPayload(inspector, supervisor, note);
        if (!payload) {
          setValidationError("At least one of inspector or supervisor is required.");
          return;
        }
        await onConfirm(payload);
      }}
      title="Assign Inspection"
    >
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>Current inspector: {inspection.inspector_email || "Not assigned"}</p>
        <p className="mt-1">Current supervisor: {inspection.supervisor_email || "Not assigned"}</p>
      </div>
      <UserDirectoryPicker
        description="Optional inspector assignment."
        disabled={isBusy}
        label="Inspector"
        onChange={(value) => {
          setValidationError(null);
          setInspector(value ?? "");
        }}
        organization={inspection.organization}
        permissionEnabled={permissionEnabled}
        selectedUser={inspectorFallback}
        tenant={inspection.tenant}
        value={inspector || null}
      />
      <UserDirectoryPicker
        description="Optional supervisor assignment."
        disabled={isBusy}
        label="Supervisor"
        onChange={(value) => {
          setValidationError(null);
          setSupervisor(value ?? "");
        }}
        organization={inspection.organization}
        permissionEnabled={permissionEnabled}
        selectedUser={supervisorFallback}
        tenant={inspection.tenant}
        value={supervisor || null}
      />
      <FormField
        description="Optional assignment note recorded by the backend."
        htmlFor="inspection-assign-note"
        label="Note"
      >
        <textarea
          className="block min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          id="inspection-assign-note"
          onChange={(event) => setNote(event.target.value)}
          value={note}
        />
      </FormField>
    </InspectionWorkflowConfirmDialog>
  );
}

function InspectionCancelDialog({
  isBusy,
  onClose,
  onConfirm,
}: {
  isBusy: boolean;
  onClose: () => void;
  onConfirm: (payload: InspectionCancelPayload) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  return (
    <InspectionWorkflowConfirmDialog
      confirmLabel="Cancel inspection"
      description="Cancellation requires a reason so the workflow history stays explicit."
      error={validationError}
      isBusy={isBusy}
      onClose={onClose}
      onConfirm={async () => {
        if (!reason.trim()) {
          setValidationError("Cancellation reason is required.");
          return;
        }

        await onConfirm({
          reason: reason.trim(),
          note: note.trim() || undefined,
        });
      }}
      title="Cancel Inspection"
    >
      <FormField
        description="Required cancellation reason."
        htmlFor="inspection-cancel-reason"
        label="Reason"
      >
        <input
          className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          id="inspection-cancel-reason"
          onChange={(event) => {
            setValidationError(null);
            setReason(event.target.value);
          }}
          value={reason}
        />
      </FormField>
      <FormField
        description="Optional workflow note."
        htmlFor="inspection-cancel-note"
        label="Note"
      >
        <textarea
          className="block min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          id="inspection-cancel-note"
          onChange={(event) => setNote(event.target.value)}
          value={note}
        />
      </FormField>
    </InspectionWorkflowConfirmDialog>
  );
}

function InspectionReopenDialog({
  isBusy,
  onClose,
  onConfirm,
}: {
  isBusy: boolean;
  onClose: () => void;
  onConfirm: (payload: InspectionReopenPayload) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  return (
    <InspectionWorkflowConfirmDialog
      confirmLabel="Reopen inspection"
      description="Reopening starts a new inspection workflow cycle and requires a reason."
      error={validationError}
      isBusy={isBusy}
      onClose={onClose}
      onConfirm={async () => {
        if (!reason.trim()) {
          setValidationError("Reopen reason is required.");
          return;
        }

        await onConfirm({
          reason: reason.trim(),
          note: note.trim() || undefined,
        });
      }}
      title="Reopen Inspection"
    >
      <FormField
        description="Required reopen reason."
        htmlFor="inspection-reopen-reason"
        label="Reason"
      >
        <input
          className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          id="inspection-reopen-reason"
          onChange={(event) => {
            setValidationError(null);
            setReason(event.target.value);
          }}
          value={reason}
        />
      </FormField>
      <FormField
        description="Optional note for the reopened cycle."
        htmlFor="inspection-reopen-note"
        label="Note"
      >
        <textarea
          className="block min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          id="inspection-reopen-note"
          onChange={(event) => setNote(event.target.value)}
          value={note}
        />
      </FormField>
    </InspectionWorkflowConfirmDialog>
  );
}

export function InspectionWorkflowActions({
  inspection,
}: {
  inspection: InspectionDetail;
}) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const [activeDialog, setActiveDialog] = useState<WorkflowDialogKey>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const assignMutation = useAssignInspection(inspection.id);
  const startMutation = useStartInspection(inspection.id);
  const completeMutation = useCompleteInspection(inspection.id);
  const verifyMutation = useVerifyInspection(inspection.id);
  const cancelMutation = useCancelInspection(inspection.id);
  const reopenMutation = useReopenInspection(inspection.id);

  const canManage = hasPermission("inspection.manage");
  const canReadDirectory = hasPermission("users.directory");
  const allActions = useMemo(
    () => getInspectionWorkflowActions(inspection.status),
    [inspection.status],
  );
  const availableActions = useMemo(
    () =>
      allActions.filter(
        (action) =>
          !permissionsLoading &&
          (canManage || hasPermission(action.permission)),
      ),
    [allActions, canManage, hasPermission, permissionsLoading],
  );

  const workflowError = findWorkflowError([
    assignMutation.error,
    startMutation.error,
    completeMutation.error,
    verifyMutation.error,
    cancelMutation.error,
    reopenMutation.error,
  ]);
  const isBusy =
    assignMutation.isPending ||
    startMutation.isPending ||
    completeMutation.isPending ||
    verifyMutation.isPending ||
    cancelMutation.isPending ||
    reopenMutation.isPending;

  async function handleSimpleAction(
    action: InspectionWorkflowAction,
    payload: InspectionSimpleWorkflowPayload,
  ) {
    setSuccessMessage(null);

    if (action.key === "start") {
      await startMutation.mutateAsync(payload);
    } else if (action.key === "complete") {
      await completeMutation.mutateAsync(payload);
    } else if (action.key === "verify") {
      await verifyMutation.mutateAsync(payload);
    }

    setSuccessMessage(`${action.label} completed successfully.`);
    setActiveDialog(null);
  }

  return (
    <WorkflowSectionCard
      description="Available actions depend on the current inspection status and your workflow permissions. Backend permission and transition validation remains authoritative."
      title="Workflow Actions"
    >
      {workflowError ? (
        <ErrorState
          message={
            workflowError instanceof Error
              ? workflowError.message
              : "The inspection workflow action could not be completed."
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
          <InspectionStatusBadge status={inspection.status} />
          <span className="text-sm text-slate-600">{formatLabel(inspection.status)}</span>
        </div>
      </div>

      {availableActions.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          No workflow actions are currently available for this inspection and account.
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

      {activeDialog === "assign" ? (
        <InspectionAssignDialog
          inspection={inspection}
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onConfirm={async (payload) => {
            setSuccessMessage(null);
            await assignMutation.mutateAsync(payload);
            setSuccessMessage("Inspection assignment updated successfully.");
            setActiveDialog(null);
          }}
          permissionEnabled={!permissionsLoading && canReadDirectory}
        />
      ) : null}

      {activeDialog === "start" ? (
        <InspectionSimpleActionDialog
          confirmLabel="Start inspection"
          description="Move this inspection into active execution."
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onConfirm={async (payload) => {
            await handleSimpleAction(
              availableActions.find((action) => action.key === "start")!,
              payload,
            );
          }}
          title="Start Inspection"
        />
      ) : null}

      {activeDialog === "complete" ? (
        <InspectionSimpleActionDialog
          confirmLabel="Complete inspection"
          description="Complete this inspection after all backend scoring requirements are satisfied."
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onConfirm={async (payload) => {
            await handleSimpleAction(
              availableActions.find((action) => action.key === "complete")!,
              payload,
            );
          }}
          title="Complete Inspection"
        />
      ) : null}

      {activeDialog === "verify" ? (
        <InspectionSimpleActionDialog
          confirmLabel="Verify inspection"
          description="Verify this completed inspection after backend verification rules are satisfied."
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onConfirm={async (payload) => {
            await handleSimpleAction(
              availableActions.find((action) => action.key === "verify")!,
              payload,
            );
          }}
          title="Verify Inspection"
        />
      ) : null}

      {activeDialog === "cancel" ? (
        <InspectionCancelDialog
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onConfirm={async (payload) => {
            setSuccessMessage(null);
            await cancelMutation.mutateAsync(payload);
            setSuccessMessage("Inspection cancelled successfully.");
            setActiveDialog(null);
          }}
        />
      ) : null}

      {activeDialog === "reopen" ? (
        <InspectionReopenDialog
          isBusy={isBusy}
          onClose={() => setActiveDialog(null)}
          onConfirm={async (payload) => {
            setSuccessMessage(null);
            await reopenMutation.mutateAsync(payload);
            setSuccessMessage("Inspection reopened successfully.");
            setActiveDialog(null);
          }}
        />
      ) : null}
    </WorkflowSectionCard>
  );
}

export function InspectionStatusTimeline({
  statusHistory,
}: {
  statusHistory: InspectionStatusHistory[];
}) {
  const orderedHistory = [...statusHistory].sort(
    (left, right) =>
      new Date(right.changed_at).getTime() - new Date(left.changed_at).getTime(),
  );

  return (
    <WorkflowSectionCard
      description="Chronological workflow transitions recorded by backend status history."
      title="Status Timeline"
    >
      {orderedHistory.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          No workflow transitions have been recorded for this inspection yet.
        </div>
      ) : (
        <ol className="space-y-4">
          {orderedHistory.map((entry) => (
            <li className="rounded-xl border border-slate-200 bg-slate-50 p-4" key={entry.id}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-950">
                      {formatLabel(entry.action)}
                    </span>
                    <InspectionStatusBadge status={entry.to_status} />
                  </div>
                  <p className="text-sm text-slate-700">
                    {formatLabel(entry.from_status, "None")}
                    {" -> "}
                    {formatLabel(entry.to_status)}
                  </p>
                  {entry.reason ? (
                    <p className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">Reason:</span>{" "}
                      {entry.reason}
                    </p>
                  ) : null}
                  {entry.note ? (
                    <p className="text-sm text-slate-700">
                      <span className="font-medium text-slate-900">Notes:</span>{" "}
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
    </WorkflowSectionCard>
  );
}
