import type { NavigationItem } from "@/types/rbac";

export const REPORTING_PERMISSION = "reporting.view";

export function canViewReportingNav(
  permissions: readonly string[] | undefined | null,
): boolean {
  if (!permissions || permissions.length === 0) {
    return false;
  }
  return permissions.includes(REPORTING_PERMISSION);
}

export function filterNavigationForPermissions(
  items: NavigationItem[],
  options: {
    isAuthenticated: boolean;
    permissions: readonly string[];
    permissionsLoading?: boolean;
    permissionsError?: boolean;
  },
): NavigationItem[] {
  const {
    isAuthenticated,
    permissions,
    permissionsError = false,
    permissionsLoading = false,
  } = options;

  return items.filter((item) => {
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
      return item.requiredPermissions.some((code) =>
        permissions.includes(code),
      );
    }

    return item.requiredPermissions.every((code) =>
      permissions.includes(code),
    );
  });
}
