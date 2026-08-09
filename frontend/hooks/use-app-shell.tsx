"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  readSidebarCollapsedPreference,
  writeSidebarCollapsedPreference,
} from "@/lib/layout/sidebar-preference";

interface AppShellContextValue {
  desktopCollapsed: boolean;
  setDesktopCollapsed: (collapsed: boolean) => void;
  toggleDesktopCollapsed: () => void;
  preferenceReady: boolean;
  mobileNavOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [desktopCollapsed, setDesktopCollapsedState] = useState(false);
  const [preferenceReady, setPreferenceReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const stored = readSidebarCollapsedPreference();
    if (stored !== null) {
      setDesktopCollapsedState(stored);
    }
    setPreferenceReady(true);
  }, []);

  const setDesktopCollapsed = useCallback((collapsed: boolean) => {
    setDesktopCollapsedState(collapsed);
    writeSidebarCollapsedPreference(collapsed);
  }, []);

  const toggleDesktopCollapsed = useCallback(() => {
    setDesktopCollapsedState((current) => {
      const next = !current;
      writeSidebarCollapsedPreference(next);
      return next;
    });
  }, []);

  const openMobileNav = useCallback(() => setMobileNavOpen(true), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  const value = useMemo(
    () => ({
      desktopCollapsed,
      setDesktopCollapsed,
      toggleDesktopCollapsed,
      preferenceReady,
      mobileNavOpen,
      openMobileNav,
      closeMobileNav,
    }),
    [
      desktopCollapsed,
      setDesktopCollapsed,
      toggleDesktopCollapsed,
      preferenceReady,
      mobileNavOpen,
      openMobileNav,
      closeMobileNav,
    ],
  );

  return (
    <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>
  );
}

export function useAppShell(): AppShellContextValue {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error("useAppShell must be used within AppShellProvider");
  }
  return context;
}
