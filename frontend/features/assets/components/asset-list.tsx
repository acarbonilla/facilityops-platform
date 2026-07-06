"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { DetailField } from "@/components/common/detail-field";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import {
  createEntityNameMap,
  DEFAULT_MASTER_DATA_LIST_PARAMS,
  getFirstQueryErrorMessage,
  resolveEntityName,
} from "@/lib/master-data/display";
import {
  getAreas,
  getAssetTypes,
  getAssets,
  getBuildings,
  getFloors,
  getOrganizations,
  getTenants,
} from "@/services/api/master-data";
import { masterDataQueryKeys } from "@/services/api/query-keys";
import type { PaginatedResponse } from "@/services/api/types";
import type {
  Area,
  Asset,
  AssetType,
  Building,
  Organization,
  Tenant,
} from "@/types/master-data";

import {
  AssetFilters,
  type AssetFilterValues,
} from "./asset-filters";

const EMPTY_ASSETS: Asset[] = [];
const EMPTY_OPTIONS: { value: string; label: string }[] = [];

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

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700",
      ].join(" ")}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function useNameMapQuery<T extends { id: string; name: string }>(
  resource: Parameters<typeof masterDataQueryKeys.list>[0],
  queryFn: () => Promise<PaginatedResponse<T>>,
) {
  return useQuery({
    queryKey: masterDataQueryKeys.list(resource, DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn,
    select: (data) => createEntityNameMap(data.results),
  });
}

function SectionLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      className="text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950"
      href={href}
    >
      {label}
    </Link>
  );
}

