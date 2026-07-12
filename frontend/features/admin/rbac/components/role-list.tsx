"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { FormField } from "@/components/common/form-field";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { SelectField } from "@/components/common/select-field";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useDeactivateRole, useRoles } from "@/hooks/use-rbac";
import {
  formatRoleDate,
  getRoleActionPermissions,
} from "@/lib/rbac/roles";
import type {
  Role,
  RoleListFilters,
  RoleListParams,
} from "@/types/rbac";

import { RoleDeactivateDialog } from "./role-deactivate-dialog";
import { RoleStatusBadge, RoleTypeBadge } from "./role-shared";

const DEFAULT_FILTERS: RoleListFilters = {
  search: "",
  systemRole: "",
  active: "",
  ordering: "name",
  pageSize: 20,
};

function toBoolean(value: "" | "true" | "false") {
  return value === "" ? undefined : value === "true";
}

export function buildRoleListParams(
  filters: RoleListFilters,
  page: number,
  search: string,
): RoleListParams {
  return {
    page,
    page_size: filters.pageSize,
    search: search || undefined,
    is_system_role: toBoolean(filters.systemRole),
    is_active: toBoolean(filters.active),
    ordering: filters.ordering,
  };
}

export function RoleListScreen() {
  const { user } = useAuth();
  const { permissions, refreshPermissions } = usePermissions();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [deactivateTarget, setDeactivateTarget] = useState<Role | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(filters.search.trim());
  const params = useMemo(
    () => buildRoleListParams(filters, page, deferredSearch),
    [deferredSearch, filters, page],
  );
  const rolesQuery = useRoles(params);
  const deactivateMutation = useDeactivateRole();
  const roles = rolesQuery.data?.results ?? [];
  const pageCount = Math.max(
    1,
    Math.ceil((rolesQuery.data?.count ?? 0) / filters.pageSize),
  );
  const baseActions = getRoleActionPermissions(permissions, user);

  const columns: DataTableColumn<Role>[] = [
    {
      header: "Name",
      cell: (role) => (
        <Link
          className="font-medium text-blue-700 hover:text-blue-900"
          href={`/admin/roles/${role.id}`}
        >
          {role.name}
        </Link>
      ),
    },
    {
      header: "Code",
      cell: (role) => <span className="font-mono text-xs">{role.code}</span>,
    },
    { header: "Type", cell: (role) => <RoleTypeBadge role={role} /> },
    { header: "Status", cell: (role) => <RoleStatusBadge role={role} /> },
    { header: "Created", cell: (role) => formatRoleDate(role.created_at) },
    { header: "Updated", cell: (role) => formatRoleDate(role.updated_at) },
    {
      header: "Actions",
      className: "min-w-64",
      cell: (role) => {
        const actions = getRoleActionPermissions(permissions, user, role);
        return (
          <div className="flex flex-wrap gap-2">
            <Link
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
              href={`/admin/roles/${role.id}`}
            >
              View role
            </Link>
            {actions.canEdit ? (
              <Link
                className="rounded-md border border-blue-300 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50"
                href={`/admin/roles/${role.id}/edit`}
              >
                Edit role
              </Link>
            ) : null}
            {actions.canDuplicate ? (
              <Link
                className="rounded-md border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
                href={`/admin/roles/${role.id}/duplicate`}
              >
                Duplicate role
              </Link>
            ) : null}
            {actions.canDeactivate ? (
              <button
                className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50"
                onClick={() => setDeactivateTarget(role)}
                type="button"
              >
                Deactivate role
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        description="Manage the global role catalog with backend-driven search, filtering, ordering, and pagination."
        eyebrow="Admin / RBAC"
        title="Roles"
      >
        {baseActions.canCreate ? (
          <Link
            className="inline-flex rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            href="/admin/roles/new"
          >
            Create Role
          </Link>
        ) : null}
      </PageHeader>

      {success ? (
        <p
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
          role="status"
        >
          {success}
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Search and filters</h2>
            <p className="mt-1 text-sm text-slate-600">
              Search name, code, or description and include inactive roles when needed.
            </p>
          </div>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
            onClick={() => {
              setFilters(DEFAULT_FILTERS);
              setPage(1);
            }}
            type="button"
          >
            Reset filters
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <FormField htmlFor="role-search" label="Search roles">
            <input
              className="block w-full rounded-md border border-slate-300 px-3 py-2"
              id="role-search"
              onChange={(event) => {
                setFilters((current) => ({ ...current, search: event.target.value }));
                setPage(1);
              }}
              placeholder="Name, code, or description"
              type="search"
              value={filters.search}
            />
          </FormField>
          <SelectField
            label="Role type"
            name="role-type"
            onChange={(event) => {
              setFilters((current) => ({
                ...current,
                systemRole: event.target.value as RoleListFilters["systemRole"],
              }));
              setPage(1);
            }}
            options={[
              { value: "true", label: "System roles" },
              { value: "false", label: "Custom roles" },
            ]}
            placeholder="All role types"
            value={filters.systemRole}
          />
          <SelectField
            label="Active status"
            name="role-active"
            onChange={(event) => {
              setFilters((current) => ({
                ...current,
                active: event.target.value as RoleListFilters["active"],
              }));
              setPage(1);
            }}
            options={[
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ]}
            placeholder="All statuses"
            value={filters.active}
          />
          <SelectField
            label="Ordering"
            name="role-ordering"
            onChange={(event) => {
              setFilters((current) => ({ ...current, ordering: event.target.value }));
              setPage(1);
            }}
            options={[
              { value: "name", label: "Name A-Z" },
              { value: "-name", label: "Name Z-A" },
              { value: "code", label: "Code A-Z" },
              { value: "is_system_role", label: "Custom roles first" },
              { value: "-is_system_role", label: "System roles first" },
              { value: "is_active", label: "Inactive roles first" },
              { value: "-is_active", label: "Active roles first" },
              { value: "-created_at", label: "Newest created" },
              { value: "created_at", label: "Oldest created" },
              { value: "-updated_at", label: "Recently updated" },
            ]}
            value={filters.ordering}
          />
          <SelectField
            label="Rows per page"
            name="role-page-size"
            onChange={(event) => {
              setFilters((current) => ({
                ...current,
                pageSize: Number(event.target.value),
              }));
              setPage(1);
            }}
            options={[10, 20, 50, 100].map((value) => ({
              value: String(value),
              label: String(value),
            }))}
            value={String(filters.pageSize)}
          />
        </div>
      </section>

      {rolesQuery.isPending ? <LoadingState title="Loading roles" /> : null}
      {rolesQuery.isError ? (
        <ErrorState
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm text-white"
              onClick={() => void rolesQuery.refetch()}
              type="button"
            >
              Retry role list
            </button>
          }
          message={
            rolesQuery.error instanceof Error
              ? rolesQuery.error.message
              : "Roles could not be loaded."
          }
          title="Unable to load roles"
        />
      ) : null}
      {!rolesQuery.isPending && !rolesQuery.isError && roles.length === 0 ? (
        <EmptyState
          message="No roles matched the current search and filters."
          title="No roles found"
        />
      ) : null}
      {!rolesQuery.isPending && !rolesQuery.isError && roles.length > 0 ? (
        <>
          <DataTable
            caption="Roles list"
            columns={columns}
            getRowKey={(role) => role.id}
            rows={roles}
          />
          <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Page {page} of {pageCount}. {(rolesQuery.data?.count ?? 0).toLocaleString()} roles.
            </p>
            <div className="flex gap-2">
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
                disabled={!rolesQuery.data?.previous || rolesQuery.isFetching}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                type="button"
              >
                Previous page
              </button>
              <button
                className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
                disabled={!rolesQuery.data?.next || rolesQuery.isFetching}
                onClick={() => setPage((value) => value + 1)}
                type="button"
              >
                Next page
              </button>
            </div>
          </section>
        </>
      ) : null}

      {deactivateTarget ? (
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
              setDeactivateTarget(null);
              deactivateMutation.reset();
            }
          }}
          onConfirm={async () => {
            await deactivateMutation.mutateAsync(deactivateTarget.id);
            await refreshPermissions();
            setSuccess(`${deactivateTarget.name} was deactivated successfully.`);
            setDeactivateTarget(null);
          }}
          role={deactivateTarget}
        />
      ) : null}
    </div>
  );
}
