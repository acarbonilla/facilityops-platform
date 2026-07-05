"use client";

import {
  hasAllPermissions as hasAllPermissionsUtility,
  hasAnyPermission as hasAnyPermissionUtility,
  hasPermission as hasPermissionUtility,
} from "@/lib/auth/permissions";
import type { PermissionCode } from "@/types/rbac";

import { useAuth } from "./use-auth";

export function usePermissions() {
  const {
    permissions,
    permissionsError,
    permissionsLoading,
    refreshPermissions,
    user,
  } = useAuth();

  return {
    permissions,
    permissionsLoading,
    permissionsError,
    refreshPermissions,
    hasPermission: (permissionCode: PermissionCode) =>
      hasPermissionUtility(permissions, permissionCode, user),
    hasAnyPermission: (permissionCodes: PermissionCode[]) =>
      hasAnyPermissionUtility(permissions, permissionCodes, user),
    hasAllPermissions: (permissionCodes: PermissionCode[]) =>
      hasAllPermissionsUtility(permissions, permissionCodes, user),
  };
}
