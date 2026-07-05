"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
} from "@/services/api/auth";
import { getCurrentUserPermissions } from "@/services/api/rbac";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/auth/token-storage";
import type { AuthState, LoginCredentials } from "@/types/auth";

export interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

const INITIAL_STATE: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  permissions: [],
  permissionsLoading: false,
  permissionsError: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  const refreshPermissions = useCallback(async () => {
    if (!getAccessToken()) {
      setState((current) => ({
        ...current,
        permissions: [],
        permissionsLoading: false,
        permissionsError: null,
      }));
      return;
    }

    setState((current) => ({
      ...current,
      permissionsLoading: true,
      permissionsError: null,
    }));

    try {
      const response = await getCurrentUserPermissions();
      setState((current) => ({
        ...current,
        permissions: response.permissions,
        permissionsLoading: false,
        permissionsError: null,
      }));
    } catch {
      setState((current) => ({
        ...current,
        permissions: [],
        permissionsLoading: false,
        permissionsError:
          "Permissions could not be loaded. Permission-based navigation may be limited.",
      }));
    }
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    if (!getAccessToken()) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        permissions: [],
        permissionsLoading: false,
        permissionsError: null,
      });
      return;
    }

    setState((current) => ({ ...current, isLoading: true, error: null }));
    try {
      const user = await getCurrentUser();
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        permissions: [],
        permissionsLoading: false,
        permissionsError: null,
      });
      await refreshPermissions();
    } catch {
      clearTokens();
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: "Your session could not be restored. Please sign in again.",
        permissions: [],
        permissionsLoading: false,
        permissionsError: null,
      });
    }
  }, [refreshPermissions]);

  useEffect(() => {
    void refreshCurrentUser();
  }, [refreshCurrentUser]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setState((current) => ({ ...current, isLoading: true, error: null }));
    try {
      const response = await loginRequest(credentials);
      setTokens(response.access, response.refresh);
      const user = await getCurrentUser();
      setState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        permissions: [],
        permissionsLoading: false,
        permissionsError: null,
      });
      await refreshPermissions();
    } catch (error) {
      clearTokens();
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: "Sign-in failed. Check your credentials and try again.",
        permissions: [],
        permissionsLoading: false,
        permissionsError: null,
      });
      throw error;
    }
  }, [refreshPermissions]);

  const logout = useCallback(async () => {
    setState((current) => ({ ...current, isLoading: true, error: null }));
    const refresh = getRefreshToken();

    try {
      if (refresh) {
        await logoutRequest(refresh);
      }
    } catch {
      // Local session cleanup must succeed even if the backend is unavailable.
    } finally {
      clearTokens();
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        permissions: [],
        permissionsLoading: false,
        permissionsError: null,
      });
      router.replace("/login");
      router.refresh();
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      refreshCurrentUser,
      refreshPermissions,
    }),
    [login, logout, refreshCurrentUser, refreshPermissions, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
