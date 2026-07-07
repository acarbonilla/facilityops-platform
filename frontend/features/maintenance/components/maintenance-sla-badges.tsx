import type { MaintenanceSlaStatus } from "@/types/maintenance";

const SLA_STYLES: Record<MaintenanceSlaStatus, string> = {
  not_started: "border-slate-300 bg-slate-100 text-slate-700",
  within_sla: "border-emerald-300 bg-emerald-50 text-emerald-800",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  breached: "border-red-300 bg-red-50 text-red-800",
  paused: "border-blue-300 bg-blue-50 text-blue-800",
  completed: "border-emerald-300 bg-emerald-50 text-emerald-800",
  cancelled: "border-slate-300 bg-slate-100 text-slate-700",
  at_risk: "border-amber-300 bg-amber-50 text-amber-900",
  met: "border-emerald-300 bg-emerald-50 text-emerald-800",
  missed: "border-red-300 bg-red-50 text-red-800",
  not_applicable: "border-slate-300 bg-slate-100 text-slate-700",
};

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function MaintenanceSLAStatusBadge({ status }: { status: MaintenanceSlaStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${SLA_STYLES[status]}`}>{label(status)}</span>;
}

export function MaintenanceOverdueBadge() {
  return <span className="inline-flex rounded-full border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">Overdue</span>;
}

export function MaintenanceEscalationBadge() {
  return <span className="inline-flex rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800">Escalated</span>;
}
