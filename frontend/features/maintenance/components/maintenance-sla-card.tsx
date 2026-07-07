"use client";

import { ErrorState } from "@/components/common/error-state";
import { usePermissions } from "@/hooks/use-permissions";
import { useRecalculateWorkOrderSLA, useWorkOrderSLA } from "@/hooks/use-work-order-sla";
import {
  formatDateTime,
  formatMaintenanceError,
  formatRemainingTime,
} from "@/lib/maintenance/display";
import type { MaintenanceWorkOrderDetail } from "@/types/maintenance";

import { MaintenanceOverdueBadge, MaintenanceSLAStatusBadge } from "./maintenance-sla-badges";
import { MetadataList, SectionCard } from "./maintenance-shared";

function formatTarget(minutes: number) {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${minutes} minutes`;
}

function breachLabel(value: boolean) {
  return value ? "Breached" : "Within target";
}

export function MaintenanceSLACard({ workOrder }: { workOrder: MaintenanceWorkOrderDetail }) {
  const { hasPermission, permissionsLoading } = usePermissions();
  const canManage = hasPermission("maintenance.manage");
  const canView = canManage || hasPermission("maintenance.work_order.view_sla") || hasPermission("maintenance.view_sla");
  const canRecalculate = canManage || hasPermission("maintenance.work_order.recalculate_sla") || hasPermission("maintenance.recalculate_sla");
  const slaQuery = useWorkOrderSLA(workOrder.id, !permissionsLoading && canView);
  const recalculateMutation = useRecalculateWorkOrderSLA(workOrder.id);
  const sla = slaQuery.data ?? workOrder.sla;

  if (!permissionsLoading && !canView) return null;

  return (
    <SectionCard title="SLA" description="Response and completion service targets calculated from work-order priority.">
      {slaQuery.isError ? <ErrorState title="Unable to load SLA" message={formatMaintenanceError(slaQuery.error, "SLA data could not be loaded.")} /> : null}
      {recalculateMutation.isError ? <ErrorState title="Unable to recalculate SLA" message={formatMaintenanceError(recalculateMutation.error, "SLA recalculation failed.")} /> : null}
      {sla ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <MaintenanceSLAStatusBadge status={sla.sla_status} />
            {sla.is_overdue ? <MaintenanceOverdueBadge /> : null}
          </div>
          <MetadataList items={[
            { label: "Response target", value: formatTarget(sla.response_target_minutes) },
            { label: "Actual response", value: formatDateTime(sla.responded_at) },
            { label: "Response due", value: formatDateTime(sla.response_due_at) },
            { label: "Response breach", value: breachLabel(sla.response_breached) },
            { label: "Completion target", value: formatTarget(sla.completion_target_minutes) },
            { label: "Actual completion", value: formatDateTime(sla.completed_at) },
            { label: "Completion due", value: formatDateTime(sla.completion_due_at) },
            { label: "Completion breach", value: breachLabel(sla.completion_breached) },
            { label: "Remaining time", value: formatRemainingTime(sla.completion_due_at, sla.completed_at) },
            { label: "Last recalculated", value: formatDateTime(sla.last_recalculated_at) },
          ]} />
        </>
      ) : <p className="text-sm text-slate-600">SLA data is not available.</p>}
      {canRecalculate ? (
        <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={recalculateMutation.isPending} onClick={() => void recalculateMutation.mutateAsync()} type="button">
          {recalculateMutation.isPending ? "Recalculating..." : "Recalculate SLA"}
        </button>
      ) : null}
    </SectionCard>
  );
}
