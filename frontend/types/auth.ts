import type { PermissionCode } from "./rbac";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  tenant: string | null;
  organization: string | null;
  is_staff: boolean;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: Omit<AuthUser, "is_staff">;
}

export interface RefreshTokenResponse {
  access: string;
  refresh: string;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  /** Active role codes from /access-control/me/permissions/. */
  roles: string[];
  permissions: PermissionCode[];
  permissionsLoading: boolean;
  permissionsError: string | null;
}
