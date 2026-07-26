import type { FmTicketStatus } from "@/types/fm-tickets";

import { formatRequesterStatusLabel } from "@/lib/my-requests/display";

const STATUS_STYLES: Record<FmTicketStatus, string> = {
  draft: "bg-slate-200 text-slate-700",
  open: "bg-blue-100 text-blue-800",
  assigned: "bg-cyan-100 text-cyan-800",
  in_progress: "bg-amber-100 text-amber-800",
  on_hold: "bg-orange-100 text-orange-800",
  resolved: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-800 text-white",
  cancelled: "bg-rose-100 text-rose-800",
};

export function RequesterStatusBadge({ status }: { status: FmTicketStatus }) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        STATUS_STYLES[status],
      ].join(" ")}
    >
      {formatRequesterStatusLabel(status)}
    </span>
  );
}
