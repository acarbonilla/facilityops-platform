"use client";

import type { ReactNode } from "react";

import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { UnauthorizedState } from "@/components/common/unauthorized-state";
import { usePermissions } from "@/hooks/use-permissions";
import type { PermissionCode, PermissionGuardMode } from "@/types/rbac";

export interface PermissionGuardProps {
  children: ReactNode;
  requiredPermission?: PermissionCode;
  requiredPermissions?: PermissionCode[];
  mode?: PermissionGuardMode;
  fallback?: ReactNode;
}

function getRequiredPermissions({
  requiredPermission,
  requiredPermissions = [],
}: Pick<PermissionGuardProps, "requiredPermission" | "requiredPermissions">): PermissionCode[] {
  return [...requiredPermissions, requiredPermission]
    .filter((permissionCode): permissionCode is PermissionCode => Boolean(permissionCode))
    .map((permissionCode) => permissionCode.trim())
    .filter(Boolean);
}

export function PermissionGuard({
  children,
  fallback,
  mode = "all",
  requiredPermission,
  requiredPermissions,
}: PermissionGuardProps) {
  const {
    hasAllPermissions,
    hasAnyPermission,
    permissionsError,
    permissionsLoading,
    refreshPermissions,
  } = usePermissions();
  const normalizedRequiredPermissions = getRequiredPermissions({
    requiredPermission,
    requiredPermissions,
  });

  if (normalizedRequiredPermissions.length === 0) {
    return children;
  }

  if (permissionsLoading) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <LoadingState
          title="Loading permissions"
          message="Checking which FacilityOps routes are available for your account."
        />
      </div>
    );
  }

  if (permissionsError) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <ErrorState
          title="Permissions unavailable"
          message={permissionsError}
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => void refreshPermissions()}
              type="button"
            >
              Retry permissions
            </button>
          }
        />
      </div>
    );
  }

  const isAllowed =
    mode === "any"
      ? hasAnyPermission(normalizedRequiredPermissions)
      : hasAllPermissions(normalizedRequiredPermissions);

  if (!isAllowed) {
    return fallback ?? <UnauthorizedState />;
  }

  return children;
}
