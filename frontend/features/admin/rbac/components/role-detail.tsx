"use client";

import Link from "next/link";
import { useState } from "react";

import { DetailField } from "@/components/common/detail-field";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useDeactivateRole, useRole } from "@/hooks/use-rbac";
import {
  formatRoleDate,
  getRoleActionPermissions,
  readRoleFormFlash,
} from "@/lib/rbac/roles";
import { ApiError } from "@/services/api/types";

import { RoleDeactivateDialog } from "./role-deactivate-dialog";
import { RoleStatusBadge, RoleTypeBadge } from "./role-shared";

export function RoleDetailScreen({ id }: { id: string }) {
  const { user } = useAuth();
  const { permissions, refreshPermissions } = usePermissions();
  const roleQuery = useRole(id);
  const deactivateMutation = useDeactivateRole();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(() => readRoleFormFlash());

  if (roleQuery.isPending) return <LoadingState title="Loading role" />;
  if (roleQuery.isError || !roleQuery.data) {
    const notFound =
      roleQuery.error instanceof ApiError && roleQuery.error.status === 404;
    return (
      <ErrorState
        action={
          notFound ? (
            <Link
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
              href="/admin/roles"
            >
              Return to roles
            </Link>
          ) : (
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm text-white"
              onClick={() => void roleQuery.refetch()}
              type="button"
            >
              Retry role detail
            </button>
          )
        }
        message={
          notFound
            ? "The requested role does not exist."
            : roleQuery.error instanceof Error
              ? roleQuery.error.message
              : "The role detail could not be loaded."
        }
        title={notFound ? "Role not found" : "Unable to load role"}
      />
    );
  }

  const role = roleQuery.data;
  const actions = getRoleActionPermissions(permissions, user, role);

  return (
    <div className="space-y-6">
      <PageHeader
        description={role.description || "This role has no description."}
        eyebrow="Admin / Roles"
        title={role.name}
      >
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            href="/admin/roles"
          >
            Back to roles
          </Link>
          {actions.canEdit ? (
            <Link
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              href={`/admin/roles/${role.id}/edit`}
            >
              Edit role
            </Link>
          ) : null}
          {actions.canDeactivate ? (
            <button
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
              onClick={() => setDialogOpen(true)}
              type="button"
            >
              Deactivate role
            </button>
          ) : null}
        </div>
      </PageHeader>

      {success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
          {success}
        </p>
      ) : null}

      {role.is_system_role ? (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-semibold text-blue-950">Protected system role</h2>
          <p className="mt-1 text-sm text-blue-900">
            System roles are read-only and cannot be renamed, edited, or deactivated.
          </p>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Role details</h2>
        <dl className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DetailField label="Name" value={role.name} />
          <DetailField label="Code" value={<span className="font-mono text-xs">{role.code}</span>} />
          <DetailField label="Type" value={<RoleTypeBadge role={role} />} />
          <DetailField label="Status" value={<RoleStatusBadge role={role} />} />
          <DetailField label="Created" value={formatRoleDate(role.created_at)} />
          <DetailField label="Updated" value={formatRoleDate(role.updated_at)} />
          <div className="md:col-span-2 xl:col-span-3">
            <DetailField label="Description" value={role.description || "No description provided."} />
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="font-semibold text-amber-950">Permission assignment pending</h2>
        <p className="mt-1 text-sm text-amber-900">
          Assigning permissions to this role is not part of FO-051 and arrives in FO-052.
        </p>
      </section>

      {dialogOpen ? (
        <RoleDeactivateDialog
          error={
            deactivateMutation.isError
              ? deactivateMutation.error instanceof Error
                ? deactivateMutation.error.message
                : "The role could not be deactivated."
              : null
          }
          isPending={deactivateMutation.isPending}
          onClose={() => {
            if (!deactivateMutation.isPending) {
              setDialogOpen(false);
              deactivateMutation.reset();
            }
          }}
          onConfirm={async () => {
            await deactivateMutation.mutateAsync(role.id);
            await refreshPermissions();
            setSuccess("Role deactivated successfully.");
            setDialogOpen(false);
          }}
          role={role}
        />
      ) : null}
    </div>
  );
}
