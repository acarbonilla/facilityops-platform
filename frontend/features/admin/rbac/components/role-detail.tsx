"use client";

import { useQuery } from "@tanstack/react-query";

import { DetailField } from "@/components/common/detail-field";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { getRole } from "@/services/api/rbac";
import { rbacQueryKeys } from "@/services/api/query-keys";
import type { Permission, RoleDetailResponse } from "@/types/rbac";

import {
  PermissionGroupSection,
  groupPermissionsByModule,
} from "./permission-group";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function StatusBadge({
  isActive,
  activeLabel = "Active",
  inactiveLabel = "Inactive",
}: {
  isActive: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
}) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700",
      ].join(" ")}
    >
      {isActive ? activeLabel : inactiveLabel}
    </span>
  );
}

function getAssignedPermissions(role: RoleDetailResponse): Permission[] {
  if (Array.isArray(role.permissions)) {
    return role.permissions;
  }

  if (!Array.isArray(role.role_permissions)) {
    return [];
  }

  return role.role_permissions
    .map((assignment) => assignment.permission)
    .filter((permission): permission is Permission =>
      typeof permission === "object" && permission !== null && "code" in permission,
    );
}

export function RoleDetailScreen({ id }: { id: string }) {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("roles.manage");
  const roleQuery = useQuery({
    queryKey: rbacQueryKeys.role(id),
    queryFn: () => getRole(id),
  });

  const role = roleQuery.data;
  const assignedPermissions = role ? getAssignedPermissions(role) : [];
  const groupedPermissions = groupPermissionsByModule(assignedPermissions);
  const hasAssignmentPayload =
    role !== undefined &&
    ("permissions" in role || "role_permissions" in role);

  return (
    <div className="space-y-6">
      {role ? (
        <PageHeader
          description={
            role.description ||
            "This role does not currently include a description."
          }
          eyebrow="RBAC administration"
          title={role.name}
        >
          <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailField
              label="Code"
              value={<span className="font-mono text-xs">{role.code}</span>}
            />
            <DetailField
              label="System role"
              value={
                <StatusBadge
                  activeLabel="System"
                  inactiveLabel="Custom"
                  isActive={role.is_system_role}
                />
              }
            />
            <DetailField
              label="Status"
              value={<StatusBadge isActive={role.is_active} />}
            />
            <DetailField
              label="Manage actions"
              value={canManage ? "Allowed when backend supports it" : "Hidden"}
            />
          </dl>
        </PageHeader>
      ) : null}

      {roleQuery.isPending ? (
        <LoadingState
          title="Loading role"
          message="Retrieving the latest role details from the backend."
        />
      ) : null}

      {!roleQuery.isPending && roleQuery.isError ? (
        <ErrorState
          title="Unable to load role"
          message={getErrorMessage(
            roleQuery.error,
            "The role detail could not be loaded.",
          )}
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => void roleQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          }
        />
      ) : null}

      {!roleQuery.isPending && !roleQuery.isError && role ? (
        <section className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              Assigned permissions
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Role-permission editing remains disabled until the backend exposes
              dedicated assignment and removal endpoints.
            </p>
          </div>

          {!hasAssignmentPayload ? (
            <EmptyState
              title="Assigned permissions unavailable"
              message="The current backend role detail response does not expose role-permission assignments yet. Add a role detail endpoint with assigned permissions before enabling richer role-permission viewing."
            />
          ) : null}

          {hasAssignmentPayload && groupedPermissions.length === 0 ? (
            <EmptyState
              title="No assigned permissions"
              message="This role currently has no active permission assignments in the role detail payload."
            />
          ) : null}

          {hasAssignmentPayload && groupedPermissions.length > 0
            ? groupedPermissions.map((group) => (
                <PermissionGroupSection group={group} key={group.module} />
              ))
            : null}
        </section>
      ) : null}
    </div>
  );
}
