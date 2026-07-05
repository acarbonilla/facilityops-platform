"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { APP_NAVIGATION } from "@/lib/navigation";

export function Sidebar() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const {
    hasAllPermissions,
    hasAnyPermission,
    permissionsError,
    permissionsLoading,
  } = usePermissions();

  const visibleNavigation = APP_NAVIGATION.filter((item) => {
    if (item.authenticatedOnly && !isAuthenticated) {
      return false;
    }

    if (!item.requiredPermissions || item.requiredPermissions.length === 0) {
      return true;
    }

    if (permissionsLoading || permissionsError) {
      return false;
    }

    if (item.permissionMode === "any") {
      return hasAnyPermission(item.requiredPermissions);
    }

    return hasAllPermissions(item.requiredPermissions);
  });

  return (
    <aside className="border-b border-slate-200 bg-slate-950 px-3 py-3 text-slate-300 md:w-60 md:border-b-0 md:border-r md:py-6">
      <nav aria-label="Primary navigation">
        {permissionsLoading ? (
          <p className="px-3 py-2 text-sm text-slate-400">
            Loading navigation access...
          </p>
        ) : null}

        {visibleNavigation.length > 0 ? (
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {visibleNavigation.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <li key={item.href}>
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      "block whitespace-nowrap rounded-md px-3 py-2 text-sm transition",
                      isActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-200",
                    ].join(" ")}
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-md border border-slate-800 bg-slate-900 px-3 py-4 text-sm text-slate-400">
            <p className="font-medium text-slate-200">
              {isAuthenticated ? "No routes available" : "Navigation locked"}
            </p>
            <p className="mt-1">
              {isAuthenticated
                ? "This account does not currently expose any permission-based sections."
                : "Sign in to load the application navigation."}
            </p>
          </div>
        )}

        {permissionsError ? (
          <p className="mt-3 px-3 text-xs text-amber-300">
            Permission-based items are hidden until permissions can be loaded again.
          </p>
        ) : null}
      </nav>
    </aside>
  );
}
