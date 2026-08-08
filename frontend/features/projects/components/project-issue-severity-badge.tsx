import type { ProjectIssueSeverity } from "@/types/projects";

import { formatProjectIssueSeverityLabel } from "@/lib/projects/issues-display";

const SEVERITY_STYLES: Record<ProjectIssueSeverity, string> = {
  low: "border-slate-300 bg-slate-100 text-slate-700",
  medium: "border-amber-200 bg-amber-100 text-amber-800",
  high: "border-orange-200 bg-orange-100 text-orange-800",
  critical: "border-rose-200 bg-rose-100 text-rose-800",
};

export function ProjectIssueSeverityBadge({
  severity,
}: {
  severity: ProjectIssueSeverity;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        SEVERITY_STYLES[severity],
      ].join(" ")}
    >
      {formatProjectIssueSeverityLabel(severity)}
    </span>
  );
}
