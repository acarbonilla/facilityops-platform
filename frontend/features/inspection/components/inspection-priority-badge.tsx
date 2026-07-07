import type { InspectionPriority } from "@/types/inspection";

const PRIORITY_STYLES: Record<InspectionPriority, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-sky-100 text-sky-800",
  high: "bg-amber-100 text-amber-800",
  critical: "bg-rose-100 text-rose-800",
};

function formatLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function InspectionPriorityBadge({
  priority,
}: {
  priority: InspectionPriority;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        PRIORITY_STYLES[priority],
      ].join(" ")}
    >
      {formatLabel(priority)}
    </span>
  );
}
