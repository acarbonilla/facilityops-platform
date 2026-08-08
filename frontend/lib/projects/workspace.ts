import type { ProjectListItem, ProjectTaskSummary } from "@/types/projects";

export const TECHNICIAN_ROLE_CODE = "technician";

/** Roles that retain the full Project portfolio (not workspace-scoped). */
export const BROAD_PROJECT_SCOPE_ROLE_CODES = [
  "system_admin",
  "facility_manager",
] as const;

export interface ProjectWorkspaceSummary {
  my_assigned: number;
  my_completed: number;
  my_overdue: number;
  next_assigned_task: {
    id: string;
    task_code: string;
    name: string;
    status: string;
    planned_end: string | null;
  } | null;
}

export function hasTechnicianRole(
  roles: readonly string[] | null | undefined,
): boolean {
  if (!roles) {
    return false;
  }
  return roles
    .map((role) => role.trim().toLowerCase())
    .includes(TECHNICIAN_ROLE_CODE);
}

export function hasBroadProjectScopeRole(
  roles: readonly string[] | null | undefined,
): boolean {
  if (!roles) {
    return false;
  }
  const normalized = new Set(roles.map((role) => role.trim().toLowerCase()));
  return BROAD_PROJECT_SCOPE_ROLE_CODES.some((code) => normalized.has(code));
}

/**
 * Technician workspace mode: technician role without manage / FM portfolio.
 * Matches backend user_uses_project_workspace_scope.
 */
export function usesProjectWorkspaceMode(input: {
  roles?: readonly string[] | null;
  hasPermission: (code: string) => boolean;
}): boolean {
  if (input.hasPermission("projects.manage")) {
    return false;
  }
  if (hasBroadProjectScopeRole(input.roles)) {
    return false;
  }
  return hasTechnicianRole(input.roles);
}

export function canManageProjectPortfolio(hasPermission: (code: string) => boolean) {
  return (
    hasPermission("projects.create") ||
    hasPermission("projects.update") ||
    hasPermission("projects.delete") ||
    hasPermission("projects.manage") ||
    hasPermission("projects.members.manage")
  );
}

export function canOpenProjectGantt(hasPermission: (code: string) => boolean) {
  return (
    hasPermission("projects.gantt.view") ||
    hasPermission("projects.manage")
  );
}

export function canManageProjectLinks(hasPermission: (code: string) => boolean) {
  return (
    hasPermission("projects.links.manage") || hasPermission("projects.manage")
  );
}

export function canReportProjectIssue(hasPermission: (code: string) => boolean) {
  return (
    hasPermission("projects.issues.report") ||
    hasPermission("projects.issues.manage") ||
    hasPermission("projects.manage")
  );
}

export function getProjectListItemWorkspace(
  project: ProjectListItem,
): ProjectWorkspaceSummary | null {
  const workspace = (
    project as ProjectListItem & {
      my_workspace?: ProjectWorkspaceSummary | null;
    }
  ).my_workspace;
  return workspace ?? null;
}

export function formatMyTaskSummaryCounts(
  summary?: ProjectTaskSummary | null,
): Array<{ label: string; value: number }> {
  return [
    { label: "My assigned", value: summary?.my_assigned ?? 0 },
    { label: "My completed", value: summary?.my_completed ?? 0 },
    { label: "My overdue", value: summary?.my_overdue ?? 0 },
    { label: "Project total", value: summary?.total ?? 0 },
  ];
}
