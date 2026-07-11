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
import {
  useDeactivateUser,
  useUserFormOptions,
  useUsers,
} from "@/hooks/use-users";
import {
  getUserActionPermissions,
  getUserDisplayName,
} from "@/lib/users/form";
import type { UserListFilters, UserListParams, UserRecord } from "@/types/users";

import { UserDeactivateDialog } from "./user-deactivate-dialog";
import {
  buildNameMap,
  formatUserDate,
  resolveUserScopeName,
  StaffStatusBadge,
  UserStatusBadge,
} from "./user-shared";

const DEFAULT_FILTERS: UserListFilters = {
  search: "",
  tenant: "",
  organization: "",
  active: "",
  staff: "",
  ordering: "email",
  pageSize: 20,
};

function toBoolean(value: "" | "true" | "false") {
  return value === "" ? undefined : value === "true";
}

function buildParams(
  filters: UserListFilters,
  page: number,
  search: string,
): UserListParams {
  return {
    page,
    page_size: filters.pageSize,
    search: search || undefined,
    tenant: filters.tenant || undefined,
    organization: filters.organization || undefined,
    is_active: toBoolean(filters.active),
    is_staff: toBoolean(filters.staff),
    ordering: filters.ordering,
  };
}

export function UserManagementScreen() {
  const { user: currentUser } = useAuth();
  const { permissions } = usePermissions();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [deactivateTarget, setDeactivateTarget] = useState<UserRecord | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(filters.search.trim());
  const listQuery = useUsers(buildParams(filters, page, deferredSearch));
  const optionsQuery = useUserFormOptions();
  const deactivateMutation = useDeactivateUser();

  const tenants = optionsQuery.data?.tenants;
  const organizations = optionsQuery.data?.organizations;
  const tenantNames = useMemo(() => buildNameMap(tenants ?? []), [tenants]);
  const organizationNames = useMemo(
    () => buildNameMap(organizations ?? []),
    [organizations],
  );
  const filteredOrganizations = filters.tenant
    ? (organizations ?? []).filter((item) => item.tenant === filters.tenant)
    : (organizations ?? []);
  const rows = listQuery.data?.results ?? [];
  const pageCount = Math.max(
    1,
    Math.ceil((listQuery.data?.count ?? 0) / filters.pageSize),
  );
  const basePermissions = getUserActionPermissions(permissions, currentUser);

  const columns: DataTableColumn<UserRecord>[] = [
    {
      header: "Name",
      cell: (record) => (
        <Link className="font-medium text-blue-700 hover:text-blue-900" href={`/admin/users/${record.id}`}>
          {getUserDisplayName(record)}
        </Link>
      ),
    },
    { header: "Email", cell: (record) => record.email },
    {
      header: "Tenant",
      cell: (record) => resolveUserScopeName(record.tenant, tenantNames, "No tenant"),
    },
    {
      header: "Organization",
      cell: (record) =>
        resolveUserScopeName(record.organization, organizationNames, "No organization"),
    },
    { header: "Active status", cell: (record) => <UserStatusBadge active={record.is_active} /> },
    { header: "Staff status", cell: (record) => <StaffStatusBadge staff={record.is_staff} /> },
    { header: "Created date", cell: (record) => formatUserDate(record.created_at) },
    {
      header: "Actions",
      cell: (record) => {
        const actions = getUserActionPermissions(permissions, currentUser, record);
        return (
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50" href={`/admin/users/${record.id}`}>
              View
            </Link>
            {actions.canEdit ? (
              <Link className="rounded-md border border-blue-300 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50" href={`/admin/users/${record.id}/edit`}>
                Edit
              </Link>
            ) : null}
            {actions.canDeactivate ? (
              <button className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50" onClick={() => setDeactivateTarget(record)} type="button">
                Deactivate
              </button>
            ) : null}
          </div>
        );
      },
      className: "min-w-52",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        description="Tenant-scoped user administration with backend-driven search, filtering, ordering, and pagination."
        eyebrow="Admin"
        title="Users"
      >
        {basePermissions.canCreate ? (
          <Link className="inline-flex rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800" href="/admin/users/new">
            Create User
          </Link>
        ) : null}
      </PageHeader>

      {success ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{success}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-lg font-semibold text-slate-950">Search and filters</h2><p className="mt-1 text-sm text-slate-600">Filters are sent to the tenant-scoped backend API.</p></div>
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50" onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }} type="button">Reset</button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField htmlFor="user-search" label="Search">
            <input className="block w-full rounded-md border border-slate-300 px-3 py-2" id="user-search" onChange={(event) => { setFilters((current) => ({ ...current, search: event.target.value })); setPage(1); }} placeholder="Email or name" type="search" value={filters.search} />
          </FormField>
          <SelectField label="Tenant" name="user-tenant" onChange={(event) => { setFilters((current) => ({ ...current, tenant: event.target.value, organization: "" })); setPage(1); }} options={(tenants ?? []).map((item) => ({ value: item.id, label: item.name }))} placeholder="All visible tenants" value={filters.tenant} />
          <SelectField label="Organization" name="user-organization" onChange={(event) => { setFilters((current) => ({ ...current, organization: event.target.value })); setPage(1); }} options={filteredOrganizations.map((item) => ({ value: item.id, label: item.name }))} placeholder="All organizations" value={filters.organization} />
          <SelectField label="Active status" name="user-active" onChange={(event) => { setFilters((current) => ({ ...current, active: event.target.value as UserListFilters["active"] })); setPage(1); }} options={[{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }]} placeholder="All statuses" value={filters.active} />
          <SelectField label="Staff status" name="user-staff" onChange={(event) => { setFilters((current) => ({ ...current, staff: event.target.value as UserListFilters["staff"] })); setPage(1); }} options={[{ value: "true", label: "Staff" }, { value: "false", label: "Standard user" }]} placeholder="All staff states" value={filters.staff} />
          <SelectField label="Ordering" name="user-ordering" onChange={(event) => { setFilters((current) => ({ ...current, ordering: event.target.value })); setPage(1); }} options={[{ value: "email", label: "Email A–Z" }, { value: "-email", label: "Email Z–A" }, { value: "first_name", label: "First name A–Z" }, { value: "-created_at", label: "Newest created" }, { value: "created_at", label: "Oldest created" }]} value={filters.ordering} />
          <SelectField label="Rows per page" name="user-page-size" onChange={(event) => { setFilters((current) => ({ ...current, pageSize: Number(event.target.value) })); setPage(1); }} options={[10, 20, 50, 100].map((value) => ({ value: String(value), label: String(value) }))} value={String(filters.pageSize)} />
        </div>
      </section>

      {listQuery.isPending ? <LoadingState title="Loading users" /> : null}
      {listQuery.isError ? <ErrorState action={<button className="rounded-md bg-red-700 px-3 py-2 text-sm text-white" onClick={() => void listQuery.refetch()} type="button">Retry</button>} message={listQuery.error instanceof Error ? listQuery.error.message : "Users could not be loaded."} title="Unable to load users" /> : null}
      {!listQuery.isPending && !listQuery.isError && rows.length === 0 ? <EmptyState message="No users matched the current search and filters." title="No users found" /> : null}
      {!listQuery.isPending && !listQuery.isError && rows.length > 0 ? (
        <><DataTable caption="User list" columns={columns} getRowKey={(record) => record.id} rows={rows} /><section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600">Page {page} of {pageCount}. {(listQuery.data?.count ?? 0).toLocaleString()} users.</p><div className="flex gap-2"><button className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" disabled={page <= 1 || listQuery.isFetching} onClick={() => setPage((value) => value - 1)} type="button">Previous</button><button className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" disabled={page >= pageCount || listQuery.isFetching} onClick={() => setPage((value) => value + 1)} type="button">Next</button></div></section></>
      ) : null}

      {deactivateTarget ? <UserDeactivateDialog error={deactivateMutation.isError ? (deactivateMutation.error instanceof Error ? deactivateMutation.error.message : "The user could not be deactivated.") : null} isPending={deactivateMutation.isPending} onClose={() => { if (!deactivateMutation.isPending) { setDeactivateTarget(null); deactivateMutation.reset(); } }} onConfirm={async () => { await deactivateMutation.mutateAsync(deactivateTarget.id); setSuccess(`${getUserDisplayName(deactivateTarget)} was deactivated successfully.`); setDeactivateTarget(null); }} user={deactivateTarget} /> : null}
    </div>
  );
}
