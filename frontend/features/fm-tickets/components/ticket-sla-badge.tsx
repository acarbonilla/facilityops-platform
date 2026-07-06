"use client";

import type { FmTicketSlaStatus } from "@/types/fm-tickets";

import { formatTicketLabel } from "./ticket-shared";

const SLA_STATUS_STYLES: Record<FmTicketSlaStatus, string> = {
  not_started: "border-slate-200 bg-slate-100 text-slate-700",
  within_sla: "border-blue-200 bg-blue-50 text-blue-800",
  at_risk: "border-amber-200 bg-amber-50 text-amber-800",
  breached: "border-rose-200 bg-rose-50 text-rose-800",
  met: "border-emerald-200 bg-emerald-50 text-emerald-800",
  missed: "border-red-200 bg-red-50 text-red-800",
  not_applicable: "border-slate-200 bg-slate-100 text-slate-600",
};

export function TicketSlaBadge({
  status,
}: {
  status?: FmTicketSlaStatus | null;
}) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
        Not available
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${SLA_STATUS_STYLES[status]}`}
    >
      {formatTicketLabel(status, "Not available")}
    </span>
  );
}
