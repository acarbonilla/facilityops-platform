"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { DataTableColumn } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import {
  getAreas,
  getAssetTypes,
  getAssets,
  getBuildings,
  getDepartments,
  getFloors,
  getOrganizations,
  getTenants,
} from "@/services/api/master-data";
import { masterDataQueryKeys } from "@/services/api/query-keys";
import type {
  Area,
  Asset,
  AssetType,
  Building,
  Department,
  Floor,
  Organization,
  Tenant,
} from "@/types/master-data";
import {
  createEntityNameMap,
  DEFAULT_MASTER_DATA_LIST_PARAMS,
  getFirstQueryErrorMessage,
  resolveEntityName,
} from "@/lib/master-data/display";
import { MASTER_DATA_RESOURCES } from "@/lib/master-data/resources";

import { MasterDataListScreen } from "./master-data-list-screen";
import { MasterDataResourceCard } from "./master-data-resource-card";

function ManageActionLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      href={href}
    >
      {label}
    </Link>
  );
}

function useMasterDataWriteActions() {
  const { hasPermission } = usePermissions();

  return hasPermission("settings.manage");
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        isActive
          ? "bg-emerald-100 text-emerald-800"
          : "bg-slate-200 text-slate-700",
      ].join(" ")}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
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

function useNameMapQuery<T extends { id: string; name: string }>(
  resource: Parameters<typeof masterDataQueryKeys.list>[0],
  queryFn: () => Promise<{ results: T[] }>,
) {
  return useQuery({
    queryKey: masterDataQueryKeys.list(resource, DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn,
    select: (data) => createEntityNameMap(data.results),
  });
}

export function MasterDataLandingContent() {
  const canManage = useMasterDataWriteActions();

  return (
    <div className="space-y-6">
      <PageHeader
        description="Master data screens for the FacilityOps foundation. Create and edit workflows are available for authorized users, while delete, import, and export remain outside this task."
        eyebrow="Master data"
        title="Master Data"
      >
        {canManage ? (
          <ManageActionLink href="/master-data/tenants/new" label="Create tenant" />
        ) : null}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MASTER_DATA_RESOURCES.map((resource) => (
          <MasterDataResourceCard key={resource.key} resource={resource} />
        ))}
      </div>

      <EmptyState
        title="Scoped foundation"
        message="Create and edit flows are limited to master data only. Delete, import, export, and business workflows remain out of scope."
      />
    </div>
  );
}

export function TenantsReadScreen() {
  const canManage = useMasterDataWriteActions();
  const tenantsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("tenants", DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn: () => getTenants(DEFAULT_MASTER_DATA_LIST_PARAMS),
  });

  const columns: DataTableColumn<Tenant>[] = [
    {
      header: "Name",
      cell: (tenant) => <CellStack primary={tenant.name} secondary={tenant.description} />,
      className: "min-w-64",
    },
    { header: "Code", cell: (tenant) => tenant.code },
    {
      header: "Status",
      cell: (tenant) => <StatusBadge isActive={tenant.is_active} />,
    },
    ...(canManage
      ? [
          {
            header: "Actions",
            cell: (tenant: Tenant) => (
              <ManageActionLink
                href={`/master-data/tenants/${tenant.id}/edit`}
                label="Edit"
              />
            ),
          } satisfies DataTableColumn<Tenant>,
        ]
      : []),
  ];

  return (
    <MasterDataListScreen
      columns={columns}
      count={tenantsQuery.data?.count ?? 0}
      description="Tenant records define the highest-level ownership boundary for organizations, buildings, and assets."
      emptyMessage="No tenant records are currently available."
      errorMessage={tenantsQuery.isError ? getFirstQueryErrorMessage([tenantsQuery.error], "Tenant records could not be loaded.") : null}
      getRowKey={(tenant) => tenant.id}
      isLoading={tenantsQuery.isPending}
      items={tenantsQuery.data?.results ?? []}
      onRetry={() => void tenantsQuery.refetch()}
      actions={
        canManage ? (
          <ManageActionLink href="/master-data/tenants/new" label="New tenant" />
        ) : null
      }
      title="Tenants"
    />
  );
}

