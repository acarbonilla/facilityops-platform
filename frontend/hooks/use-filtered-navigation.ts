"use client";

import { useMemo } from "react";

import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { APP_NAVIGATION } from "@/lib/navigation";
import { filterNavigationForEmployeeRequester } from "@/lib/my-requests/navigation";
import { canAccessMyWorkNav } from "@/lib/projects/my-work";
import type { NavigationItem } from "@/types/rbac";

/** Single RBAC-filtered navigation source for desktop rail and mobile drawer. */
export function useFilteredNavigation(): {
  items: NavigationItem[];
  permissionsLoading: boolean;
  permissionsError: unknown;
  isEmployeeRequesterMode: boolean;
  isAuthenticated: boolean;
} {
  const { isAuthenticated } = useAuth();
  const {
    hasAnyPermission,
    hasPermission,
    isEmployeeRequesterMode,
    permissions,
    permissionsError,
    permissionsLoading,
    roles,
  } = usePermissions();

  const items = useMemo(
    () =>
      filterNavigationForEmployeeRequester(APP_NAVIGATION, {
        isAuthenticated,
        roles,
        permissions,
        permissionsLoading,
        permissionsError,
        hasPermission: (code) => hasPermission(code as never),
        hasAnyPermission: (codes) => hasAnyPermission(codes as never[]),
      }).filter((item) => {
        if (item.href !== "/my-work") {
          return true;
        }
        return canAccessMyWorkNav({
          roles,
          hasPermission: (code) => hasPermission(code as never),
        });
      }),
    [
      hasAnyPermission,
      hasPermission,
      isAuthenticated,
      permissions,
      permissionsError,
      permissionsLoading,
      roles,
    ],
  );

  return {
    items,
    permissionsLoading,
    permissionsError,
    isEmployeeRequesterMode,
    isAuthenticated,
  };
}
