"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { LoadingState } from "@/components/common/loading-state";
import { UnauthorizedState } from "@/components/common/unauthorized-state";
import { usePermissions } from "@/hooks/use-permissions";
import { resolveEmployeeFmTicketRedirect } from "@/lib/my-requests/routes";
import type { PermissionCode } from "@/types/rbac";

export interface ProtectedEmployeeRequesterRouteProps {
  children: ReactNode;
  requiredPermission: PermissionCode;
}

export function ProtectedEmployeeRequesterRoute({
  children,
  requiredPermission,
}: ProtectedEmployeeRequesterRouteProps) {
  const {
    isEmployeeRequesterMode,
    permissionsError,
    permissionsLoading,
  } = usePermissions();

  if (permissionsLoading) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <LoadingState
          title="Loading request access"
          message="Confirming Employee requester access for My Requests."
        />
      </div>
    );
  }

  if (permissionsError || !isEmployeeRequesterMode) {
    return (
      <ProtectedPermissionRoute requiredPermission={requiredPermission}>
        <div className="mx-auto max-w-xl p-6">
          <UnauthorizedState />
        </div>
      </ProtectedPermissionRoute>
    );
  }

  return (
    <ProtectedPermissionRoute requiredPermission={requiredPermission}>
      {children}
    </ProtectedPermissionRoute>
  );
}

export function EmployeeFmTicketRedirect({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    isEmployeeRequesterMode,
    permissionsError,
    permissionsLoading,
  } = usePermissions();

  useEffect(() => {
    if (permissionsLoading || permissionsError || !isEmployeeRequesterMode) {
      return;
    }

    const target = resolveEmployeeFmTicketRedirect(pathname, true);
    if (target) {
      router.replace(target);
    }
  }, [
    isEmployeeRequesterMode,
    pathname,
    permissionsError,
    permissionsLoading,
    router,
  ]);

  if (permissionsLoading) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <LoadingState
          title="Checking request access"
          message="Preparing the correct request experience for your account."
        />
      </div>
    );
  }

  if (isEmployeeRequesterMode) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <LoadingState
          title="Opening My Requests"
          message="Redirecting to your requester-safe requests experience."
        />
      </div>
    );
  }

  return children;
}
