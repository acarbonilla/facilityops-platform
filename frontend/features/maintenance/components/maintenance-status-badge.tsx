import type { MaintenanceWorkOrderStatus } from "@/types/maintenance";

import { formatMaintenanceLabel } from "@/lib/maintenance/display";

const STATUS_STYLES: Record<MaintenanceWorkOrderStatus, string> = {
  draft: "border-slate-300 bg-slate-100 text-slate-700",
  open: "border-blue-200 bg-blue-100 text-blue-800",
  assigned: "border-amber-200 bg-amber-100 text-amber-800",
  in_progress: "border-cyan-200 bg-cyan-100 text-cyan-800",
  on_hold: "border-orange-200 bg-orange-100 text-orange-800",
  completed: "border-emerald-200 bg-emerald-100 text-emerald-800",
  cancelled: "border-rose-200 bg-rose-100 text-rose-800",
  closed: "border-violet-200 bg-violet-100 text-violet-800",
};

export function MaintenanceStatusBadge({
  status,
}: {
  status: MaintenanceWorkOrderStatus;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        STATUS_STYLES[status],
      ].join(" ")}
    >
      {formatMaintenanceLabel(status)}
    </span>
  );
}
