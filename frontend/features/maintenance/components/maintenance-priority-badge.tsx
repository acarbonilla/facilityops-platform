import type { MaintenanceWorkOrderPriority } from "@/types/maintenance";

import { formatMaintenanceLabel } from "@/lib/maintenance/display";

const PRIORITY_STYLES: Record<MaintenanceWorkOrderPriority, string> = {
  low: "border-slate-300 bg-slate-100 text-slate-700",
  medium: "border-sky-200 bg-sky-100 text-sky-800",
  high: "border-amber-200 bg-amber-100 text-amber-800",
  critical: "border-rose-200 bg-rose-100 text-rose-800",
};

export function MaintenancePriorityBadge({
  priority,
}: {
  priority: MaintenanceWorkOrderPriority;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        PRIORITY_STYLES[priority],
      ].join(" ")}
    >
      {formatMaintenanceLabel(priority)}
    </span>
  );
}
