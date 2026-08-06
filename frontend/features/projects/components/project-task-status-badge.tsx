import type { ProjectTaskStatus } from "@/types/projects";

import { formatProjectTaskStatusLabel } from "@/lib/projects/tasks-display";

const STATUS_STYLES: Record<ProjectTaskStatus, string> = {
  not_started: "border-slate-300 bg-slate-100 text-slate-700",
  in_progress: "border-cyan-200 bg-cyan-100 text-cyan-800",
  blocked: "border-rose-200 bg-rose-100 text-rose-800",
  on_hold: "border-orange-200 bg-orange-100 text-orange-800",
  completed: "border-emerald-200 bg-emerald-100 text-emerald-800",
  cancelled: "border-rose-200 bg-rose-100 text-rose-800",
};

export function ProjectTaskStatusBadge({
  status,
}: {
  status: ProjectTaskStatus;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        STATUS_STYLES[status],
      ].join(" ")}
    >
      {formatProjectTaskStatusLabel(status)}
    </span>
  );
}
