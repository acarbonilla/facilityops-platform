"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useAppShell } from "@/hooks/use-app-shell";

function usesDenseContentWidth(pathname: string): boolean {
  return (
    pathname.includes("/gantt") ||
    pathname.startsWith("/reporting") ||
    pathname.startsWith("/fm-tickets") ||
    pathname.startsWith("/maintenance") ||
    pathname.includes("/tasks") ||
    pathname.includes("/progress") ||
    pathname.startsWith("/my-work")
  );
}

export function MainContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { desktopCollapsed, preferenceReady } = useAppShell();
  const collapsed = preferenceReady ? desktopCollapsed : false;
  const dense = usesDenseContentWidth(pathname);
  const maxWidthClass =
    dense || collapsed ? "max-w-none" : "max-w-5xl";

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className={`mx-auto w-full ${maxWidthClass}`}>{children}</div>
    </main>
  );
}
