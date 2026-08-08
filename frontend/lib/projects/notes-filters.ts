import type {
  ProjectNoteCategory,
  ProjectNoteListFilters,
  ProjectNoteListParams,
} from "@/types/projects";

export const DEFAULT_PROJECT_NOTE_LIST_FILTERS: ProjectNoteListFilters = {
  search: "",
  category: "",
  author: "",
  sort: "-created_at",
  pageSize: 20,
};

export function serializeProjectNoteListParams(
  filters: ProjectNoteListFilters,
  page: number,
  debouncedSearch?: string,
): ProjectNoteListParams {
  const search = (debouncedSearch ?? filters.search).trim();

  return {
    page,
    page_size: filters.pageSize,
    search: search || undefined,
    category: (filters.category || undefined) as
      | ProjectNoteCategory
      | undefined,
    author: filters.author || undefined,
    ordering: filters.sort || undefined,
  };
}
