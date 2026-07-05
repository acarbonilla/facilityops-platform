import { ApiError } from "./types";
import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import type { UserPermissionsResponse } from "@/types/rbac";

function normalizePermissionsPayload(
  payload: UserPermissionsResponse,
): UserPermissionsResponse {
  return {
    roles: Array.isArray(payload.roles) ? payload.roles : [],
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
  };
}

export async function getCurrentUserPermissions(): Promise<UserPermissionsResponse> {
  const payload = await apiClient<UserPermissionsResponse>(
    API_ENDPOINTS.accessControl.mePermissions,
    { method: "GET" },
  );

  if (!payload || typeof payload !== "object") {
    throw new ApiError("The backend returned an invalid permissions response.");
  }

  return normalizePermissionsPayload(payload);
}
