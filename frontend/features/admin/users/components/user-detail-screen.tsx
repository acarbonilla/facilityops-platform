"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DetailField } from "@/components/common/detail-field";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useDeactivateUser, useUser, useUserFormOptions } from "@/hooks/use-users";
import {
  getUserActionPermissions,
  getUserDisplayName,
  readUserFormFlash,
} from "@/lib/users/form";

import { UserDeactivateDialog } from "./user-deactivate-dialog";
import {
  buildNameMap,
  formatUserDate,
  resolveUserScopeName,
  StaffStatusBadge,
  UserStatusBadge,
} from "./user-shared";

function Breadcrumbs({ label }: { label: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
      <Link className="hover:text-slate-700" href="/admin/users">
        Users
      </Link>
      <span className="mx-2">/</span>
      <span className="text-slate-700">{label}</span>
    </nav>
  );
}

export function UserDetailScreen({ id }: { id: string }) {
  const { user: currentUser } = useAuth();
  const { permissions } = usePermissions();
  const [success, setSuccess] = useState<string | null>(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const detailQuery = useUser(id);
  const optionsQuery = useUserFormOptions();
  const deactivateMutation = useDeactivateUser();

  useEffect(() => {
    setSuccess(readUserFormFlash());
  }, []);

  const tenantNames = useMemo(
    () => buildNameMap(optionsQuery.data?.tenants ?? []),
    [optionsQuery.data?.tenants],
  );
  const organizationNames = useMemo(
    () => buildNameMap(optionsQuery.data?.organizations ?? []),
    [optionsQuery.data?.organizations],
  );

  if (detailQuery.isPending || optionsQuery.isPending) {
    return (
      <LoadingState
        title="Loading user"
        message="Retrieving the selected account and tenant scope details."
      />
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorState
        title="Unable to load user"
        message="The user was not found or is not accessible in your tenant."
        action={
          <button
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            onClick={() => void detailQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        }
      />
    );
  }

  const user = detailQuery.data;
  const actions = getUserActionPermissions(permissions, currentUser, user);

  return (
    <div className="space-y-6">
      <PageHeader
        description="View tenant-safe account details and permitted user-management actions."
        eyebrow="Admin / Users"
        title={getUserDisplayName(user)}
      >
        <div className="space-y-3">
          <Breadcrumbs label={getUserDisplayName(user)} />
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              href="/admin/users"
            >
              Back to users
            </Link>
            {actions.canEdit ? (
              <Link
                className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                href={`/admin/users/${user.id}/edit`}
              >
                Edit user
              </Link>
            ) : null}
            {actions.canDeactivate ? (
              <button
                className="inline-flex items-center rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50"
                onClick={() => setDeactivateOpen(true)}
                type="button"
              >
                Deactivate account
              </button>
            ) : null}
          </div>
        </div>
      </PageHeader>

      {success ? (
        <p
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
          role="status"
        >
          {success}
        </p>
      ) : null}

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          User information
        </h2>
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Full name" value={getUserDisplayName(user)} />
          <DetailField label="Email" value={user.email} />
          <DetailField
            label="Tenant"
            value={resolveUserScopeName(user.tenant, tenantNames, "No tenant")}
          />
          <DetailField
            label="Organization"
            value={resolveUserScopeName(
              user.organization,
              organizationNames,
              "No organization",
            )}
          />
          <DetailField
            label="Active status"
            value={<UserStatusBadge active={user.is_active} />}
          />
          <DetailField
            label="Staff status"
            value={<StaffStatusBadge staff={user.is_staff} />}
          />
          <DetailField label="Created timestamp" value={formatUserDate(user.created_at)} />
          <DetailField label="Updated timestamp" value={formatUserDate(user.updated_at)} />
        </dl>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          System metadata
        </h2>
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DetailField
            label="User ID"
            value={<span className="font-mono text-xs">{user.id}</span>}
          />
          <DetailField
            label="Available actions"
            value={
              actions.canEdit || actions.canDeactivate
                ? [actions.canEdit ? "Edit" : null, actions.canDeactivate ? "Deactivate" : null]
                    .filter(Boolean)
                    .join(" and ")
                : "View only"
            }
          />
          <DetailField label="Backend guard" value="users.view" />
        </dl>
      </section>

      {deactivateOpen ? (
        <UserDeactivateDialog
          error={
            deactivateMutation.isError
              ? deactivateMutation.error instanceof Error
                ? deactivateMutation.error.message
                : "The user could not be deactivated."
              : null
          }
          isPending={deactivateMutation.isPending}
          onClose={() => {
            if (!deactivateMutation.isPending) {
              setDeactivateOpen(false);
              deactivateMutation.reset();
            }
          }}
          onConfirm={async () => {
            await deactivateMutation.mutateAsync(user.id);
            setSuccess(`${getUserDisplayName(user)} was deactivated successfully.`);
            setDeactivateOpen(false);
          }}
          user={user}
        />
      ) : null}
    </div>
  );
}