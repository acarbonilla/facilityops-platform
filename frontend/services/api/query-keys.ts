import type { MasterDataLifecycle, MasterDataListParams, MasterDataResourceKey } from "@/types/master-data";
import type { PermissionListParams, RbacListParams } from "@/types/rbac";
import type { UserDirectoryParams, UserListParams } from "@/types/users";
import type { FmTicketListParams } from "@/types/fm-tickets";
import type { InspectionListParams } from "@/types/inspection";
import type { MaintenanceListParams } from "@/types/maintenance";
import type { NotificationListParams } from "@/types/notifications";
import type {
  ProjectIssueListParams,
  ProjectLinkOptionParams,
  ProjectListParams,
  ProjectNoteListParams,
  ProjectOperationalLinkListParams,
  ProjectProgressHistoryParams,
  ProjectTaskListParams,
  ProjectTimelineListParams,
  MyWorkListParams,
} from "@/types/projects";
import type { AIAttentionCenterParams } from "@/types/ai-attention-center";
import type { AIInsightsParams } from "@/types/ai-insights";
import type { AIOperationalInsightsParams } from "@/types/ai-operational-insights";
import type { AISimilarCasesParams } from "@/types/ai-similar-cases";
import type { ExecutiveAIDashboardParams } from "@/types/ai-executive-dashboard";
import type { ReportingOverviewParams } from "@/types/reporting";
import { myRequestsQueryKeys } from "@/lib/my-requests/query-keys";

export { myRequestsQueryKeys };

function stripNilParams<T extends object>(
  params?: T,
): T | Record<string, never> {
  if (!params) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params as Record<string, unknown>).filter(
      ([, value]) => value !== undefined && value !== null,
    ),
  ) as T;
}

function normalizeReportingParams(
  params?: ReportingOverviewParams,
): ReportingOverviewParams | Record<string, never> {
  if (!params) {
    return {};
  }

  const normalized: ReportingOverviewParams = {};

  for (const key of [
    "date_from",
    "date_to",
    "building",
    "organization",
    "ticket_status",
    "ticket_priority",
    "work_order_status",
    "work_order_priority",
    "inspection_status",
  ] as const) {
    const value = params[key];
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed) {
      normalized[key] = trimmed;
    }
  }

  return normalized;
}

function normalizeParams(params?: MasterDataListParams): MasterDataListParams {
  return stripNilParams(params) as MasterDataListParams;
}

export const masterDataQueryKeys = {
  all: ["master-data"] as const,
  resource: (resource: MasterDataResourceKey) =>
    ["master-data", resource] as const,
  options: (resource: MasterDataResourceKey, sessionScope: string) =>
    ["master-data", resource, "options", sessionScope] as const,
  list: (resource: MasterDataResourceKey, params?: MasterDataListParams) =>
    ["master-data", resource, normalizeParams(params)] as const,
  lifecycleList: (
    resource: MasterDataResourceKey,
    lifecycle: MasterDataLifecycle,
    params?: MasterDataListParams,
    sessionScope = "anonymous",
  ) =>
    ["master-data", resource, "lifecycle", lifecycle, normalizeParams(params), sessionScope] as const,
  detail: (resource: MasterDataResourceKey, id: string) =>
    ["master-data", resource, id] as const,
};

export const dashboardQueryKeys = {
  all: ["dashboard"] as const,
  foundationSummary: () => ["dashboard", "foundation-summary"] as const,
  systemStatus: () => ["dashboard", "system-status"] as const,
};

function normalizeRbacParams<T extends RbacListParams | PermissionListParams>(
  params?: T,
): T | Record<string, never> {
  return stripNilParams(params) as T | Record<string, never>;
}

export const rbacQueryKeys = {
  all: ["rbac"] as const,
  roleLists: () => ["rbac", "roles"] as const,
  roles: (params?: RbacListParams) =>
    ["rbac", "roles", normalizeRbacParams(params)] as const,
  role: (id: string) => ["rbac", "role", id] as const,
  rolePermissions: (id: string) => ["rbac", "role", id, "permissions"] as const,
  permissions: (params?: PermissionListParams) =>
    ["rbac", "permissions", normalizeRbacParams(params)] as const,
  permission: (id: string) => ["rbac", "permission", id] as const,
  mePermissions: () => ["rbac", "me", "permissions"] as const,
};

