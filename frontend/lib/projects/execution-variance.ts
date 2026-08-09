/**
 * FO-115B planned-vs-actual execution variance display helpers.
 * Server remains authoritative; these format API-derived fields for UI/a11y.
 */

export type ExecutionScheduleStatus =
  | "not_started"
  | "started_early"
  | "started_on_time"
  | "started_late"
  | "in_progress_past_due"
  | "completed_early"
  | "completed_on_time"
  | "completed_late"
  | "unscheduled"
  | "variance_unavailable";

export function formatVarianceDaysLabel(
  days: number | null | undefined,
  kind: "start" | "completion",
): string {
  if (days === null || days === undefined) {
    return "Not available";
  }
  if (days === 0) {
    return kind === "start" ? "Started on time" : "Completed on time";
  }
  const abs = Math.abs(days);
  const unit = abs === 1 ? "day" : "days";
  if (days < 0) {
    return kind === "start"
      ? `Started ${abs} ${unit} early`
      : `Completed ${abs} ${unit} early`;
  }
  return kind === "start"
    ? `Started ${abs} ${unit} late`
    : `Completed ${abs} ${unit} late`;
}

export function formatExecutionScheduleStatusLabel(
  status: ExecutionScheduleStatus | string | null | undefined,
): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "started_early":
      return "Started early";
    case "started_on_time":
      return "Started on time";
    case "started_late":
      return "Started late";
    case "in_progress_past_due":
      return "Running past planned end";
    case "completed_early":
      return "Completed early";
    case "completed_on_time":
      return "Completed on time";
    case "completed_late":
      return "Completed late";
    case "unscheduled":
      return "Unscheduled";
    case "variance_unavailable":
      return "Variance not available";
    default:
      return "Variance not available";
  }
}

export function formatActualStartLabel(
  actualStart: string | null | undefined,
): string {
  if (!actualStart) return "Not started";
  return actualStart;
}

export function formatActualEndLabel(
  actualEnd: string | null | undefined,
  options?: { stillInProgress?: boolean },
): string {
  if (actualEnd) return actualEnd;
  if (options?.stillInProgress) return "Still in progress";
  return "Not completed";
}

export function formatActualExecutionRangeLabel(options: {
  actual_start?: string | null;
  actual_end?: string | null;
  status?: string;
}): string {
  const start = options.actual_start;
  const end = options.actual_end;
  if (!start) return "Not started";
  if (end) return `${start} – ${end}`;
  const active =
    options.status === "in_progress" ||
    options.status === "on_hold" ||
    options.status === "blocked";
  return active ? `Started ${start} · Still in progress` : `Started ${start}`;
}

export function formatScheduleStatusSummary(task: {
  execution_schedule_status?: string | null;
  start_variance_days?: number | null;
  completion_variance_days?: number | null;
  days_past_planned_end?: number | null;
  actual_end?: string | null;
  is_milestone?: boolean;
}): string {
  const status = task.execution_schedule_status ?? "variance_unavailable";
  if (status === "in_progress_past_due") {
    const overdue = Math.max(0, Math.round(task.days_past_planned_end ?? 0));
    const overdueLabel =
      overdue === 1 ? "1 day" : `${overdue} days`;
    const startPart = formatVarianceDaysLabel(task.start_variance_days, "start");
    return `${startPart}. Currently overdue by ${overdueLabel}`;
  }
  if (status.startsWith("completed_")) {
    if (task.is_milestone) {
      return formatVarianceDaysLabel(
        task.completion_variance_days,
        "completion",
      ).replace(/^Completed/, "Milestone completed");
    }
    return formatVarianceDaysLabel(
      task.completion_variance_days,
      "completion",
    );
  }
  if (
    status === "started_early" ||
    status === "started_on_time" ||
    status === "started_late"
  ) {
    return formatVarianceDaysLabel(task.start_variance_days, "start");
  }
  return formatExecutionScheduleStatusLabel(status);
}

/** Actual bar end: completed end, else today for active execution. */
export function resolveActualBarEnd(options: {
  actual_start?: string | null;
  actual_end?: string | null;
  status?: string;
  todayIso?: string;
}): string | null {
  if (!options.actual_start) return null;
  if (options.actual_end) return options.actual_end;
  if (
    options.status === "completed" ||
    options.status === "cancelled" ||
    options.status === "not_started"
  ) {
    return null;
  }
  return options.todayIso ?? null;
}