export function OrganizationsReadScreen() {
  const canManage = useMasterDataWriteActions();
  const organizationsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("organizations", DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn: () => getOrganizations(DEFAULT_MASTER_DATA_LIST_PARAMS),
  });
  const tenantsQuery = useNameMapQuery("tenants", () =>
    getTenants(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );

  const columns: DataTableColumn<Organization>[] = [
    {
      header: "Name",
      cell: (organization) => (
        <CellStack primary={organization.name} secondary={organization.description} />
      ),
      className: "min-w-64",
    },
    { header: "Code", cell: (organization) => organization.code },
    {
      header: "Tenant",
      cell: (organization) =>
        resolveEntityName(organization.tenant, tenantsQuery.data ?? {}),
    },
    {
      header: "Status",
      cell: (organization) => <StatusBadge isActive={organization.is_active} />,
    },
    ...(canManage
      ? [
          {
            header: "Actions",
            cell: (organization: Organization) => (
              <ManageActionLink
                href={`/master-data/organizations/${organization.id}/edit`}
                label="Edit"
              />
            ),
          } satisfies DataTableColumn<Organization>,
        ]
      : []),
  ];

  const isLoading = organizationsQuery.isPending || tenantsQuery.isPending;
  const isError = organizationsQuery.isError || tenantsQuery.isError;

  return (
    <MasterDataListScreen
      columns={columns}
      count={organizationsQuery.data?.count ?? 0}
      description="Organizations group operational structures under a tenant and connect downstream departments, buildings, and assets."
      emptyMessage="No organization records are currently available."
      errorMessage={isError ? getFirstQueryErrorMessage([organizationsQuery.error, tenantsQuery.error], "Organization records could not be loaded.") : null}
      getRowKey={(organization) => organization.id}
      isLoading={isLoading}
      items={organizationsQuery.data?.results ?? []}
      onRetry={() => {
        void organizationsQuery.refetch();
        void tenantsQuery.refetch();
      }}
      actions={
        canManage ? (
          <ManageActionLink
            href="/master-data/organizations/new"
            label="New organization"
          />
        ) : null
      }
      title="Organizations"
    />
  );
}

export function DepartmentsReadScreen() {
  const canManage = useMasterDataWriteActions();
  const departmentsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("departments", DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn: () => getDepartments(DEFAULT_MASTER_DATA_LIST_PARAMS),
  });
  const organizationsQuery = useNameMapQuery("organizations", () =>
    getOrganizations(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );

  const columns: DataTableColumn<Department>[] = [
    {
      header: "Name",
      cell: (department) => (
        <CellStack primary={department.name} secondary={department.description} />
      ),
      className: "min-w-64",
    },
    { header: "Code", cell: (department) => department.code },
    {
      header: "Organization",
      cell: (department) =>
        resolveEntityName(department.organization, organizationsQuery.data ?? {}),
    },
    {
      header: "Status",
      cell: (department) => <StatusBadge isActive={department.is_active} />,
    },
    ...(canManage
      ? [
          {
            header: "Actions",
            cell: (department: Department) => (
              <ManageActionLink
                href={`/master-data/departments/${department.id}/edit`}
                label="Edit"
              />
            ),
          } satisfies DataTableColumn<Department>,
        ]
      : []),
  ];

  const isLoading = departmentsQuery.isPending || organizationsQuery.isPending;
  const isError = departmentsQuery.isError || organizationsQuery.isError;

  return (
    <MasterDataListScreen
      columns={columns}
      count={departmentsQuery.data?.count ?? 0}
      description="Departments represent internal teams or business functions within an organization."
      emptyMessage="No department records are currently available."
      errorMessage={isError ? getFirstQueryErrorMessage([departmentsQuery.error, organizationsQuery.error], "Department records could not be loaded.") : null}
      getRowKey={(department) => department.id}
      isLoading={isLoading}
      items={departmentsQuery.data?.results ?? []}
      onRetry={() => {
        void departmentsQuery.refetch();
        void organizationsQuery.refetch();
      }}
      actions={
        canManage ? (
          <ManageActionLink
            href="/master-data/departments/new"
            label="New department"
          />
        ) : null
      }
      title="Departments"
    />
  );
}