function normalizeUserParams(params?: UserListParams): UserListParams | Record<string, never> {
  return stripNilParams(params) as UserListParams;
}

export const usersQueryKeys = {
  all: ["users"] as const,
  lists: () => ["users", "list"] as const,
  list: (params?: UserListParams) =>
    ["users", "list", normalizeUserParams(params)] as const,
  detail: (id: string) => ["users", "detail", id] as const,
  directory: (params?: UserDirectoryParams) =>
    ["users", "directory", stripNilParams(params)] as const,
  formOptions: () => ["users", "form-options"] as const,
  roles: (id: string) => ["users", id, "roles"] as const,
};

function normalizeFmTicketParams(
  params?: FmTicketListParams,
): FmTicketListParams | Record<string, never> {
  return stripNilParams(params) as FmTicketListParams;
}

export const fmTicketsQueryKeys = {
  all: ["fm-tickets"] as const,
  list: (params?: FmTicketListParams) =>
    ["fm-tickets", normalizeFmTicketParams(params)] as const,
  detail: (id: string) => ["fm-tickets", id] as const,
  comments: (id: string) => ["fm-tickets", id, "comments"] as const,
  history: (id: string) => ["fm-tickets", id, "history"] as const,
  escalations: (id: string) => ["fm-tickets", id, "escalations"] as const,
  aiAnalyses: (id: string) => ["fm-tickets", id, "ai-analyses"] as const,
  aiAnalysis: (id: string, analysisId: string) =>
    ["fm-tickets", id, "ai-analyses", analysisId] as const,
};

function normalizeMaintenanceParams(
  params?: MaintenanceListParams,
): MaintenanceListParams | Record<string, never> {
  return stripNilParams(params) as MaintenanceListParams;
}

export const maintenanceQueryKeys = {
  all: ["maintenance"] as const,
  dashboard: (params?: MaintenanceListParams) =>
    ["maintenance", "dashboard", normalizeMaintenanceParams(params)] as const,
  list: (params?: MaintenanceListParams) =>
    ["maintenance", "list", normalizeMaintenanceParams(params)] as const,
  formOptions: () => ["maintenance", "form-options"] as const,
  detail: (id: string) => ["maintenance", "detail", id] as const,
  history: (id: string) => ["maintenance", "history", id] as const,
  assignments: (id: string) => ["maintenance", "assignments", id] as const,
  assignmentCandidates: (id: string) =>
    ["maintenance", "assignment-candidates", id] as const,
  sla: (id: string) => ["maintenance", "sla", id] as const,
  escalations: (id: string) => ["maintenance", "escalations", id] as const,
};

function normalizeInspectionParams(
  params?: InspectionListParams,
): InspectionListParams | Record<string, never> {
  return stripNilParams(params) as InspectionListParams;
}

function normalizeNotificationParams(
  params?: NotificationListParams,
): NotificationListParams | Record<string, never> {
  return stripNilParams(params) as NotificationListParams;
}

export const notificationQueryKeys = {
  all: ["notifications"] as const,
  lists: () => ["notifications", "list"] as const,
  list: (params?: NotificationListParams) =>
    ["notifications", "list", normalizeNotificationParams(params)] as const,
  detail: (id: string) => ["notifications", "detail", id] as const,
  unreadCount: () => ["notifications", "unread-count"] as const,
  preferences: () => ["notifications", "preferences"] as const,
};

