import type {
  ProjectIssueListFilters,
  ProjectIssueListParams,
  ProjectIssueSeverity,
  ProjectIssueStatus,
} from "@/types/projects";

export const DEFAULT_PROJECT_ISSUE_LIST_FILTERS: ProjectIssueListFilters = {
  search: "",
  status: "",
  severity: "",
  owner: "",
  dueDateFrom: "",
  dueDateTo: "",
  sort: "-updated_at",
  pageSize: 20,
};

export function serializeProjectIssueListParams(
  filters: ProjectIssueListFilters,
  page: number,
  debouncedSearch?: string,
): ProjectIssueListParams {
  const search = (debouncedSearch ?? filters.search).trim();

  return {
    page,
    page_size: filters.pageSize,
    search: search || undefined,
    status: (filters.status || undefined) as ProjectIssueStatus | undefined,
    severity: (filters.severity || undefined) as
      | ProjectIssueSeverity
      | undefined,
    owner: filters.owner || undefined,
    due_date_from: filters.dueDateFrom || undefined,
    due_date_to: filters.dueDateTo || undefined,
    ordering: filters.sort || undefined,
  };
}
