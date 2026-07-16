import type { MasterDataListParams, MasterDataResourceKey } from "@/types/master-data";
import type { PermissionListParams, RbacListParams } from "@/types/rbac";
import type { UserDirectoryParams, UserListParams } from "@/types/users";
import type { FmTicketListParams } from "@/types/fm-tickets";
import type { InspectionListParams } from "@/types/inspection";
import type { MaintenanceListParams } from "@/types/maintenance";
import type { NotificationListParams } from "@/types/notifications";
import type { ReportingOverviewParams } from "@/types/reporting";

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

  for (const key of ["date_from", "date_to", "building", "organization"] as const) {
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
  list: (resource: MasterDataResourceKey, params?: MasterDataListParams) =>
    ["master-data", resource, normalizeParams(params)] as const,
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

export const reportingQueryKeys = {
  all: ["reporting"] as const,
  overviews: () => ["reporting", "overview"] as const,
  overview: (params?: ReportingOverviewParams) =>
    ["reporting", "overview", normalizeReportingParams(params)] as const,
  filterOptions: () => ["reporting", "filter-options"] as const,
};
