import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import type { PaginatedResponse } from "@/services/api/types";
import type {
  UserCreatePayload,
  UserDirectoryItem,
  UserDirectoryParams,
  UserListParams,
  UserRecord,
  UserUpdatePayload,
} from "@/types/users";

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

export function getUserManagementCapabilities() {
  return {
    list: true,
    create: true,
    detail: true,
    update: true,
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
    deactivate: API_ENDPOINTS.users.detail("{id}"),
    directory: API_ENDPOINTS.users.directory,
  };
}
