"use client";

import { useState } from "react";

import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { useAssignWorkOrder } from "@/hooks/use-assign-work-order";
import { usePermissions } from "@/hooks/use-permissions";
import { useReassignWorkOrder } from "@/hooks/use-reassign-work-order";
import { useUnassignWorkOrder } from "@/hooks/use-unassign-work-order";
import {
  useWorkOrderAssignmentCandidates,
  useWorkOrderAssignments,
} from "@/hooks/use-work-order-assignments";
import {
  formatDateTime,
  formatMaintenanceError,
  formatMaintenanceLabel,
  formatPersonLabel,
} from "@/lib/maintenance/display";
import { getMaintenanceWorkflowSuccessMessage } from "@/lib/maintenance/workflow";
import type {
  MaintenanceAssignment,
  MaintenanceAssignmentCandidate,
  MaintenanceAssignPayload,
  MaintenanceReassignPayload,
  MaintenanceUnassignPayload,
  MaintenanceWorkOrderDetail,
} from "@/types/maintenance";

import { MetadataList, SectionCard } from "./maintenance-shared";

type AssignmentDialog = "assign" | "reassign" | "unassign" | null;

function candidateLabel(candidate: MaintenanceAssignmentCandidate) {
  const name = [candidate.first_name, candidate.last_name].filter(Boolean).join(" ");
  return name ? `${name} (${candidate.email})` : candidate.email;
}

function candidateSupportsRole(
  candidate: MaintenanceAssignmentCandidate,
  role: "technician" | "supervisor",
) {
  if (candidate.roles.length === 0) {
    return true;
  }
  const allowed =
    role === "technician"
      ? ["technician", "facility_manager", "system_admin"]
      : ["facility_manager", "system_admin"];
  return candidate.roles.some((candidateRole) => allowed.includes(candidateRole));
}

function MaintenancePersonSelect({
  candidates,
  id,
  label,
  onChange,
  required = false,
  role,
  value,
}: {
  candidates: MaintenanceAssignmentCandidate[];
  id: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  role: "technician" | "supervisor";
  value: string;
}) {
  const options = candidates.filter((candidate) => candidateSupportsRole(candidate, role));
  return (
    <FormField htmlFor={id} label={label}>
      <select
        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      >
        <option value="">{required ? `Select ${label.toLowerCase()}` : "Not assigned"}</option>
        {options.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidateLabel(candidate)}
          </option>
        ))}
      </select>
    </FormField>
  );
}

export const MaintenanceTechnicianSelect = MaintenancePersonSelect;
export const MaintenanceSupervisorSelect = MaintenancePersonSelect;