export function BuildingsReadScreen() {
  const canManage = useMasterDataWriteActions();
  const buildingsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("buildings", DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn: () => getBuildings(DEFAULT_MASTER_DATA_LIST_PARAMS),
  });
  const organizationsQuery = useNameMapQuery("organizations", () =>
    getOrganizations(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );

  const columns: DataTableColumn<Building>[] = [
    {
      header: "Name",
      cell: (building) => (
        <CellStack primary={building.name} secondary={building.description} />
      ),
      className: "min-w-64",
    },
    { header: "Code", cell: (building) => building.code },
    {
      header: "Organization",
      cell: (building) =>
        resolveEntityName(building.organization, organizationsQuery.data ?? {}),
    },
    {
      header: "Address",
      cell: (building) => building.address || "Not provided",
      className: "min-w-72 whitespace-normal",
    },
    {
      header: "Status",
      cell: (building) => <StatusBadge isActive={building.is_active} />,
    },
    ...(canManage
      ? [
          {
            header: "Actions",
            cell: (building: Building) => (
              <ManageActionLink
                href={`/master-data/buildings/${building.id}/edit`}
                label="Edit"
              />
            ),
          } satisfies DataTableColumn<Building>,
        ]
      : []),
  ];

  const isLoading = buildingsQuery.isPending || organizationsQuery.isPending;
  const isError = buildingsQuery.isError || organizationsQuery.isError;

  return (
    <MasterDataListScreen
      columns={columns}
      count={buildingsQuery.data?.count ?? 0}
      description="Buildings define the physical site layer used by floors, areas, and assets."
      emptyMessage="No building records are currently available."
      errorMessage={isError ? getFirstQueryErrorMessage([buildingsQuery.error, organizationsQuery.error], "Building records could not be loaded.") : null}
      getRowKey={(building) => building.id}
      isLoading={isLoading}
      items={buildingsQuery.data?.results ?? []}
      onRetry={() => {
        void buildingsQuery.refetch();
        void organizationsQuery.refetch();
      }}
      actions={
        canManage ? (
          <ManageActionLink href="/master-data/buildings/new" label="New building" />
        ) : null
      }
      title="Buildings"
    />
  );
}

export function FloorsReadScreen() {
  const canManage = useMasterDataWriteActions();
  const floorsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("floors", DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn: () => getFloors(DEFAULT_MASTER_DATA_LIST_PARAMS),
  });
  const buildingsQuery = useNameMapQuery("buildings", () =>
    getBuildings(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );

  const columns: DataTableColumn<Floor>[] = [
    {
      header: "Name",
      cell: (floor) => <CellStack primary={floor.name} secondary={floor.description} />,
      className: "min-w-64",
    },
    { header: "Code", cell: (floor) => floor.code },
    {
      header: "Building",
      cell: (floor) => resolveEntityName(floor.building, buildingsQuery.data ?? {}),
    },
    { header: "Level", cell: (floor) => floor.level_number },
    {
      header: "Status",
      cell: (floor) => <StatusBadge isActive={floor.is_active} />,
    },
    ...(canManage
      ? [
          {
            header: "Actions",
            cell: (floor: Floor) => (
              <ManageActionLink
                href={`/master-data/floors/${floor.id}/edit`}
                label="Edit"
              />
            ),
          } satisfies DataTableColumn<Floor>,
        ]
      : []),
  ];

  const isLoading = floorsQuery.isPending || buildingsQuery.isPending;
  const isError = floorsQuery.isError || buildingsQuery.isError;

  return (
    <MasterDataListScreen
      columns={columns}
      count={floorsQuery.data?.count ?? 0}
      description="Floors organize the vertical structure of each building and support downstream area and asset placement."
      emptyMessage="No floor records are currently available."
      errorMessage={isError ? getFirstQueryErrorMessage([floorsQuery.error, buildingsQuery.error], "Floor records could not be loaded.") : null}
      getRowKey={(floor) => floor.id}
      isLoading={isLoading}
      items={floorsQuery.data?.results ?? []}
      onRetry={() => {
        void floorsQuery.refetch();
        void buildingsQuery.refetch();
      }}
      actions={
        canManage ? (
          <ManageActionLink href="/master-data/floors/new" label="New floor" />
        ) : null
      }
      title="Floors"
    />
  );
}

