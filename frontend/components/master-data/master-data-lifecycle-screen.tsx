"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import {
  buildLifecycleListParams,
  canUseManageControls,
  formatMasterDataError,
  getLifecycleEmptyStateMessage,
  getLifecycleActions,
  getMasterDataInvalidationKeys,
  getMasterDataSessionScope,
  getMutationSuccessMessage,
  getPageAfterLifecycleChange,
  hasReliableGlobalTenantRole,
  getTotalPages,
  type MasterDataLifecycleAction,
  shouldEnableMasterDataQuery,
} from "@/lib/master-data/lifecycle";
import {
  deleteMasterDataRecord,
  getDeletedMasterDataRecords,
  getMasterDataRecords,
  restoreMasterDataRecord,
  updateMasterDataLifecycle,
} from "@/services/api/master-data";
import { masterDataQueryKeys } from "@/services/api/query-keys";
import type {
  BaseMasterDataRecord,
  MasterDataLifecycle,
  MasterDataResourceKey,
} from "@/types/master-data";

const LIFECYCLES: MasterDataLifecycle[] = ["active", "inactive", "deleted"];

const RESOURCE_LABELS: Record<
  MasterDataResourceKey,
  { singular: string; plural: string; description: string }
> = {
  tenants: {
    singular: "tenant",
    plural: "Tenants",
    description: "Top-level ownership boundaries for FacilityOps data.",
  },
  organizations: {
    singular: "organization",
    plural: "Organizations",
    description: "Operating organizations grouped under tenants.",
  },
  departments: {
    singular: "department",
    plural: "Departments",
    description: "Business functions grouped under organizations.",
  },
  buildings: {
    singular: "building",
    plural: "Buildings",
    description: "Physical sites used by floors, areas, and assets.",
  },
  floors: {
    singular: "floor",
    plural: "Floors",
    description: "Building levels used for area and asset placement.",
  },
  areas: {
    singular: "area",
    plural: "Areas",
    description: "Rooms, zones, and service spaces within floors.",
  },
  "asset-types": {
    singular: "asset type",
    plural: "Asset Types",
    description: "Classifications used by operational assets.",
  },
  assets: {
    singular: "asset",
    plural: "Assets",
    description: "Operational assets linked to location and classification data.",
  },
};

