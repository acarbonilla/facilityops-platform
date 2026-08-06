import type {
  ProjectListFilters,
  ProjectListParams,
  ProjectPriority,
  ProjectStatus,
} from "@/types/projects";

export const DEFAULT_PROJECT_LIST_FILTERS: ProjectListFilters = {
  search: "",
  status: "",
  priority: "",
  organization: "",
  building: "",
  projectManager: "",
  plannedStartFrom: "",
  plannedStartTo: "",
  plannedEndFrom: "",
  plannedEndTo: "",
  sort: "-updated",
  pageSize: 20,
};

export function serializeProjectListParams(
  filters: ProjectListFilters,
  page: number,
  debouncedSearch?: string,
): ProjectListParams {
  const search = (debouncedSearch ?? filters.search).trim();

  return {
    page,
    page_size: filters.pageSize,
    search: search || undefined,
    status: (filters.status || undefined) as ProjectStatus | undefined,
    priority: (filters.priority || undefined) as ProjectPriority | undefined,
    organization: filters.organization || undefined,
    building: filters.building || undefined,
    project_manager: filters.projectManager || undefined,
    planned_start_date_from: filters.plannedStartFrom || undefined,
    planned_start_date_to: filters.plannedStartTo || undefined,
    planned_end_date_from: filters.plannedEndFrom || undefined,
    planned_end_date_to: filters.plannedEndTo || undefined,
    ordering: filters.sort || undefined,
  };
}

export function clearIncompatibleProjectBuilding(
  organizationId: string,
  buildingId: string,
  buildings: Array<{ id: string; organization: string }>,
): string {
  if (!buildingId) {
    return "";
  }

  if (!organizationId) {
    return buildingId;
  }

  const selected = buildings.find((building) => building.id === buildingId);
  if (!selected || selected.organization !== organizationId) {
    return "";
  }

  return buildingId;
}
