"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { DetailField } from "@/components/common/detail-field";
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
  getAsset,
  getAssetTypes,
  getBuildings,
  getFloors,
  getOrganizations,
  getTenants,
} from "@/services/api/master-data";
import { masterDataQueryKeys } from "@/services/api/query-keys";
import type { PaginatedResponse } from "@/services/api/types";

import { AssetLocationBreadcrumb } from "./asset-location-breadcrumb";

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

function formatDate(value?: string): string {
  if (!value) {
    return "Unavailable from current backend serializer";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
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

export function AssetDetailScreen({ id }: { id: string }) {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("settings.manage");
  const assetQuery = useQuery({
    queryKey: masterDataQueryKeys.detail("assets", id),
    queryFn: () => getAsset(id),
  });
  const tenantsQuery = useNameMapQuery("tenants", () =>
    getTenants(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );
  const organizationsQuery = useNameMapQuery("organizations", () =>
    getOrganizations(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );
  const assetTypesQuery = useNameMapQuery("asset-types", () =>
    getAssetTypes(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );
  const buildingsQuery = useNameMapQuery("buildings", () =>
    getBuildings(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );
  const floorsQuery = useNameMapQuery("floors", () =>
    getFloors(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );
  const areasQuery = useNameMapQuery("areas", () =>
    getAreas(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );

  const isLoading =
    assetQuery.isPending ||
    tenantsQuery.isPending ||
    organizationsQuery.isPending ||
    assetTypesQuery.isPending ||
    buildingsQuery.isPending ||
    floorsQuery.isPending ||
    areasQuery.isPending;
  const isError =
    assetQuery.isError ||
    tenantsQuery.isError ||
    organizationsQuery.isError ||
    assetTypesQuery.isError ||
    buildingsQuery.isError ||
    floorsQuery.isError ||
    areasQuery.isError;

  if (isLoading) {
    return (
      <LoadingState
        title="Loading asset detail"
        message="Retrieving the selected asset and its location context."
      />
    );
  }

  if (isError || !assetQuery.data) {
    return (
      <ErrorState
        title="Unable to load asset"
        message={getFirstQueryErrorMessage(
          [
            assetQuery.error,
            tenantsQuery.error,
            organizationsQuery.error,
            assetTypesQuery.error,
            buildingsQuery.error,
            floorsQuery.error,
            areasQuery.error,
          ],
          "Asset detail could not be loaded.",
        )}
        action={
          <button
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            onClick={() => {
              void assetQuery.refetch();
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
    );
  }

  const asset = assetQuery.data;
  const tenantLabel = resolveEntityName(asset.tenant, tenantsQuery.data ?? {});
  const organizationLabel = resolveEntityName(
    asset.organization,
    organizationsQuery.data ?? {},
  );
  const buildingLabel = resolveEntityName(asset.building, buildingsQuery.data ?? {});
  const floorLabel = resolveEntityName(
    asset.floor,
    floorsQuery.data ?? {},
    "Floor not assigned",
  );
  const areaLabel = resolveEntityName(
    asset.area,
    areasQuery.data ?? {},
    "Area not assigned",
  );
  const assetTypeLabel = resolveEntityName(
    asset.asset_type,
    assetTypesQuery.data ?? {},
  );

  return (
    <div className="space-y-6">
      <PageHeader
        description={
          asset.description ||
          "This asset currently has no description in the master-data record."
        }
        eyebrow="Master data"
        title={asset.name}
      >
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            href="/master-data/assets"
          >
            Back to assets
          </Link>
          {canManage ? (
            <Link
              className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              href={`/master-data/assets/${asset.id}/edit`}
            >
              Edit asset
            </Link>
          ) : null}
        </div>
      </PageHeader>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Asset Information
        </h2>
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="Asset name" value={asset.name} />
          <DetailField label="Asset code" value={asset.code} />
          <DetailField
            label="Serial number"
            value={asset.serial_number || "Not provided"}
          />
          <DetailField label="Status" value={<StatusBadge isActive={asset.is_active} />} />
          <DetailField
            label="Description"
            value={asset.description || "No description provided"}
          />
        </dl>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Location
        </h2>
        <AssetLocationBreadcrumb
          area={asset.area}
          areaLabel={areaLabel}
          building={asset.building}
          buildingLabel={buildingLabel}
          floor={asset.floor}
          floorLabel={floorLabel}
          organization={asset.organization}
          organizationLabel={organizationLabel}
          tenant={asset.tenant}
          tenantLabel={tenantLabel}
        />
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <DetailField label="Tenant" value={tenantLabel} />
          <DetailField label="Organization" value={organizationLabel} />
          <DetailField label="Building" value={buildingLabel} />
          <DetailField label="Floor" value={floorLabel} />
          <DetailField label="Area" value={areaLabel} />
        </dl>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          Classification
        </h2>
        <dl className="grid gap-4 md:grid-cols-2">
          <DetailField label="Asset type" value={assetTypeLabel} />
          <DetailField label="Asset type route" value="/master-data/asset-types" />
        </dl>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          System Metadata
        </h2>
        <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DetailField label="Asset ID" value={<span className="font-mono text-xs">{asset.id}</span>} />
          <DetailField label="Created at" value={formatDate(asset.created_at)} />
          <DetailField label="Updated at" value={formatDate(asset.updated_at)} />
        </dl>
      </section>
    </div>
  );
}