export const inspectionQueryKeys = {
  all: ["inspection"] as const,
  list: (params?: InspectionListParams) =>
    ["inspection", "list", normalizeInspectionParams(params)] as const,
  formOptions: () => ["inspection", "form-options"] as const,
  detail: (id: string) => ["inspection", "detail", id] as const,
  items: (id: string) => ["inspection", "items", id] as const,
  findings: (id: string) => ["inspection", "findings", id] as const,
  attachments: (id: string) => ["inspection", "attachments", id] as const,
  comments: (id: string) => ["inspection", "comments", id] as const,
  history: (id: string) => ["inspection", "history", id] as const,
  correctiveActions: (id: string) =>
    ["inspection", "corrective-actions", id] as const,
  aiAnalysis: (id: string) => ["inspection", "ai-analysis", id] as const,
};

function normalizeProjectParams(
  params?: ProjectListParams,
): ProjectListParams | Record<string, never> {
  return stripNilParams(params) as ProjectListParams | Record<string, never>;
}

function normalizeProjectTaskParams(
  params?: ProjectTaskListParams,
): ProjectTaskListParams | Record<string, never> {
  return stripNilParams(params) as
    | ProjectTaskListParams
    | Record<string, never>;
}

function normalizeProjectNoteParams(
  params?: ProjectNoteListParams,
): ProjectNoteListParams | Record<string, never> {
  return stripNilParams(params) as
    | ProjectNoteListParams
    | Record<string, never>;
}

function normalizeProjectIssueParams(
  params?: ProjectIssueListParams,
): ProjectIssueListParams | Record<string, never> {
  return stripNilParams(params) as
    | ProjectIssueListParams
    | Record<string, never>;
}

function normalizeProjectTimelineParams(
  params?: ProjectTimelineListParams,
): ProjectTimelineListParams | Record<string, never> {
  return stripNilParams(params) as
    | ProjectTimelineListParams
    | Record<string, never>;
}

function normalizeProjectProgressHistoryParams(
  params?: ProjectProgressHistoryParams,
): ProjectProgressHistoryParams | Record<string, never> {
  return stripNilParams(params) as
    | ProjectProgressHistoryParams
    | Record<string, never>;
}

function normalizeProjectLinkParams(
  params?: ProjectOperationalLinkListParams,
): ProjectOperationalLinkListParams | Record<string, never> {
  return stripNilParams(params) as
    | ProjectOperationalLinkListParams
    | Record<string, never>;
}

function normalizeProjectLinkOptionParams(
  params?: ProjectLinkOptionParams,
): ProjectLinkOptionParams | Record<string, never> {
  return stripNilParams(params) as
    | ProjectLinkOptionParams
    | Record<string, never>;
}