export function AssetListScreen({
  variant = "master-data",
}: {
  variant?: "master-data" | "admin";
}) {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("settings.manage");
  const [filters, setFilters] = useState<AssetFilterValues>({
    search: "",
    assetType: "",
    building: "",
    status: "all",
  });

  const assetsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("assets", DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn: () => getAssets(DEFAULT_MASTER_DATA_LIST_PARAMS),
  });
  const tenantsQuery = useNameMapQuery<Tenant>("tenants", () =>
    getTenants(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );
  const organizationsQuery = useNameMapQuery<Organization>("organizations", () =>
    getOrganizations(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );
  const assetTypesQuery = useNameMapQuery<AssetType>("asset-types", () =>
    getAssetTypes(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );
  const buildingsQuery = useNameMapQuery<Building>("buildings", () =>
    getBuildings(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );
  const floorsQuery = useNameMapQuery("floors", () =>
    getFloors(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );
  const areasQuery = useNameMapQuery<Area>("areas", () =>
    getAreas(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );

  const isLoading =
    assetsQuery.isPending ||
    tenantsQuery.isPending ||
    organizationsQuery.isPending ||
    assetTypesQuery.isPending ||
    buildingsQuery.isPending ||
    floorsQuery.isPending ||
    areasQuery.isPending;
  const isError =
    assetsQuery.isError ||
    tenantsQuery.isError ||
    organizationsQuery.isError ||
    assetTypesQuery.isError ||
    buildingsQuery.isError ||
    floorsQuery.isError ||
    areasQuery.isError;

  const assets = assetsQuery.data?.results ?? EMPTY_ASSETS;
  const filteredAssets = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();

    return assets.filter((asset) => {
      if (
        normalizedSearch &&
        !asset.name.toLowerCase().includes(normalizedSearch) &&
        !asset.code.toLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }

      if (filters.assetType && asset.asset_type !== filters.assetType) {
        return false;
      }

      if (filters.building && asset.building !== filters.building) {
        return false;
      }

      if (filters.status === "active" && !asset.is_active) {
        return false;
      }

      if (filters.status === "inactive" && asset.is_active) {
        return false;
      }

      return true;
    });
  }, [assets, filters]);

  const assetTypeOptions = useMemo(
    () =>
      assets
        .map((asset) => asset.asset_type)
        .filter((value, index, values) => values.indexOf(value) === index)
        .map((id) => ({
          value: id,
          label: resolveEntityName(id, assetTypesQuery.data ?? {}),
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [assetTypesQuery.data, assets],
  );
  const buildingOptions = useMemo(
    () =>
      assets
        .map((asset) => asset.building)
        .filter((value, index, values) => values.indexOf(value) === index)
        .map((id) => ({
          value: id,
          label: resolveEntityName(id, buildingsQuery.data ?? {}),
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [assets, buildingsQuery.data],
  );

  const columns: DataTableColumn<Asset>[] = [
    {
      header: "Asset",
      cell: (asset) => (
        <CellStack
          primary={asset.name}
          secondary={`${
            resolveEntityName(asset.tenant, tenantsQuery.data ?? {})
          } / ${resolveEntityName(asset.organization, organizationsQuery.data ?? {})}`}
        />
      ),
      className: "min-w-72",
    },
    { header: "Code", cell: (asset) => asset.code },
    {
      header: "Asset type",
      cell: (asset) => (
        <SectionLink
          href="/master-data/asset-types"
          label={resolveEntityName(asset.asset_type, assetTypesQuery.data ?? {})}
        />
      ),
    },
    {
      header: "Organization",
      cell: (asset) => (
        <SectionLink
          href="/admin/organization/organizations"
          label={resolveEntityName(asset.organization, organizationsQuery.data ?? {})}
        />
      ),
    },
    {
      header: "Building",
      cell: (asset) => (
        <SectionLink
          href="/admin/organization/buildings"
          label={resolveEntityName(asset.building, buildingsQuery.data ?? {})}
        />
      ),
    },
    {
      header: "Floor",
      cell: (asset) =>
        asset.floor ? (
          <SectionLink
            href="/admin/organization/floors"
            label={resolveEntityName(asset.floor, floorsQuery.data ?? {})}
          />
        ) : (
          "Not assigned"
        ),
    },
    {
      header: "Area",
      cell: (asset) =>
        asset.area ? (
          <SectionLink
            href="/admin/organization/areas"
            label={resolveEntityName(asset.area, areasQuery.data ?? {})}
          />
        ) : (
          "Not assigned"
        ),
    },
    {
      header: "Serial number",
      cell: (asset) => asset.serial_number || "Not provided",
      className: "min-w-48",
    },
    {
      header: "Status",
      cell: (asset) => <StatusBadge isActive={asset.is_active} />,
    },
    {
      header: "Actions",
      cell: (asset) => (
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href={`/master-data/assets/${asset.id}`}
          >
            View
          </Link>
          {canManage ? (
            <Link
              className="inline-flex rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
              href={`/master-data/assets/${asset.id}/edit`}
            >
              Edit
            </Link>
          ) : null}
        </div>
      ),
      className: "min-w-48",
    },
  ];

  const title = "Assets";
  const description =
    variant === "admin"
      ? "Admin-facing asset management view with simple client-side filters, asset detail links, and direct connections back to organization structure screens."
      : "Asset records linked to organization structure and classification data. This polished list adds detail links, clearer location context, and simple client-side filters for the current loaded page.";
  const eyebrow = variant === "admin" ? "Admin" : "Master data";

  return (
    <div className="space-y-6">
      <PageHeader description={description} eyebrow={eyebrow} title={title}>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Visible rows" value={filteredAssets.length} />
          <DetailField label="Loaded assets" value={assets.length} />
          <DetailField
            label="Manage actions"
            value={canManage ? "settings.manage enabled" : "Read-only account"}
          />
          <DetailField label="Filtering scope" value="Current page only" />
        </dl>
        {canManage ? (
          <div className="mt-4">
            <Link
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              href="/master-data/assets/new"
            >
              Create asset
            </Link>
          </div>
        ) : null}
      </PageHeader>

      <AssetFilters
        assetTypeOptions={assetTypeOptions.length > 0 ? assetTypeOptions : EMPTY_OPTIONS}
        buildingOptions={buildingOptions.length > 0 ? buildingOptions : EMPTY_OPTIONS}
        onChange={setFilters}
        onReset={() =>
          setFilters({
            search: "",
            assetType: "",
            building: "",
            status: "all",
          })
        }
        values={filters}
      />

      {isLoading ? (
        <LoadingState
          title="Loading assets"
          message="Retrieving asset inventory, classification, and location context."
        />
      ) : null}

      {!isLoading && isError ? (
        <ErrorState
          title="Unable to load assets"
          message={getFirstQueryErrorMessage(
            [
              assetsQuery.error,
              tenantsQuery.error,
              organizationsQuery.error,
              assetTypesQuery.error,
              buildingsQuery.error,
              floorsQuery.error,
              areasQuery.error,
            ],
            "Asset records could not be loaded.",
          )}
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => {
                void assetsQuery.refetch();
                void tenantsQuery.refetch();
                void organizationsQuery.refetch();
                void assetTypesQuery.refetch();
                void buildingsQuery.refetch();
                void floorsQuery.refetch();
                void areasQuery.refetch();
              }}
              type="button"
            >
              Retry
            </button>
          }
        />
      ) : null}

      {!isLoading && !isError && assets.length === 0 ? (
        <EmptyState
          title="No assets found"
          message="No asset records are currently available from the master-data foundation."
          action={
            canManage ? (
              <Link
                className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                href="/master-data/assets/new"
              >
                Create asset
              </Link>
            ) : null
          }
        />
      ) : null}

      {!isLoading && !isError && assets.length > 0 && filteredAssets.length === 0 ? (
        <EmptyState
          title="No matching assets"
          message="No assets on the current loaded page match the selected filters. Clear or adjust the filters to see more results."
          action={
            <button
              className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() =>
                setFilters({
                  search: "",
                  assetType: "",
                  building: "",
                  status: "all",
                })
              }
              type="button"
            >
              Clear filters
            </button>
          }
        />
      ) : null}

      {!isLoading && !isError && filteredAssets.length > 0 ? (
        <DataTable
          caption="Assets list"
          columns={columns}
          getRowKey={(asset) => asset.id}
          rows={filteredAssets}
        />
      ) : null}
    </div>
  );
}
