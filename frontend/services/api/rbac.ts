import { ApiError } from "./types";
import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import type {
  Permission,
  PermissionListParams,
  PermissionListResponse,
  Role,
  RoleDetailResponse,
  RbacListParams,
  RoleListResponse,
  RolePermission,
  UserPermissionsResponse,
} from "@/types/rbac";

type ApiQueryParams = Record<
  string,
  string | number | boolean | Array<string | number | boolean> | null | undefined
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeQueryParams(
  params?: RbacListParams | PermissionListParams,
): ApiQueryParams | undefined {
  if (!params) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined),
  );
}

function normalizeRole(value: unknown): Role {
  if (!isRecord(value)) {
    throw new ApiError("The backend returned an invalid role response.");
  }

  return {
    id: String(value.id ?? ""),
    name: typeof value.name === "string" ? value.name : "",
    code: typeof value.code === "string" ? value.code : "",
    description: typeof value.description === "string" ? value.description : "",
    is_system_role: Boolean(value.is_system_role),
    is_active: Boolean(value.is_active),
  };
}

function normalizePermission(value: unknown): Permission {
  if (!isRecord(value)) {
    throw new ApiError("The backend returned an invalid permission response.");
  }

  return {
    id: String(value.id ?? ""),
    name: typeof value.name === "string" ? value.name : "",
    code: typeof value.code === "string" ? value.code : "",
    module: typeof value.module === "string" ? value.module : "",
    action: typeof value.action === "string" ? value.action : "",
    description: typeof value.description === "string" ? value.description : "",
    is_active: Boolean(value.is_active),
  };
}

function normalizeRolePermission(value: unknown): RolePermission {
  if (!isRecord(value)) {
    throw new ApiError("The backend returned an invalid role permission response.");
  }

  const permissionValue = value.permission;
  const roleValue = value.role;

  return {
    id: value.id === undefined || value.id === null ? undefined : String(value.id),
    role:
      typeof roleValue === "string" || !isRecord(roleValue)
        ? String(roleValue ?? "")
        : normalizeRole(roleValue),
    permission:
      typeof permissionValue === "string" || !isRecord(permissionValue)
        ? String(permissionValue ?? "")
        : normalizePermission(permissionValue),
    is_active: Boolean(value.is_active),
  };
}

function normalizeRolesPayload(payload: unknown): RoleListResponse {
  if (!Array.isArray(payload)) {
    throw new ApiError("The backend returned an invalid roles response.");
  }

  return payload.map(normalizeRole);
}

function normalizePermissionListPayload(payload: unknown): PermissionListResponse {
  if (!Array.isArray(payload)) {
    throw new ApiError("The backend returned an invalid permissions response.");
  }

  return payload.map(normalizePermission);
}

function normalizeUserPermissionsPayload(
  payload: UserPermissionsResponse,
): UserPermissionsResponse {
  return {
    roles: Array.isArray(payload.roles) ? payload.roles : [],
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
  };
}

function normalizeRoleDetailPayload(payload: unknown): RoleDetailResponse {
  const role = normalizeRole(payload);

  if (!isRecord(payload)) {
    return role;
  }

  return {
    ...role,
    permissions: Array.isArray(payload.permissions)
      ? payload.permissions.map(normalizePermission)
      : undefined,
    role_permissions: Array.isArray(payload.role_permissions)
      ? payload.role_permissions.map(normalizeRolePermission)
      : undefined,
  };
}

function normalizePermissionDetailPayload(payload: unknown): Permission {
  return normalizePermission(payload);
}

export async function getRoles(params?: RbacListParams): Promise<RoleListResponse> {
  const payload = await apiClient<RoleListResponse>(API_ENDPOINTS.accessControl.roles, {
    method: "GET",
    query: normalizeQueryParams(params),
  });

  return normalizeRolesPayload(payload);
}

export async function getRole(id: string): Promise<RoleDetailResponse> {
  try {
    const payload = await apiClient<RoleDetailResponse>(
      API_ENDPOINTS.accessControl.role(id),
      { method: "GET" },
    );

    return normalizeRoleDetailPayload(payload);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }
  }

  const roles = await getRoles();
  const role = roles.find((item) => item.id === id);

  if (!role) {
    throw new ApiError("The requested role could not be found.", 404);
  }

  return role;
}

export async function getPermissions(
  params?: PermissionListParams,
): Promise<PermissionListResponse> {
  const payload = await apiClient<PermissionListResponse>(
    API_ENDPOINTS.accessControl.permissions,
    {
      method: "GET",
      query: normalizeQueryParams(params),
    },
  );

  return normalizePermissionListPayload(payload);
}

export async function getPermission(id: string): Promise<Permission> {
  try {
    const payload = await apiClient<Permission>(
      API_ENDPOINTS.accessControl.permission(id),
      { method: "GET" },
    );

    return normalizePermissionDetailPayload(payload);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }
  }

  const permissions = await getPermissions();
  const permission = permissions.find((item) => item.id === id);

  if (!permission) {
    throw new ApiError("The requested permission could not be found.", 404);
  }

  return permission;
}

export async function getCurrentUserPermissions(): Promise<UserPermissionsResponse> {
  const payload = await apiClient<UserPermissionsResponse>(
    API_ENDPOINTS.accessControl.mePermissions,
    { method: "GET" },
  );

  if (!payload || typeof payload !== "object") {
    throw new ApiError("The backend returned an invalid permissions response.");
  }

  return normalizeUserPermissionsPayload(payload);
}