function AssignmentDialogShell({
  children,
  confirmLabel,
  error,
  isBusy,
  onClose,
  onConfirm,
  title,
}: {
  children: React.ReactNode;
  confirmLabel: string;
  error: string | null;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div aria-labelledby="maintenance-assignment-dialog-title" aria-modal="true" className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl" role="dialog">
        <h3 className="text-xl font-semibold text-slate-950" id="maintenance-assignment-dialog-title">{title}</h3>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-5 space-y-4">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={onClose} type="button">
            Close
          </button>
          <button
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
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

function AssignmentFormDialog({
  candidates,
  current,
  error,
  isBusy,
  mode,
  onClose,
  onConfirm,
}: {
  candidates: MaintenanceAssignmentCandidate[];
  current: MaintenanceAssignment | null;
  error: string | null;
  isBusy: boolean;
  mode: "assign" | "reassign";
  onClose: () => void;
  onConfirm: (payload: MaintenanceAssignPayload | MaintenanceReassignPayload) => void | Promise<void>;
}) {
  const [technician, setTechnician] = useState(current?.assigned_to ?? "");
  const [supervisor, setSupervisor] = useState(current?.supervisor ?? "");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  return (
    <AssignmentDialogShell
      confirmLabel={mode === "assign" ? "Assign work order" : "Reassign work order"}
      error={validationError ?? error}
      isBusy={isBusy}
      onClose={onClose}
      onConfirm={async () => {
        if (!technician) {
          setValidationError("Technician is required.");
          return;
        }
        if (mode === "reassign" && !reason.trim()) {
          setValidationError("Reassignment reason is required.");
          return;
        }
        if (technician === supervisor) {
          setValidationError("Technician and supervisor must be different users.");
          return;
        }
        await onConfirm({
          assigned_to: technician,
          supervisor: supervisor || null,
          notes: notes.trim(),
          ...(mode === "reassign" ? { reason: reason.trim() } : {}),
        } as MaintenanceAssignPayload | MaintenanceReassignPayload);
      }}
      title={mode === "assign" ? "Assign Work Order" : "Reassign Work Order"}
    >
      <MaintenanceTechnicianSelect candidates={candidates} id={`${mode}-technician`} label="Technician" onChange={setTechnician} required role="technician" value={technician} />
      <MaintenanceSupervisorSelect candidates={candidates} id={`${mode}-supervisor`} label="Supervisor" onChange={setSupervisor} role="supervisor" value={supervisor} />
      {mode === "reassign" ? (
        <FormField htmlFor="reassign-reason" label="Reason">
          <input className="block w-full rounded-md border border-slate-300 px-3 py-2" id="reassign-reason" onChange={(event) => setReason(event.target.value)} value={reason} />
        </FormField>
      ) : null}
      <FormField htmlFor={`${mode}-notes`} label="Notes">
        <textarea className="block min-h-24 w-full rounded-md border border-slate-300 px-3 py-2" id={`${mode}-notes`} onChange={(event) => setNotes(event.target.value)} value={notes} />
      </FormField>
    </AssignmentDialogShell>
  );
}

export const MaintenanceAssignDialog = AssignmentFormDialog;
export const MaintenanceReassignDialog = AssignmentFormDialog;

export function MaintenanceUnassignDialog({
  error,
  isBusy,
  onClose,
  onConfirm,
}: {
  error: string | null;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: (payload: MaintenanceUnassignPayload) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  return (
    <AssignmentDialogShell
      confirmLabel="Confirm unassignment"
      error={validationError ?? error}
      isBusy={isBusy}
      onClose={onClose}
      onConfirm={async () => {
        if (!reason.trim()) {
          setValidationError("Unassignment reason is required.");
          return;
        }
        await onConfirm({ reason: reason.trim(), notes: notes.trim() });
      }}
      title="Unassign Work Order"
    >
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This returns an assigned work order to the open queue.</p>
      <FormField htmlFor="unassign-reason" label="Reason">
        <input className="block w-full rounded-md border border-slate-300 px-3 py-2" id="unassign-reason" onChange={(event) => setReason(event.target.value)} value={reason} />
      </FormField>
      <FormField htmlFor="unassign-notes" label="Notes">
        <textarea className="block min-h-24 w-full rounded-md border border-slate-300 px-3 py-2" id="unassign-notes" onChange={(event) => setNotes(event.target.value)} value={notes} />
      </FormField>
    </AssignmentDialogShell>
  );
}

export function MaintenanceAssignmentHistoryTimeline({ assignments }: { assignments: MaintenanceAssignment[] }) {
  if (assignments.length === 0) {
    return <p className="text-sm text-slate-600">No assignment history recorded.</p>;
  }
  return (
    <ol className="space-y-3">
      {assignments.map((assignment) => (
        <li className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={assignment.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-slate-900">{formatMaintenanceLabel(assignment.assignment_status)}</p>
            <time className="text-xs text-slate-500">{formatDateTime(assignment.assigned_at)}</time>
          </div>
          <p className="mt-2 text-sm text-slate-700">Technician: {formatPersonLabel(assignment.assigned_to_email, "Unassigned")}</p>
          <p className="text-sm text-slate-700">Supervisor: {formatPersonLabel(assignment.supervisor_email, "Unassigned")}</p>
          {assignment.previous_assigned_to_email ? <p className="text-sm text-slate-600">Previous technician: {assignment.previous_assigned_to_email}</p> : null}
          {assignment.previous_supervisor_email ? <p className="text-sm text-slate-600">Previous supervisor: {assignment.previous_supervisor_email}</p> : null}
          <p className="mt-2 text-xs text-slate-500">Assigned by {formatPersonLabel(assignment.assigned_by_email)}</p>
          {assignment.reason ? <p className="mt-2 text-sm text-slate-700">Reason: {assignment.reason}</p> : null}
          {assignment.notes ? <p className="mt-1 text-sm text-slate-700">Notes: {assignment.notes}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function MaintenanceAssignmentCard({ workOrder }: { workOrder: MaintenanceWorkOrderDetail }) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const [dialog, setDialog] = useState<AssignmentDialog>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const canManage = hasPermission("maintenance.manage");
  const canView = canManage || hasPermission("maintenance.work_order.view_assignment") || hasPermission("maintenance.view_assignment");
  const canAssign = canManage || hasPermission("maintenance.work_order.assign") || hasPermission("maintenance.assign");
  const canReassign = canManage || hasPermission("maintenance.work_order.reassign") || hasPermission("maintenance.reassign");
  const canUnassign = canManage || hasPermission("maintenance.work_order.unassign") || hasPermission("maintenance.unassign");
  const assignmentsQuery = useWorkOrderAssignments(workOrder.id, !permissionsLoading && canView);
  const candidatesQuery = useWorkOrderAssignmentCandidates(workOrder.id, !permissionsLoading && (canAssign || canReassign));
  const assignMutation = useAssignWorkOrder(workOrder.id);
  const reassignMutation = useReassignWorkOrder(workOrder.id);
  const unassignMutation = useUnassignWorkOrder(workOrder.id);
  const assignments = assignmentsQuery.data ?? workOrder.assignments;
  const current = assignments.find((assignment) => assignment.is_active) ?? null;
  const mutationError = assignMutation.error ?? reassignMutation.error ?? unassignMutation.error;
  const error = mutationError ? formatMaintenanceError(mutationError, "Assignment action failed.") : null;
  const isBusy = assignMutation.isPending || reassignMutation.isPending || unassignMutation.isPending;
  const isTerminal = ["completed", "cancelled", "closed"].includes(workOrder.status);

  if (!permissionsLoading && !canView && !canAssign && !canReassign && !canUnassign) {
    return null;
  }

  return (
    <SectionCard title="Assignment" description="Current ownership and auditable technician/supervisor assignment history.">
      {assignmentsQuery.isError ? <ErrorState title="Unable to load assignments" message={formatMaintenanceError(assignmentsQuery.error, "Assignment history could not be loaded.")} /> : null}
      {success ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{success}</p> : null}
      <MetadataList items={[
        { label: "Current technician", value: formatPersonLabel(current?.assigned_to_email ?? workOrder.assignee_email, "Not assigned") },
        { label: "Current supervisor", value: formatPersonLabel(current?.supervisor_email, "Not assigned") },
        { label: "Assigned date", value: formatDateTime(current?.assigned_at) },
        { label: "Assigned by", value: formatPersonLabel(current?.assigned_by_email, "Not recorded") },
        { label: "Assignment status", value: current ? formatMaintenanceLabel(current.assignment_status) : "Unassigned" },
        { label: "Assignment notes", value: current?.notes || "No notes recorded" },
      ]} />
      <div className="flex flex-wrap gap-3">
        {!current && ["open", "reopened"].includes(workOrder.status) && canAssign ? <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => setDialog("assign")} type="button">Assign</button> : null}
        {current && !isTerminal && canReassign ? <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => setDialog("reassign")} type="button">Reassign</button> : null}
        {current && !isTerminal && canUnassign ? <button className="rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-700" onClick={() => setDialog("unassign")} type="button">Unassign</button> : null}
      </div>
      {canView ? <div><h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Assignment history</h3><MaintenanceAssignmentHistoryTimeline assignments={assignments} /></div> : null}
      {dialog === "assign" || dialog === "reassign" ? <AssignmentFormDialog candidates={candidatesQuery.data ?? []} current={current} error={candidatesQuery.isError ? formatMaintenanceError(candidatesQuery.error, "Assignment candidates could not be loaded.") : error} isBusy={isBusy || candidatesQuery.isPending} mode={dialog} onClose={() => setDialog(null)} onConfirm={async (payload) => {
        setSuccess(null);
        if (dialog === "assign") await assignMutation.mutateAsync(payload as MaintenanceAssignPayload);
        else await reassignMutation.mutateAsync(payload as MaintenanceReassignPayload);
        setSuccess(dialog === "assign" ? getMaintenanceWorkflowSuccessMessage("assign") : getMaintenanceWorkflowSuccessMessage("reassign"));
        setDialog(null);
      }} /> : null}
      {dialog === "unassign" ? <MaintenanceUnassignDialog error={error} isBusy={isBusy} onClose={() => setDialog(null)} onConfirm={async (payload) => {
        setSuccess(null);
        await unassignMutation.mutateAsync(payload);
        setSuccess(getMaintenanceWorkflowSuccessMessage("unassign"));
        setDialog(null);
      }} /> : null}
    </SectionCard>
  );
}
