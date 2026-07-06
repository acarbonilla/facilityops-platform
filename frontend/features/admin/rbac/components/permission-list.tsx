"use client";

import { useQuery } from "@tanstack/react-query";

import { DetailField } from "@/components/common/detail-field";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { getPermissions } from "@/services/api/rbac";
import { rbacQueryKeys } from "@/services/api/query-keys";

import {
  PermissionGroupSection,
  groupPermissionsByModule,
} from "./permission-group";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function PermissionListScreen() {
  const permissionsQuery = useQuery({
    queryKey: rbacQueryKeys.permissions(),
    queryFn: () => getPermissions(),
  });

  const permissions = permissionsQuery.data ?? [];
  const groupedPermissions = groupPermissionsByModule(permissions);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review the active RBAC permission catalog grouped by backend module. This screen is read-only and mirrors the backend authorization boundary, which currently requires roles.manage."
        eyebrow="RBAC administration"
        title="Permissions"
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField label="Visible permissions" value={permissions.length} />
          <DetailField label="Modules" value={groupedPermissions.length} />
          <DetailField label="Backend guard" value="roles.manage" />
        </dl>
      </PageHeader>

      {permissionsQuery.isPending ? (
        <LoadingState
          title="Loading permissions"
          message="Retrieving the RBAC permission catalog from the backend."
        />
      ) : null}

      {!permissionsQuery.isPending && permissionsQuery.isError ? (
        <ErrorState
          title="Unable to load permissions"
          message={getErrorMessage(
            permissionsQuery.error,
            "The permissions list could not be loaded.",
          )}
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => void permissionsQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          }
        />
      ) : null}

      {!permissionsQuery.isPending &&
      !permissionsQuery.isError &&
      groupedPermissions.length === 0 ? (
        <EmptyState
          title="No permissions found"
          message="No active RBAC permissions are currently available from the backend."
        />
      ) : null}

      {!permissionsQuery.isPending &&
      !permissionsQuery.isError &&
      groupedPermissions.length > 0
        ? groupedPermissions.map((group) => (
            <PermissionGroupSection group={group} key={group.module} />
          ))
        : null}
    </div>
  );
}
