import {
  type AuthUser,
  type LoginCredentials,
  type LoginResponse,
  type RefreshTokenResponse,
} from "@/types/auth";

import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

export function login(credentials: LoginCredentials): Promise<LoginResponse> {
  return apiClient<LoginResponse>(API_ENDPOINTS.auth.login, {
    method: "POST",
    body: credentials,
  });
}

export function refreshToken(refresh: string): Promise<RefreshTokenResponse> {
  return apiClient<RefreshTokenResponse>(API_ENDPOINTS.auth.refresh, {
    method: "POST",
    body: { refresh },
  });
}

export function logout(refresh: string): Promise<{ detail: string }> {
  return apiClient<{ detail: string }>(API_ENDPOINTS.auth.logout, {
    method: "POST",
    body: { refresh },
  });
}

export function getCurrentUser(): Promise<AuthUser> {
  return apiClient<AuthUser>(API_ENDPOINTS.auth.me, { method: "GET" });
}
