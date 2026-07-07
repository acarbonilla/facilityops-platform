import type { InspectionStatus } from "@/types/inspection";

const STATUS_STYLES: Record<InspectionStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  scheduled: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  verified: "bg-teal-100 text-teal-800",
  cancelled: "bg-rose-100 text-rose-800",
  reopened: "bg-violet-100 text-violet-800",
};

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function InspectionStatusBadge({ status }: { status: InspectionStatus }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        STATUS_STYLES[status],
      ].join(" ")}
    >
      {formatLabel(status)}
    </span>
  );
}
