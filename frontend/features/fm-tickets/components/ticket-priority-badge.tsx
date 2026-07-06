import type { FmTicketPriority } from "@/types/fm-tickets";

import { formatTicketLabel } from "./ticket-shared";

const PRIORITY_STYLES: Record<FmTicketPriority, string> = {
  low: "bg-slate-200 text-slate-700",
  medium: "bg-sky-100 text-sky-800",
  high: "bg-amber-100 text-amber-800",
  urgent: "bg-rose-100 text-rose-800",
};

export function TicketPriorityBadge({ priority }: { priority: FmTicketPriority }) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        PRIORITY_STYLES[priority],
      ].join(" ")}
    >
      {formatTicketLabel(priority)}
    </span>
  );
}
