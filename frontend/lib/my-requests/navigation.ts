import type { NavigationItem } from "@/types/rbac";

import {
  isEmployeeRequesterMode,
  type EmployeeRequesterModeInput,
} from "./requester-mode";

export const MY_REQUESTS_NAV_ITEM: NavigationItem = {
  label: "My Requests",
  href: "/my-requests",
  authenticatedOnly: true,
  requiredPermissions: ["fm_tickets.view"],
  matchStrategy: "prefix",
};

const HIDDEN_FOR_EMPLOYEE_REQUESTER = new Set([
  "/fm-tickets",
  "/maintenance",
  "/inspection/inspections",
  "/reporting",
  "/master-data",
  "/admin",
  "/admin/organization",
  "/admin/assets",
  "/admin/users",
  "/admin/roles",
  "/admin/permissions",
  "/settings",
]);

export function filterNavigationForEmployeeRequester(
  items: NavigationItem[],
  options: EmployeeRequesterModeInput & {
    isAuthenticated: boolean;
    hasPermission: (code: string) => boolean;
    hasAnyPermission: (codes: string[]) => boolean;
  },
): NavigationItem[] {
  const {
    isAuthenticated,
    hasPermission,
    hasAnyPermission,
    permissionsLoading = false,
    permissionsError = false,
  } = options;

  const requesterMode = isEmployeeRequesterMode(options);

  const permissionFiltered = items.filter((item) => {
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

    return item.requiredPermissions.every((code) => hasPermission(code));
  });

  if (!requesterMode) {
    // Operational users keep FM Ticketing; do not add a duplicate My Requests entry.
    return permissionFiltered.filter((item) => item.href !== MY_REQUESTS_NAV_ITEM.href);
  }

  return permissionFiltered.filter((item) => {
    if (item.href === "/dashboard" || item.href === MY_REQUESTS_NAV_ITEM.href) {
      return true;
    }

    if (item.href.startsWith("/master-data/")) {
      return false;
    }

    return !HIDDEN_FOR_EMPLOYEE_REQUESTER.has(item.href);
  });
}

export function shouldShowMyRequestsNav(
  input: EmployeeRequesterModeInput,
): boolean {
  return isEmployeeRequesterMode(input);
}

export function shouldShowOperationalFmTicketsNav(
  input: EmployeeRequesterModeInput & {
    hasFmTicketsView: boolean;
  },
): boolean {
  if (input.permissionsLoading || input.permissionsError) {
    return false;
  }

  if (!input.hasFmTicketsView) {
    return false;
  }

  return !isEmployeeRequesterMode(input);
}
