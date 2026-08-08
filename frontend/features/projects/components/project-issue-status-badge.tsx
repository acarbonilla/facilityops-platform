import type { ProjectIssueStatus } from "@/types/projects";

import { formatProjectIssueStatusLabel } from "@/lib/projects/issues-display";

const STATUS_STYLES: Record<ProjectIssueStatus, string> = {
  open: "border-sky-200 bg-sky-100 text-sky-800",
  investigating: "border-cyan-200 bg-cyan-100 text-cyan-800",
  blocked: "border-rose-200 bg-rose-100 text-rose-800",
  resolved: "border-emerald-200 bg-emerald-100 text-emerald-800",
  closed: "border-slate-300 bg-slate-100 text-slate-700",
  cancelled: "border-rose-200 bg-rose-100 text-rose-800",
};

export function ProjectIssueStatusBadge({
  status,
}: {
  status: ProjectIssueStatus;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        STATUS_STYLES[status],
      ].join(" ")}
    >
      {formatProjectIssueStatusLabel(status)}
    </span>
  );
}
