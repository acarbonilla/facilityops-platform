"use client";

import { useState } from "react";

import { useAuth } from "@/hooks/use-auth";
import { APP_NAME } from "@/lib/constants";

export function Header() {
  const { isAuthenticated, logout, user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    await logout();
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <div>
        <p className="text-sm font-semibold text-slate-950">{APP_NAME}</p>
        <p className="text-xs text-slate-500">Operations workspace</p>
      </div>
      {isAuthenticated ? (
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-600 sm:inline">
            {user?.email}
          </span>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoggingOut}
            onClick={handleLogout}
            type="button"
          >
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : (
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Foundation
        </span>
      )}
    </header>
  );
}
