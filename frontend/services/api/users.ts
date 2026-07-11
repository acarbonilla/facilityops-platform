import { ApiError } from "./types";
import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import type { PaginatedResponse } from "@/services/api/types";
import type {
  ReplaceUserRolesPayload,
  UserAssignedRole,
  UserCreatePayload,
  UserDirectoryItem,
  UserDirectoryParams,
  UserListParams,
  UserRecord,
  UserRoleAssignmentResponse,
  UserUpdatePayload,
} from "@/types/users";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeAssignedRole(value: unknown): UserAssignedRole {
  if (!isRecord(value)) {
    throw new ApiError("The backend returned an invalid user role response.");
  }

  return {
    id: String(value.id ?? ""),
    name: typeof value.name === "string" ? value.name : "",
    code: typeof value.code === "string" ? value.code : "",
    description: typeof value.description === "string" ? value.description : "",
    is_system_role: Boolean(value.is_system_role),
  };
}

function normalizeUserRoleAssignmentResponse(
  payload: unknown,
): UserRoleAssignmentResponse {
  if (!isRecord(payload) || !isRecord(payload.user)) {
    throw new ApiError(
      "The backend returned an invalid user role assignment response.",
    );
  }

  return {
    user: {
      id: String(payload.user.id ?? ""),
      email: typeof payload.user.email === "string" ? payload.user.email : "",
      first_name:
        typeof payload.user.first_name === "string" ? payload.user.first_name : "",
      last_name:
        typeof payload.user.last_name === "string" ? payload.user.last_name : "",
    },
    assigned_roles: Array.isArray(payload.assigned_roles)
      ? payload.assigned_roles.map(normalizeAssignedRole)
      : [],
    available_roles: Array.isArray(payload.available_roles)
      ? payload.available_roles.map(normalizeAssignedRole)
      : [],
  };
}

export function getUsers(
  params?: UserListParams,
): Promise<PaginatedResponse<UserRecord>> {
  return apiClient<PaginatedResponse<UserRecord>>(API_ENDPOINTS.users.list, {
    method: "GET",
    query: params,
  });
}

export function getUser(id: string): Promise<UserRecord> {
  return apiClient<UserRecord>(API_ENDPOINTS.users.detail(id), {
    method: "GET",
  });
}

export function createUser(payload: UserCreatePayload): Promise<UserRecord> {
  return apiClient<UserRecord>(API_ENDPOINTS.users.list, {
    method: "POST",
    body: payload,
  });
}

export function updateUser(
  id: string,
  payload: UserUpdatePayload,
): Promise<UserRecord> {
  return apiClient<UserRecord>(API_ENDPOINTS.users.detail(id), {
    method: "PATCH",
    body: payload,
  });
}

export function deactivateUser(id: string): Promise<void> {
  return apiClient<void>(API_ENDPOINTS.users.detail(id), {
    method: "DELETE",
  });
}

export function getUserDirectory(
  params?: UserDirectoryParams,
): Promise<PaginatedResponse<UserDirectoryItem>> {
  return apiClient<PaginatedResponse<UserDirectoryItem>>(
    API_ENDPOINTS.users.directory,
    { method: "GET", query: params },
  );
}

export async function getUserRoleAssignments(
  id: string,
): Promise<UserRoleAssignmentResponse> {
  const payload = await apiClient<UserRoleAssignmentResponse>(
    API_ENDPOINTS.users.roles(id),
    { method: "GET" },
  );

  return normalizeUserRoleAssignmentResponse(payload);
}

export async function replaceUserRoleAssignments(
  id: string,
  payload: ReplaceUserRolesPayload,
): Promise<UserRoleAssignmentResponse> {
  const response = await apiClient<UserRoleAssignmentResponse>(
    API_ENDPOINTS.users.roles(id),
    {
      method: "PUT",
      body: payload,
    },
  );

  return normalizeUserRoleAssignmentResponse(response);
}

export function getUserManagementCapabilities() {
  return {
    list: true,
    create: true,
    detail: true,
    update: true,
    roles: true,
    deactivate: true,
    directory: true,
  };
}

export function getUserManagementEndpointDiscovery() {
  return {
    list: API_ENDPOINTS.users.list,
    create: API_ENDPOINTS.users.list,
    detail: API_ENDPOINTS.users.detail("{id}"),
    update: API_ENDPOINTS.users.detail("{id}"),
    roles: API_ENDPOINTS.users.roles("{id}"),
    deactivate: API_ENDPOINTS.users.detail("{id}"),
    directory: API_ENDPOINTS.users.directory,
  };
}
