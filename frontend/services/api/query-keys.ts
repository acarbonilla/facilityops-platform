import type { MasterDataListParams, MasterDataResourceKey } from "@/types/master-data";
import type { PermissionListParams, RbacListParams } from "@/types/rbac";
import type { UserListParams } from "@/types/users";

function normalizeParams(params?: MasterDataListParams): MasterDataListParams {
  if (!params) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ) as MasterDataListParams;
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
  if (!params) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ) as T;
}

export const rbacQueryKeys = {
  all: ["rbac"] as const,
  roles: (params?: RbacListParams) =>
    ["rbac", "roles", normalizeRbacParams(params)] as const,
  role: (id: string) => ["rbac", "role", id] as const,
  permissions: (params?: PermissionListParams) =>
    ["rbac", "permissions", normalizeRbacParams(params)] as const,
  permission: (id: string) => ["rbac", "permission", id] as const,
  mePermissions: () => ["rbac", "me", "permissions"] as const,
};

function normalizeUserParams(params?: UserListParams): UserListParams | Record<string, never> {
  if (!params) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  ) as UserListParams;
}

export const usersQueryKeys = {
  all: ["users"] as const,
  list: (params?: UserListParams) => ["users", normalizeUserParams(params)] as const,
  detail: (id: string) => ["users", id] as const,
  roles: (id: string) => ["users", id, "roles"] as const,
};
