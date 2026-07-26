"use client";

import {
  hasAllPermissions as hasAllPermissionsUtility,
  hasAnyPermission as hasAnyPermissionUtility,
  hasPermission as hasPermissionUtility,
} from "@/lib/auth/permissions";
import { isEmployeeRequesterMode } from "@/lib/my-requests/requester-mode";
import type { PermissionCode } from "@/types/rbac";

import { useAuth } from "./use-auth";

export function usePermissions() {
  const {
    permissions,
    permissionsError,
    permissionsLoading,
    refreshPermissions,
    roles,
    user,
  } = useAuth();

  const requesterModeInput = {
    roles,
    permissions,
    permissionsLoading,
    permissionsError,
    isStaff: user?.is_staff,
  };

  return {
    roles,
    permissions,
    permissionsLoading,
    permissionsError,
    refreshPermissions,
    isEmployeeRequesterMode: isEmployeeRequesterMode(requesterModeInput),
    hasPermission: (permissionCode: PermissionCode) =>
      hasPermissionUtility(permissions, permissionCode, user),
    hasAnyPermission: (permissionCodes: PermissionCode[]) =>
      hasAnyPermissionUtility(permissions, permissionCodes, user),
    hasAllPermissions: (permissionCodes: PermissionCode[]) =>
      hasAllPermissionsUtility(permissions, permissionCodes, user),
  };
}