export function AreasReadScreen() {
  const canManage = useMasterDataWriteActions();
  const areasQuery = useQuery({
    queryKey: masterDataQueryKeys.list("areas", DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn: () => getAreas(DEFAULT_MASTER_DATA_LIST_PARAMS),
  });
  const buildingsQuery = useNameMapQuery("buildings", () =>
    getBuildings(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );
  const floorsQuery = useNameMapQuery("floors", () =>
    getFloors(DEFAULT_MASTER_DATA_LIST_PARAMS),
  );

  const columns: DataTableColumn<Area>[] = [
    {
      header: "Name",
      cell: (area) => <CellStack primary={area.name} secondary={area.description} />,
      className: "min-w-64",
    },
    { header: "Code", cell: (area) => area.code },
    {
      header: "Building",
      cell: (area) => resolveEntityName(area.building, buildingsQuery.data ?? {}),
    },
    {
      header: "Floor",
      cell: (area) => resolveEntityName(area.floor, floorsQuery.data ?? {}),
    },
    {
      header: "Status",
      cell: (area) => <StatusBadge isActive={area.is_active} />,
    },
    ...(canManage
      ? [
          {
            header: "Actions",
            cell: (area: Area) => (
              <ManageActionLink
                href={`/master-data/areas/${area.id}/edit`}
                label="Edit"
              />
            ),
          } satisfies DataTableColumn<Area>,
        ]
      : []),
  ];

  const isLoading =
    areasQuery.isPending || buildingsQuery.isPending || floorsQuery.isPending;
  const isError =
    areasQuery.isError || buildingsQuery.isError || floorsQuery.isError;

  return (
    <MasterDataListScreen
      columns={columns}
      count={areasQuery.data?.count ?? 0}
      description="Areas capture functional spaces within a floor, such as rooms, zones, or service sections."
      emptyMessage="No area records are currently available."
      errorMessage={isError ? getFirstQueryErrorMessage([areasQuery.error, buildingsQuery.error, floorsQuery.error], "Area records could not be loaded.") : null}
      getRowKey={(area) => area.id}
      isLoading={isLoading}
      items={areasQuery.data?.results ?? []}
      onRetry={() => {
        void areasQuery.refetch();
        void buildingsQuery.refetch();
        void floorsQuery.refetch();
      }}
      actions={
        canManage ? (
          <ManageActionLink href="/master-data/areas/new" label="New area" />
        ) : null
      }
      title="Areas"
    />
  );
}

export function AssetTypesReadScreen() {
  const canManage = useMasterDataWriteActions();
  const assetTypesQuery = useQuery({
    queryKey: masterDataQueryKeys.list("asset-types", DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn: () => getAssetTypes(DEFAULT_MASTER_DATA_LIST_PARAMS),
  });

  const columns: DataTableColumn<AssetType>[] = [
    {
      header: "Name",
      cell: (assetType) => (
        <CellStack primary={assetType.name} secondary={assetType.description} />
      ),
      className: "min-w-64",
    },
    { header: "Code", cell: (assetType) => assetType.code },
    {
      header: "Status",
      cell: (assetType) => <StatusBadge isActive={assetType.is_active} />,
    },
    ...(canManage
      ? [
          {
            header: "Actions",
            cell: (assetType: AssetType) => (
              <ManageActionLink
                href={`/master-data/asset-types/${assetType.id}/edit`}
                label="Edit"
              />
            ),
          } satisfies DataTableColumn<AssetType>,
        ]
      : []),
  ];

  return (
    <MasterDataListScreen
      columns={columns}
      count={assetTypesQuery.data?.count ?? 0}
      description="Asset types provide the classification layer used to categorize operational assets."
      emptyMessage="No asset type records are currently available."
      errorMessage={assetTypesQuery.isError ? getFirstQueryErrorMessage([assetTypesQuery.error], "Asset type records could not be loaded.") : null}
      getRowKey={(assetType) => assetType.id}
      isLoading={assetTypesQuery.isPending}
      items={assetTypesQuery.data?.results ?? []}
      onRetry={() => void assetTypesQuery.refetch()}
      actions={
        canManage ? (
          <ManageActionLink
            href="/master-data/asset-types/new"
            label="New asset type"
          />
        ) : null
      }
      title="Asset Types"
    />
  );
}

export function AssetsReadScreen() {
  const canManage = useMasterDataWriteActions();
  const assetsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("assets", DEFAULT_MASTER_DATA_LIST_PARAMS),
    queryFn: () => getAssets(DEFAULT_MASTER_DATA_LIST_PARAMS),
  });
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

  const columns: DataTableColumn<Asset>[] = [
    {
      header: "Name",
      cell: (asset) => <CellStack primary={asset.name} secondary={asset.description} />,
      className: "min-w-64",
    },
    { header: "Code", cell: (asset) => asset.code },
    {
      header: "Asset type",
      cell: (asset) => resolveEntityName(asset.asset_type, assetTypesQuery.data ?? {}),
    },
    {
      header: "Building",
      cell: (asset) => resolveEntityName(asset.building, buildingsQuery.data ?? {}),
    },
    {
      header: "Floor",
      cell: (asset) =>
        resolveEntityName(asset.floor, floorsQuery.data ?? {}, "Not assigned"),
    },
    {
      header: "Area",
      cell: (asset) =>
        resolveEntityName(asset.area, areasQuery.data ?? {}, "Not assigned"),
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
    ...(canManage
      ? [
          {
            header: "Actions",
            cell: (asset: Asset) => (
              <ManageActionLink
                href={`/master-data/assets/${asset.id}/edit`}
                label="Edit"
              />
            ),
          } satisfies DataTableColumn<Asset>,
        ]
      : []),
  ];

  const isLoading =
    assetsQuery.isPending ||
    assetTypesQuery.isPending ||
    buildingsQuery.isPending ||
    floorsQuery.isPending ||
    areasQuery.isPending;
  const isError =
    assetsQuery.isError ||
    assetTypesQuery.isError ||
    buildingsQuery.isError ||
    floorsQuery.isError ||
    areasQuery.isError;

  return (
    <MasterDataListScreen
      columns={columns}
      count={assetsQuery.data?.count ?? 0}
      description="Assets expose the seeded operational inventory linked to type and location master data."
      emptyMessage="No asset records are currently available."
      errorMessage={isError ? getFirstQueryErrorMessage([assetsQuery.error, assetTypesQuery.error, buildingsQuery.error, floorsQuery.error, areasQuery.error], "Asset records could not be loaded.") : null}
      getRowKey={(asset) => asset.id}
      isLoading={isLoading}
      items={assetsQuery.data?.results ?? []}
      onRetry={() => {
        void assetsQuery.refetch();
        void assetTypesQuery.refetch();
        void buildingsQuery.refetch();
        void floorsQuery.refetch();
        void areasQuery.refetch();
      }}
      actions={
        canManage ? (
          <ManageActionLink href="/master-data/assets/new" label="New asset" />
        ) : null
      }
      title="Assets"
    />
  );
}
