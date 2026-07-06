"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { DetailField } from "@/components/common/detail-field";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { getRoles } from "@/services/api/rbac";
import { rbacQueryKeys } from "@/services/api/query-keys";
import type { Role } from "@/types/rbac";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function CellStack({
  primary,
  secondary,
}: {
  primary: string;
  secondary?: string;
}) {
  return (
    <div className="min-w-0 whitespace-normal">
      <p className="font-medium text-slate-900">{primary}</p>
      {secondary ? <p className="mt-1 text-xs text-slate-500">{secondary}</p> : null}
    </div>
  );
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

export function RoleListScreen() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("roles.manage");
  const rolesQuery = useQuery({
    queryKey: rbacQueryKeys.roles(),
    queryFn: () => getRoles(),
  });

  const roles = rolesQuery.data ?? [];
  const systemRoleCount = roles.filter((role) => role.is_system_role).length;

  const columns: DataTableColumn<Role>[] = [
    {
      header: "Role",
      cell: (role) => <CellStack primary={role.name} secondary={role.description} />,
      className: "min-w-72",
    },
    {
      header: "Code",
      cell: (role) => <span className="font-mono text-xs text-slate-700">{role.code}</span>,
    },
    {
      header: "Type",
      cell: (role) => (
        <StatusBadge
          activeLabel="System"
          inactiveLabel="Custom"
          isActive={role.is_system_role}
        />
      ),
    },
    {
      header: "Status",
      cell: (role) => <StatusBadge isActive={role.is_active} />,
    },
    {
      header: "Details",
      cell: (role) => (
        <Link
          className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href={`/admin/roles/${role.id}`}
        >
          View role
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        description="Review active RBAC roles and their current metadata. User-role assignment and role-permission editing remain outside this screen until backend detail and write endpoints are available."
        eyebrow="RBAC administration"
        title="Roles"
      >
        <dl className="grid gap-4 sm:grid-cols-3">
          <DetailField label="Visible roles" value={roles.length} />
          <DetailField label="System roles" value={systemRoleCount} />
          <DetailField
            label="Access level"
            value={canManage ? "Manage-capable account" : "Read-only account"}
          />
        </dl>
      </PageHeader>

      {rolesQuery.isPending ? (
        <LoadingState
          title="Loading roles"
          message="Retrieving the active RBAC roles from the backend."
        />
      ) : null}

      {!rolesQuery.isPending && rolesQuery.isError ? (
        <ErrorState
          title="Unable to load roles"
          message={getErrorMessage(
            rolesQuery.error,
            "The roles list could not be loaded.",
          )}
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => void rolesQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          }
        />
      ) : null}

      {!rolesQuery.isPending && !rolesQuery.isError && roles.length === 0 ? (
        <EmptyState
          title="No roles found"
          message="No active roles are currently available from the backend."
        />
      ) : null}

      {!rolesQuery.isPending && !rolesQuery.isError && roles.length > 0 ? (
        <DataTable
          caption="Roles list"
          columns={columns}
          getRowKey={(role) => role.id}
          rows={roles}
        />
      ) : null}
    </div>
  );
}