export const projectsQueryKeys = {
  all: ["projects"] as const,
  list: (params?: ProjectListParams) =>
    ["projects", "list", normalizeProjectParams(params)] as const,
  metrics: (params?: ProjectListParams) =>
    ["projects", "metrics", normalizeProjectParams(params)] as const,
  myWork: (params?: Record<string, string | number | boolean | undefined>) =>
    ["projects", "my-work", stripNilParams(params)] as const,
  myWorkTasks: (params?: MyWorkListParams) =>
    ["projects", "my-work", "tasks", stripNilParams(params)] as const,
  formOptions: () => ["projects", "form-options"] as const,
  detail: (id: string) => ["projects", "detail", id] as const,
  history: (id: string) => ["projects", "history", id] as const,
  members: (id: string) => ["projects", "members", id] as const,
  taskSummary: (id: string) => ["projects", "task-summary", id] as const,
  tasks: (projectId: string) => ["projects", projectId, "tasks"] as const,
  taskList: (projectId: string, params?: ProjectTaskListParams) =>
    [
      "projects",
      projectId,
      "tasks",
      "list",
      normalizeProjectTaskParams(params),
    ] as const,
  taskDetail: (projectId: string, taskId: string) =>
    ["projects", projectId, "tasks", "detail", taskId] as const,
  taskChecklist: (projectId: string, taskId: string) =>
    ["projects", projectId, "tasks", taskId, "checklist"] as const,
  taskComments: (projectId: string, taskId: string) =>
    ["projects", projectId, "tasks", taskId, "comments"] as const,
  gantt: (projectId: string) => ["projects", projectId, "gantt"] as const,
  dependencies: (projectId: string) =>
    ["projects", projectId, "dependencies"] as const,
  taskPredecessors: (projectId: string, taskId: string) =>
    ["projects", projectId, "tasks", taskId, "predecessors"] as const,
  taskSuccessors: (projectId: string, taskId: string) =>
    ["projects", projectId, "tasks", taskId, "successors"] as const,
  taskDependencyReadiness: (projectId: string, taskId: string) =>
    [
      "projects",
      projectId,
      "tasks",
      taskId,
      "dependency-readiness",
    ] as const,
  timeline: (projectId: string) =>
    ["projects", projectId, "timeline"] as const,
  timelineList: (projectId: string, params?: ProjectTimelineListParams) =>
    [
      "projects",
      projectId,
      "timeline",
      "list",
      normalizeProjectTimelineParams(params),
    ] as const,
  progress: (projectId: string) =>
    ["projects", projectId, "progress"] as const,
  progressHistory: (
    projectId: string,
    params?: ProjectProgressHistoryParams,
  ) =>
    [
      "projects",
      projectId,
      "progress-history",
      normalizeProjectProgressHistoryParams(params),
    ] as const,
  notes: (projectId: string) => ["projects", projectId, "notes"] as const,
  noteList: (projectId: string, params?: ProjectNoteListParams) =>
    [
      "projects",
      projectId,
      "notes",
      "list",
      normalizeProjectNoteParams(params),
    ] as const,
  noteDetail: (projectId: string, noteId: string) =>
    ["projects", projectId, "notes", "detail", noteId] as const,
  issues: (projectId: string) => ["projects", projectId, "issues"] as const,
  issueList: (projectId: string, params?: ProjectIssueListParams) =>
    [
      "projects",
      projectId,
      "issues",
      "list",
      normalizeProjectIssueParams(params),
    ] as const,
  issueDetail: (projectId: string, issueId: string) =>
    ["projects", projectId, "issues", "detail", issueId] as const,
  issueComments: (projectId: string, issueId: string) =>
    ["projects", projectId, "issues", issueId, "comments"] as const,
  links: (projectId: string) => ["projects", projectId, "links"] as const,
  linkList: (projectId: string, params?: ProjectOperationalLinkListParams) =>
    [
      "projects",
      projectId,
      "links",
      "list",
      normalizeProjectLinkParams(params),
    ] as const,
  linkDetail: (projectId: string, linkId: string) =>
    ["projects", projectId, "links", "detail", linkId] as const,
  linkOptions: (projectId: string, params?: ProjectLinkOptionParams) =>
    [
      "projects",
      projectId,
      "link-options",
      normalizeProjectLinkOptionParams(params),
    ] as const,
};

export const reportingQueryKeys = {
  all: ["reporting"] as const,
  overviews: () => ["reporting", "overview"] as const,
  overview: (params?: ReportingOverviewParams) =>
    ["reporting", "overview", normalizeReportingParams(params)] as const,
  filterOptions: () => ["reporting", "filter-options"] as const,
  aiInsights: (params?: AIInsightsParams) =>
    ["reporting", "ai-insights", stripNilParams(params)] as const,
  aiOperationalInsights: (params?: AIOperationalInsightsParams) =>
    ["reporting", "ai-operational-insights", stripNilParams(params)] as const,
  aiAttentionCenter: (params?: AIAttentionCenterParams) =>
    ["reporting", "ai-attention-center", stripNilParams(params)] as const,
  aiSimilarCases: (params?: AISimilarCasesParams) =>
    ["reporting", "ai-similar-cases", stripNilParams(params)] as const,
  aiExecutiveDashboard: (params?: ExecutiveAIDashboardParams) =>
    ["reporting", "ai-executive-dashboard", stripNilParams(params)] as const,
};

export const attachmentQueryKeys = {
  all: ["attachments"] as const,
  lists: () => ["attachments", "list"] as const,
  list: (params?: {
    page?: number;
    page_size?: number;
    owner_type?: string;
    owner_id?: string;
  }) => ["attachments", "list", stripNilParams(params)] as const,
  detail: (id: string) => ["attachments", "detail", id] as const,
};
