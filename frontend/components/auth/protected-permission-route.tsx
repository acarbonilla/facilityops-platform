"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { LoadingState } from "@/components/common/loading-state";
import type { PermissionCode, PermissionGuardMode } from "@/types/rbac";

import { PermissionGuard } from "./permission-guard";

import { useAuth } from "@/hooks/use-auth";

export interface ProtectedPermissionRouteProps {
  children: ReactNode;
  requiredPermission?: PermissionCode;
  requiredPermissions?: PermissionCode[];
  mode?: PermissionGuardMode;
}

export function ProtectedPermissionRoute({
  children,
  mode = "all",
  requiredPermission,
  requiredPermissions,
}: ProtectedPermissionRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <LoadingState
          title="Loading your session"
          message="Confirming your FacilityOps account."
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <LoadingState
          title="Redirecting to sign in"
          message="Authentication is required to access this page."
        />
      </div>
    );
  }

  return (
    <PermissionGuard
      mode={mode}
      requiredPermission={requiredPermission}
      requiredPermissions={requiredPermissions}
    >
      {children}
    </PermissionGuard>
  );
}
