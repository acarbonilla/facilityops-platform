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
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);

const INITIAL_STATE: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  const refreshCurrentUser = useCallback(async () => {
    if (!getAccessToken()) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
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
      });
    } catch {
      clearTokens();
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: "Your session could not be restored. Please sign in again.",
      });
    }
  }, []);

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
      });
    } catch (error) {
      clearTokens();
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: "Sign-in failed. Check your credentials and try again.",
      });
      throw error;
    }
  }, []);

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
    }),
    [login, logout, refreshCurrentUser, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
