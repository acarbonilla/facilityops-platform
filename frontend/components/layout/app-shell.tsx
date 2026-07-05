import type { ReactNode } from "react";

import { Header } from "./header";
import { MainContent } from "./main-content";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar />
        <MainContent>{children}</MainContent>
      </div>
    </div>
  );
}
