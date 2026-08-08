import type {
  ProjectTaskListFilters,
  ProjectTaskListParams,
  ProjectTaskPriority,
  ProjectTaskStatus,
} from "@/types/projects";

export const DEFAULT_PROJECT_TASK_LIST_FILTERS: ProjectTaskListFilters = {
  search: "",
  status: "",
  priority: "",
  personInCharge: "",
  isMilestone: "",
  delayed: "",
  dependencyBlocked: "",
  unscheduled: "",
  plannedStartFrom: "",
  plannedStartTo: "",
  plannedEndFrom: "",
  plannedEndTo: "",
  progressMin: "",
  progressMax: "",
  sort: "sequence",
  pageSize: 20,
};

function serializeTriStateBool(
  value: "" | "true" | "false",
): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function serializeProjectTaskListParams(
  filters: ProjectTaskListFilters,
  page: number,
  debouncedSearch?: string,
): ProjectTaskListParams {
  const search = (debouncedSearch ?? filters.search).trim();
  const isMilestone = serializeTriStateBool(filters.isMilestone);
  const delayed = serializeTriStateBool(filters.delayed);
  const dependencyBlocked = serializeTriStateBool(filters.dependencyBlocked);
  const unscheduled = serializeTriStateBool(filters.unscheduled);

  return {
    page,
    page_size: filters.pageSize,
    search: search || undefined,
    status: (filters.status || undefined) as ProjectTaskStatus | undefined,
    priority: (filters.priority || undefined) as
      | ProjectTaskPriority
      | undefined,
    person_in_charge: filters.personInCharge || undefined,
    is_milestone: isMilestone,
    ...(delayed !== undefined ? { delayed } : {}),
    ...(dependencyBlocked !== undefined
      ? { dependency_blocked: dependencyBlocked }
      : {}),
    ...(unscheduled !== undefined ? { unscheduled } : {}),
    planned_start_from: filters.plannedStartFrom || undefined,
    planned_start_to: filters.plannedStartTo || undefined,
    planned_end_from: filters.plannedEndFrom || undefined,
    planned_end_to: filters.plannedEndTo || undefined,
    progress_min: filters.progressMin || undefined,
    progress_max: filters.progressMax || undefined,
    ordering: filters.sort || undefined,
  };
}
