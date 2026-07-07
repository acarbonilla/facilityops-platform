"use client";

import { useState } from "react";

import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useAcknowledgeWorkOrderEscalation,
  useResolveWorkOrderEscalation,
  useWorkOrderEscalations,
} from "@/hooks/use-work-order-escalations";
import { formatDateTime, formatMaintenanceError, formatMaintenanceLabel, formatPersonLabel } from "@/lib/maintenance/display";
import type { MaintenanceEscalation, MaintenanceWorkOrderDetail } from "@/types/maintenance";

import { MaintenanceEscalationBadge } from "./maintenance-sla-badges";
import { SectionCard } from "./maintenance-shared";

interface DialogState {
  action: "acknowledge" | "resolve";
  escalation: MaintenanceEscalation;
}

function EscalationDialog({ dialog, error, isBusy, onClose, onConfirm }: { dialog: DialogState; error: string | null; isBusy: boolean; onClose: () => void; onConfirm: (notes: string) => void | Promise<void> }) {
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const isResolve = dialog.action === "resolve";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div aria-labelledby="maintenance-escalation-dialog-title" aria-modal="true" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl" role="dialog">
        <h3 className="text-xl font-semibold text-slate-950" id="maintenance-escalation-dialog-title">{isResolve ? "Resolve Escalation" : "Acknowledge Escalation"}</h3>
        {validationError ?? error ? <p className="mt-3 text-sm text-red-700">{validationError ?? error}</p> : null}
        <div className="mt-5">
          <FormField htmlFor="escalation-notes" label={isResolve ? "Resolution notes" : "Notes"}>
            <textarea className="block min-h-28 w-full rounded-md border border-slate-300 px-3 py-2" id="escalation-notes" onChange={(event) => setNotes(event.target.value)} value={notes} />
          </FormField>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={onClose} type="button">Close</button>
          <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={isBusy} onClick={() => void (async () => {
            if (isResolve && !notes.trim()) { setValidationError("Resolution notes are required."); return; }
            await onConfirm(notes.trim());
          })()} type="button">{isBusy ? "Saving..." : isResolve ? "Resolve" : "Acknowledge"}</button>
        </div>
      </div>
    </div>
  );
}

export const MaintenanceAcknowledgeEscalationDialog = EscalationDialog;
export const MaintenanceResolveEscalationDialog = EscalationDialog;

export function MaintenanceEscalationTimeline({ escalations, canAcknowledge, canResolve, onAction }: { escalations: MaintenanceEscalation[]; canAcknowledge: boolean; canResolve: boolean; onAction: (dialog: DialogState) => void }) {
  if (escalations.length === 0) return <p className="text-sm text-slate-600">No escalation history recorded.</p>;
  return <ol className="space-y-3">{escalations.map((item) => (
    <li className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={item.id}>
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><MaintenanceEscalationBadge /><span className="font-semibold text-slate-900">{formatMaintenanceLabel(item.level)}</span></div><time className="text-xs text-slate-500">{formatDateTime(item.created_at)}</time></div>
      <p className="mt-3 text-sm text-slate-700">{item.reason}</p>
      <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        <div><dt className="text-slate-500">Status</dt><dd>{formatMaintenanceLabel(item.status)}</dd></div>
        <div><dt className="text-slate-500">Owner</dt><dd>{formatPersonLabel(item.escalated_to_email, "Unassigned")}</dd></div>
        <div><dt className="text-slate-500">Acknowledged</dt><dd>{formatDateTime(item.acknowledged_at)}</dd></div>
        <div><dt className="text-slate-500">Resolved</dt><dd>{formatDateTime(item.resolved_at)}</dd></div>
      </dl>
      {item.notes ? <p className="mt-3 text-sm text-slate-700">Notes: {item.notes}</p> : null}
      <div className="mt-4 flex gap-2">
        {item.status === "open" && canAcknowledge ? <button className="rounded-md border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700" onClick={() => onAction({ action: "acknowledge", escalation: item })} type="button">Acknowledge</button> : null}
        {["open", "acknowledged"].includes(item.status) && canResolve ? <button className="rounded-md border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700" onClick={() => onAction({ action: "resolve", escalation: item })} type="button">Resolve</button> : null}
      </div>
    </li>
  ))}</ol>;
}

export const MaintenanceEscalationActions = MaintenanceEscalationTimeline;

export function MaintenanceEscalationCard({ workOrder }: { workOrder: MaintenanceWorkOrderDetail }) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const canManage = hasPermission("maintenance.manage");
  const canView = canManage || hasPermission("maintenance.work_order.view_escalation") || hasPermission("maintenance.view_escalation");
  const canAcknowledge = canManage || hasPermission("maintenance.work_order.acknowledge_escalation") || hasPermission("maintenance.acknowledge_escalation");
  const canResolve = canManage || hasPermission("maintenance.work_order.resolve_escalation") || hasPermission("maintenance.resolve_escalation");
  const query = useWorkOrderEscalations(workOrder.id, !permissionsLoading && canView);
  const acknowledgeMutation = useAcknowledgeWorkOrderEscalation(workOrder.id);
  const resolveMutation = useResolveWorkOrderEscalation(workOrder.id);
  const escalations = query.data ?? workOrder.escalations;
  const mutationError = acknowledgeMutation.error ?? resolveMutation.error;
  const error = mutationError ? formatMaintenanceError(mutationError, "Escalation action failed.") : null;
  if (!permissionsLoading && !canView) return null;
  return (
    <SectionCard title="Escalations" description="Warning and breach escalations created by SLA monitoring.">
      {query.isError ? <ErrorState title="Unable to load escalations" message={formatMaintenanceError(query.error, "Escalation history could not be loaded.")} /> : null}
      <MaintenanceEscalationTimeline escalations={escalations} canAcknowledge={canAcknowledge} canResolve={canResolve} onAction={setDialog} />
      {dialog ? <EscalationDialog dialog={dialog} error={error} isBusy={acknowledgeMutation.isPending || resolveMutation.isPending} onClose={() => setDialog(null)} onConfirm={async (notes) => {
        if (dialog.action === "acknowledge") await acknowledgeMutation.mutateAsync({ escalationId: dialog.escalation.id, notes });
        else await resolveMutation.mutateAsync({ escalationId: dialog.escalation.id, notes });
        setDialog(null);
      }} /> : null}
    </SectionCard>
  );
}