function LifecycleBadge({ lifecycle }: { lifecycle: MasterDataLifecycle }) {
  const styles = {
    active: "bg-emerald-100 text-emerald-800",
    inactive: "bg-amber-100 text-amber-900",
    deleted: "bg-red-100 text-red-800",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[lifecycle]}`}>
      {lifecycle[0].toUpperCase() + lifecycle.slice(1)}
    </span>
  );
}

function LifecycleDialog({
  action,
  error,
  isPending,
  onClose,
  onConfirm,
  record,
  entityType,
}: {
  action: Exclude<MasterDataLifecycleAction, "edit">;
  error: string | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
  record: BaseMasterDataRecord;
  entityType: string;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isPendingRef = useRef(isPending);
  const onCloseRef = useRef(onClose);
  isPendingRef.current = isPending;
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPendingRef.current) {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDialogKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  const title = `${action[0].toUpperCase() + action.slice(1)} ${entityType}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div
        aria-describedby="master-data-action-description"
        aria-labelledby="master-data-action-title"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto overflow-x-hidden rounded-xl bg-white p-4 shadow-2xl sm:p-6"
        ref={dialogRef}
        role="dialog"
      >
        <h2 className="text-xl font-semibold text-slate-950" id="master-data-action-title">
          {title}
        </h2>
        <p className="mt-2 break-words text-sm font-medium text-slate-900">
          {record.name} ({record.code})
        </p>
        <p className="mt-2 text-sm text-slate-600" id="master-data-action-description">
          {action === "delete"
            ? "This is a soft delete. Existing references remain, but non-deleted dependencies may block the action."
            : action === "restore"
              ? "The record will return as inactive. Parent hierarchy rules may block restoration."
              : action === "deactivate"
                ? "The record will become inactive. Active dependencies may block this action."
                : "The record will become active. Every required parent must be active and hierarchy-compatible."}
        </p>
        {error ? (
          <p className="mt-4 break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
            disabled={isPending}
            onClick={onClose}
            ref={cancelRef}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            disabled={isPending}
            onClick={onConfirm}
            type="button"
          >
            {isPending ? "Working..." : `Confirm ${action}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MasterDataLifecycleScreen({
  resource,
}: {
  resource: MasterDataResourceKey;
}) {
  const labels = RESOURCE_LABELS[resource];
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { hasPermission, permissionsError, permissionsLoading } = usePermissions();
  const canManage = canUseManageControls(
    hasPermission("settings.manage"),
    permissionsLoading,
    permissionsError,
  );
  const canManageTenantGlobally = hasReliableGlobalTenantRole(
    false,
    user?.is_staff ?? false,
  );
  const [lifecycle, setLifecycle] = useState<MasterDataLifecycle>("active");
  const [page, setPage] = useState(1);
  const [successMessage, setSuccessMessage] = useState("");
  const [dialog, setDialog] = useState<{
    action: Exclude<MasterDataLifecycleAction, "edit">;
    record: BaseMasterDataRecord;
  } | null>(null);

  const params = buildLifecycleListParams(lifecycle, page);
  const sessionScope = getMasterDataSessionScope(user?.id, user?.tenant);
  const recordsQuery = useQuery({
    queryKey: masterDataQueryKeys.lifecycleList(
      resource,
      lifecycle,
      params,
      sessionScope,
    ),
    queryFn: () =>
      lifecycle === "deleted"
        ? getDeletedMasterDataRecords(resource, params)
        : getMasterDataRecords(resource, params),
    enabled: shouldEnableMasterDataQuery(authLoading, isAuthenticated),
  });

  const mutation = useMutation({
    mutationFn: async ({
      action,
      record,
    }: {
      action: Exclude<MasterDataLifecycleAction, "edit">;
      record: BaseMasterDataRecord;
    }) => {
      if (action === "delete") return deleteMasterDataRecord(resource, record.id);
      if (action === "restore") return restoreMasterDataRecord(resource, record.id);
      return updateMasterDataLifecycle(resource, record.id, action === "reactivate");
    },
    onSuccess: async (_, variables) => {
      if ((recordsQuery.data?.results.length ?? 0) === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      }
      await Promise.all(
        getMasterDataInvalidationKeys(resource, variables.record.id).map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      setSuccessMessage(
        getMutationSuccessMessage(
          variables.action,
          labels.singular[0].toUpperCase() + labels.singular.slice(1),
          variables.record.name,
          variables.record.code,
        ),
      );
      setDialog(null);
    },
  });

  const columns: DataTableColumn<BaseMasterDataRecord>[] = [
    {
      header: "Name",
      cell: (record) => (
        <div className="min-w-0 whitespace-normal">
          <p className="font-medium text-slate-900">{record.name}</p>
          {record.description ? <p className="mt-1 text-xs text-slate-500">{record.description}</p> : null}
        </div>
      ),
      className: "min-w-64",
    },
    { header: "Code", cell: (record) => record.code },
    { header: "Lifecycle", cell: () => <LifecycleBadge lifecycle={lifecycle} /> },
    ...(canManage
      ? [{
          header: "Actions",
          cell: (record: BaseMasterDataRecord) => (
            <div className="flex flex-wrap gap-2">
              {getLifecycleActions(
                lifecycle,
                resource,
                canManage,
                canManageTenantGlobally,
              ).map((action) =>
                action === "edit" ? (
                  <Link
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    href={`/master-data/${resource}/${record.id}/edit`}
                    key={action}
                  >
                    Edit
                  </Link>
                ) : (
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    key={action}
                    onClick={() => {
                      mutation.reset();
                      setDialog({ action, record });
                    }}
                    type="button"
                  >
                    {action[0].toUpperCase() + action.slice(1)}
                  </button>
                ),
              )}
            </div>
          ),
          className: "min-w-72",
        } satisfies DataTableColumn<BaseMasterDataRecord>]
      : []),
  ];

  const records = recordsQuery.data?.results ?? [];
  const totalPages = getTotalPages(recordsQuery.data?.count ?? 0);
  return (
    <div className="space-y-6">
      <PageHeader description={labels.description} eyebrow="Master data" title={labels.plural}>
        {resource === "tenants" && !canManageTenantGlobally ? (
          <p className="text-sm text-slate-600">
            Tenant create, delete, restore, and reactivate controls are API-admin-only because this session does not expose a reliable global role.
          </p>
        ) : canManage ? (
          <Link
            className="inline-flex rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            href={`/master-data/${resource}/new`}
          >
            New {labels.singular}
          </Link>
        ) : null}
      </PageHeader>

      {successMessage ? (
        <p
          aria-live="polite"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}

      <div aria-label={`${labels.plural} lifecycle`} className="flex flex-wrap gap-2" role="tablist">
        {LIFECYCLES.map((value) => (
          <button
            aria-selected={lifecycle === value}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${lifecycle === value ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}
            key={value}
            onClick={() => {
              setPage(getPageAfterLifecycleChange(lifecycle, value, page));
              setLifecycle(value);
            }}
            role="tab"
            type="button"
          >
            {value[0].toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>

      {recordsQuery.isPending ? <LoadingState title={`Loading ${lifecycle} ${labels.plural.toLowerCase()}`} message="Retrieving this lifecycle page from the backend." /> : null}
      {!recordsQuery.isPending && recordsQuery.isError ? (
        <ErrorState
          title={`Unable to load ${lifecycle} ${labels.plural.toLowerCase()}`}
          message={formatMasterDataError(recordsQuery.error, `${labels.plural} could not be loaded.`)}
          action={<button className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white" onClick={() => void recordsQuery.refetch()} type="button">Retry</button>}
        />
      ) : null}
      {!recordsQuery.isPending && !recordsQuery.isError && records.length === 0 ? (
        <EmptyState
          title={`No ${lifecycle} ${labels.plural.toLowerCase()}`}
          message={getLifecycleEmptyStateMessage(lifecycle, labels.plural, true, false)}
        />
      ) : null}
      {!recordsQuery.isPending && !recordsQuery.isError && records.length > 0 ? (
        <>
          <DataTable caption={`${lifecycle} ${labels.plural} list`} columns={columns} getRowKey={(record) => record.id} rows={records} />
          <nav aria-label={`${labels.plural} pagination`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">Page {page} of {totalPages} · {recordsQuery.data?.count ?? 0} total</p>
            <div className="flex gap-2">
              <button className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" disabled={!recordsQuery.data?.previous} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">Previous</button>
              <button className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" disabled={!recordsQuery.data?.next} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
            </div>
          </nav>
        </>
      ) : null}
      {dialog ? (
        <LifecycleDialog
          action={dialog.action}
          entityType={labels.singular}
          error={mutation.isError ? formatMasterDataError(mutation.error, "The lifecycle action failed.") : null}
          isPending={mutation.isPending}
          onClose={() => {
            if (!mutation.isPending) setDialog(null);
          }}
          onConfirm={() => mutation.mutate(dialog)}
          record={dialog.record}
        />
      ) : null}
    </div>
  );
}
