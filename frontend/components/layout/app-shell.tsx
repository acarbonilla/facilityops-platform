import type { ReactNode } from "react";

import { AppShellProvider } from "@/hooks/use-app-shell";

import { Header } from "./header";
import { MainContent } from "./main-content";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppShellProvider>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Header />
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <Sidebar />
          <MainContent>{children}</MainContent>
        </div>
      </div>
    </AppShellProvider>
  );
}
