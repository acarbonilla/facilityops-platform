export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
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
}
