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
  plannedStartFrom: "",
  plannedStartTo: "",
  plannedEndFrom: "",
  plannedEndTo: "",
  progressMin: "",
  progressMax: "",
  sort: "sequence",
  pageSize: 20,
};

export function serializeProjectTaskListParams(
  filters: ProjectTaskListFilters,
  page: number,
  debouncedSearch?: string,
): ProjectTaskListParams {
  const search = (debouncedSearch ?? filters.search).trim();
  const isMilestone =
    filters.isMilestone === "true"
      ? true
      : filters.isMilestone === "false"
        ? false
        : undefined;

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
    planned_start_from: filters.plannedStartFrom || undefined,
    planned_start_to: filters.plannedStartTo || undefined,
    planned_end_from: filters.plannedEndFrom || undefined,
    planned_end_to: filters.plannedEndTo || undefined,
    progress_min: filters.progressMin || undefined,
    progress_max: filters.progressMax || undefined,
    ordering: filters.sort || undefined,
  };
}
