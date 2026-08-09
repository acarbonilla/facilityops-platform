"use client";

import { UserMenu } from "@/components/auth/user-menu";
import { MobileNavTrigger } from "@/components/layout/sidebar";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { useAuth } from "@/hooks/use-auth";
import { APP_NAME } from "@/lib/constants";

export function Header() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <MobileNavTrigger />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">{APP_NAME}</p>
          <p className="hidden truncate text-xs text-slate-500 sm:block">
            Operations workspace
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
          <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200" />
          <div className="hidden sm:block">
            <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-40 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ) : isAuthenticated ? (
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <NotificationBell />
          <UserMenu />
        </div>
      ) : (
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Foundation
        </span>
      )}
    </header>
  );
}
