"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { AppShell } from "@/components/layout/app-shell";
import { DEFAULT_MASTER_DATA_LIST_PARAMS, getFirstQueryErrorMessage } from "@/lib/master-data/display";
import {
  bindTenantToPayload,
  collectPaginatedMasterData,
  formatMasterDataError,
  getMasterDataInvalidationKeys,
  getMasterDataSessionScope,
} from "@/lib/master-data/lifecycle";
import { useAuth } from "@/hooks/use-auth";
import {
  createArea,
  createAsset,
  createAssetType,
  createBuilding,
  createDepartment,
  createFloor,
  createOrganization,
  getArea,
  getAreas,
  getAsset,
  getAssetType,
  getAssetTypes,
  getBuilding,
  getBuildings,
  getDepartment,
  getFloor,
  getFloors,
  getOrganization,
  getOrganizations,
  getTenant,
  getTenants,
  updateArea,
  updateAsset,
  updateAssetType,
  updateBuilding,
  updateDepartment,
  updateFloor,
  updateOrganization,
  updateTenant,
} from "@/services/api/master-data";
import { masterDataQueryKeys } from "@/services/api/query-keys";
import type {
  AreaFormValues,
  AssetFormValues,
  AssetTypeFormValues,
  BuildingFormValues,
  DepartmentFormValues,
  FloorFormValues,
  MasterDataResourceKey,
  OrganizationFormValues,
  TenantFormValues,
} from "@/types/master-data";

import { AreaForm } from "./area-form";
import { AssetForm } from "./asset-form";
import { AssetTypeForm } from "./asset-type-form";
import { BuildingForm } from "./building-form";
import { DepartmentForm } from "./department-form";
import { FloorForm } from "./floor-form";
import { OrganizationForm } from "./organization-form";
import { TenantForm } from "./tenant-form";

function extractErrorMessage(error: unknown, fallback: string) {
  return formatMasterDataError(error, fallback);
}

function FormPageLayout({
  children,
  description,
  errorMessage,
  title,
}: {
  children: React.ReactNode;
  description: string;
  errorMessage?: string | null;
  title: string;
}) {
  return (
    <ProtectedPermissionRoute requiredPermission="settings.manage">
      <AppShell>
        <div className="space-y-6">
          <PageHeader
            description={description}
            eyebrow="Master data"
            title={title}
          />
          {errorMessage ? (
            <ErrorState message={errorMessage} title="Unable to save changes" />
          ) : null}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            {children}
          </section>
        </div>
      </AppShell>
    </ProtectedPermissionRoute>
  );
}

function useMasterDataMutation<TValues, TResult>(
  resource: MasterDataResourceKey,
  listHref: string,
  mutationFn: (values: TValues) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: (values: TValues) =>
      mutationFn(bindTenantToPayload(values as object, user?.tenant) as TValues),
    onSuccess: async () => {
      await Promise.all(
        getMasterDataInvalidationKeys(resource).map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      router.replace(listHref);
      router.refresh();
    },
  });

  return {
    ...mutation,
    mutateAsync: async (values: TValues) => {
      try {
        return await mutation.mutateAsync(values);
      } catch {
        return undefined;
      }
    },
  };
}

function useListResultsQuery<T extends { id: string }>(
  resource: MasterDataResourceKey,
  queryFn: (params: typeof DEFAULT_MASTER_DATA_LIST_PARAMS) => Promise<{
    results: T[];
    next?: string | null;
  }>,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: masterDataQueryKeys.options(
      resource,
      getMasterDataSessionScope(user?.id, user?.tenant),
    ),
    queryFn: () => collectPaginatedMasterData(queryFn),
    select: (results) =>
      resource === "tenants" && user?.tenant
        ? results.filter((record) => record.id === user.tenant)
        : results,
  });
}

function RelatedDataLoadingState({ title }: { title: string }) {
  return (
    <ProtectedPermissionRoute requiredPermission="settings.manage">
      <AppShell>
        <LoadingState
          title={title}
          message="Loading the current record and related master data options."
        />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}

function RelatedDataErrorState({
  message,
  title,
}: {
  message: string;
  title: string;
}) {
  return (
    <ProtectedPermissionRoute requiredPermission="settings.manage">
      <AppShell>
        <ErrorState message={message} title={title} />
      </AppShell>
    </ProtectedPermissionRoute>
  );
}

export function TenantCreatePageContent() {
  return (
    <FormPageLayout
      description="Tenant creation requires a confirmed global API administrator."
      errorMessage="This frontend session does not expose reliable global-role evidence. Use the API administration workflow to create tenants."
      title="New Tenant"
    >
      <p className="text-sm text-slate-600">
        Tenant creation is unavailable here and is never inferred from staff status.
      </p>
    </FormPageLayout>
  );
}

export function TenantEditPageContent({ id }: { id: string }) {
  const recordQuery = useQuery({
    queryKey: masterDataQueryKeys.detail("tenants", id),
    queryFn: () => getTenant(id),
  });
  const mutation = useMasterDataMutation<TenantFormValues, unknown>(
    "tenants",
    "/master-data/tenants",
    (values) => updateTenant(id, values),
  );

  if (recordQuery.isPending) {
    return <RelatedDataLoadingState title="Loading tenant" />;
  }

  if (recordQuery.isError || !recordQuery.data) {
    return (
      <RelatedDataErrorState
        message={extractErrorMessage(recordQuery.error, "Tenant could not be loaded.")}
        title="Unable to load tenant"
      />
    );
  }

  return (
    <FormPageLayout
      description="Update the selected tenant record."
      errorMessage={
        mutation.isError
          ? extractErrorMessage(mutation.error, "Tenant could not be updated.")
          : null
      }
      title="Edit Tenant"
    >
      <TenantForm
        cancelHref="/master-data/tenants"
        initialValues={recordQuery.data}
        isSubmitting={mutation.isPending}
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
        }}
        submitLabel="Save tenant"
      />
    </FormPageLayout>
  );
}

export function OrganizationCreatePageContent() {
  const tenantsQuery = useListResultsQuery("tenants", getTenants);
  const mutation = useMasterDataMutation<OrganizationFormValues, unknown>(
    "organizations",
    "/master-data/organizations",
    createOrganization,
  );

  if (tenantsQuery.isPending) {
    return <RelatedDataLoadingState title="Loading organization form" />;
  }

  if (tenantsQuery.isError) {
    return (
      <RelatedDataErrorState
        message={extractErrorMessage(tenantsQuery.error, "Tenant options could not be loaded.")}
        title="Unable to load organization form"
      />
    );
  }

  return (
    <FormPageLayout
      description="Create an organization and associate it with a tenant."
      errorMessage={
        mutation.isError
          ? extractErrorMessage(mutation.error, "Organization could not be created.")
          : null
      }
      title="New Organization"
    >
      <OrganizationForm
        cancelHref="/master-data/organizations"
        isSubmitting={mutation.isPending}
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
        }}
        submitLabel="Create organization"
        tenants={tenantsQuery.data ?? []}
      />
    </FormPageLayout>
  );
}

export function OrganizationEditPageContent({ id }: { id: string }) {
  const recordQuery = useQuery({
    queryKey: masterDataQueryKeys.detail("organizations", id),
    queryFn: () => getOrganization(id),
  });
  const tenantsQuery = useListResultsQuery("tenants", getTenants);
  const mutation = useMasterDataMutation<OrganizationFormValues, unknown>(
    "organizations",
    "/master-data/organizations",
    (values) => updateOrganization(id, values),
  );

  if (recordQuery.isPending || tenantsQuery.isPending) {
    return <RelatedDataLoadingState title="Loading organization" />;
  }

  if (recordQuery.isError || tenantsQuery.isError || !recordQuery.data) {
    return (
      <RelatedDataErrorState
        message={getFirstQueryErrorMessage(
          [recordQuery.error, tenantsQuery.error],
          "Organization data could not be loaded.",
        )}
        title="Unable to load organization"
      />
    );
  }

  return (
    <FormPageLayout
      description="Update the selected organization record."
      errorMessage={
        mutation.isError
          ? extractErrorMessage(mutation.error, "Organization could not be updated.")
          : null
      }
      title="Edit Organization"
    >
      <OrganizationForm
        cancelHref="/master-data/organizations"
        initialValues={recordQuery.data}
        isSubmitting={mutation.isPending}
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
        }}
        submitLabel="Save organization"
        tenants={tenantsQuery.data ?? []}
      />
    </FormPageLayout>
  );
}

export function DepartmentCreatePageContent() {
  const tenantsQuery = useListResultsQuery("tenants", getTenants);
  const organizationsQuery = useListResultsQuery("organizations", getOrganizations);
  const mutation = useMasterDataMutation<DepartmentFormValues, unknown>(
    "departments",
    "/master-data/departments",
    createDepartment,
  );

  if (tenantsQuery.isPending || organizationsQuery.isPending) {
    return <RelatedDataLoadingState title="Loading department form" />;
  }

  if (tenantsQuery.isError || organizationsQuery.isError) {
    return (
      <RelatedDataErrorState
        message={getFirstQueryErrorMessage(
          [tenantsQuery.error, organizationsQuery.error],
          "Related department options could not be loaded.",
        )}
        title="Unable to load department form"
      />
    );
  }

  return (
    <FormPageLayout
      description="Create a department under an existing tenant and organization."
      errorMessage={
        mutation.isError
          ? extractErrorMessage(mutation.error, "Department could not be created.")
          : null
      }
      title="New Department"
    >
      <DepartmentForm
        cancelHref="/master-data/departments"
        isSubmitting={mutation.isPending}
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
        }}
        organizations={organizationsQuery.data ?? []}
        submitLabel="Create department"
        tenants={tenantsQuery.data ?? []}
      />
    </FormPageLayout>
  );
}

export function DepartmentEditPageContent({ id }: { id: string }) {
  const recordQuery = useQuery({
    queryKey: masterDataQueryKeys.detail("departments", id),
    queryFn: () => getDepartment(id),
  });
  const tenantsQuery = useListResultsQuery("tenants", getTenants);
  const organizationsQuery = useListResultsQuery("organizations", getOrganizations);
  const mutation = useMasterDataMutation<DepartmentFormValues, unknown>(
    "departments",
    "/master-data/departments",
    (values) => updateDepartment(id, values),
  );

  if (recordQuery.isPending || tenantsQuery.isPending || organizationsQuery.isPending) {
    return <RelatedDataLoadingState title="Loading department" />;
  }

  if (recordQuery.isError || tenantsQuery.isError || organizationsQuery.isError || !recordQuery.data) {
    return (
      <RelatedDataErrorState
        message={getFirstQueryErrorMessage(
          [recordQuery.error, tenantsQuery.error, organizationsQuery.error],
          "Department data could not be loaded.",
        )}
        title="Unable to load department"
      />
    );
  }

  return (
    <FormPageLayout
      description="Update the selected department record."
      errorMessage={
        mutation.isError
          ? extractErrorMessage(mutation.error, "Department could not be updated.")
          : null
      }
      title="Edit Department"
    >
      <DepartmentForm
        cancelHref="/master-data/departments"
        initialValues={recordQuery.data}
        isSubmitting={mutation.isPending}
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
        }}
        organizations={organizationsQuery.data ?? []}
        submitLabel="Save department"
        tenants={tenantsQuery.data ?? []}
      />
    </FormPageLayout>
  );
}

export function BuildingCreatePageContent() {
  const tenantsQuery = useListResultsQuery("tenants", getTenants);
  const organizationsQuery = useListResultsQuery("organizations", getOrganizations);
  const mutation = useMasterDataMutation<BuildingFormValues, unknown>(
    "buildings",
    "/master-data/buildings",
    createBuilding,
  );

  if (tenantsQuery.isPending || organizationsQuery.isPending) {
    return <RelatedDataLoadingState title="Loading building form" />;
  }

  if (tenantsQuery.isError || organizationsQuery.isError) {
    return (
      <RelatedDataErrorState
        message={getFirstQueryErrorMessage(
          [tenantsQuery.error, organizationsQuery.error],
          "Related building options could not be loaded.",
        )}
        title="Unable to load building form"
      />
    );
  }

  return (
    <FormPageLayout
      description="Create a building record with tenant, organization, and address context."
      errorMessage={
        mutation.isError
          ? extractErrorMessage(mutation.error, "Building could not be created.")
          : null
      }
      title="New Building"
    >
      <BuildingForm
        cancelHref="/master-data/buildings"
        isSubmitting={mutation.isPending}
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
        }}
        organizations={organizationsQuery.data ?? []}
        submitLabel="Create building"
        tenants={tenantsQuery.data ?? []}
      />
    </FormPageLayout>
  );
}

export function BuildingEditPageContent({ id }: { id: string }) {
  const recordQuery = useQuery({
    queryKey: masterDataQueryKeys.detail("buildings", id),
    queryFn: () => getBuilding(id),
  });
  const tenantsQuery = useListResultsQuery("tenants", getTenants);
  const organizationsQuery = useListResultsQuery("organizations", getOrganizations);
  const mutation = useMasterDataMutation<BuildingFormValues, unknown>(
    "buildings",
    "/master-data/buildings",
    (values) => updateBuilding(id, values),
  );

  if (recordQuery.isPending || tenantsQuery.isPending || organizationsQuery.isPending) {
    return <RelatedDataLoadingState title="Loading building" />;
  }

  if (recordQuery.isError || tenantsQuery.isError || organizationsQuery.isError || !recordQuery.data) {
    return (
      <RelatedDataErrorState
        message={getFirstQueryErrorMessage(
          [recordQuery.error, tenantsQuery.error, organizationsQuery.error],
          "Building data could not be loaded.",
        )}
        title="Unable to load building"
      />
    );
  }

  return (
    <FormPageLayout
      description="Update the selected building record."
      errorMessage={
        mutation.isError
          ? extractErrorMessage(mutation.error, "Building could not be updated.")
          : null
      }
      title="Edit Building"
    >
      <BuildingForm
        cancelHref="/master-data/buildings"
        initialValues={recordQuery.data}
        isSubmitting={mutation.isPending}
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
        }}
        organizations={organizationsQuery.data ?? []}
        submitLabel="Save building"
        tenants={tenantsQuery.data ?? []}
      />
    </FormPageLayout>
  );
}

export function FloorCreatePageContent() {
  const tenantsQuery = useListResultsQuery("tenants", getTenants);
  const buildingsQuery = useListResultsQuery("buildings", getBuildings);
  const mutation = useMasterDataMutation<FloorFormValues, unknown>(
    "floors",
    "/master-data/floors",
    createFloor,
  );

  if (tenantsQuery.isPending || buildingsQuery.isPending) {
    return <RelatedDataLoadingState title="Loading floor form" />;
  }

  if (tenantsQuery.isError || buildingsQuery.isError) {
    return (
      <RelatedDataErrorState
        message={getFirstQueryErrorMessage(
          [tenantsQuery.error, buildingsQuery.error],
          "Related floor options could not be loaded.",
        )}
        title="Unable to load floor form"
      />
    );
  }

  return (
    <FormPageLayout
      description="Create a floor record under an existing building."
      errorMessage={
        mutation.isError
          ? extractErrorMessage(mutation.error, "Floor could not be created.")
          : null
      }
      title="New Floor"
    >
      <FloorForm
        buildings={buildingsQuery.data ?? []}
        cancelHref="/master-data/floors"
        isSubmitting={mutation.isPending}
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
        }}
        submitLabel="Create floor"
        tenants={tenantsQuery.data ?? []}
      />
    </FormPageLayout>
  );
}

export function FloorEditPageContent({ id }: { id: string }) {
  const recordQuery = useQuery({
    queryKey: masterDataQueryKeys.detail("floors", id),
    queryFn: () => getFloor(id),
  });
  const tenantsQuery = useListResultsQuery("tenants", getTenants);
  const buildingsQuery = useListResultsQuery("buildings", getBuildings);
  const mutation = useMasterDataMutation<FloorFormValues, unknown>(
    "floors",
    "/master-data/floors",
    (values) => updateFloor(id, values),
  );

  if (recordQuery.isPending || tenantsQuery.isPending || buildingsQuery.isPending) {
    return <RelatedDataLoadingState title="Loading floor" />;
  }

  if (recordQuery.isError || tenantsQuery.isError || buildingsQuery.isError || !recordQuery.data) {
    return (
      <RelatedDataErrorState
        message={getFirstQueryErrorMessage(
          [recordQuery.error, tenantsQuery.error, buildingsQuery.error],
          "Floor data could not be loaded.",
        )}
        title="Unable to load floor"
      />
    );
  }

  return (
    <FormPageLayout
      description="Update the selected floor record."
      errorMessage={
        mutation.isError
          ? extractErrorMessage(mutation.error, "Floor could not be updated.")
          : null
      }
      title="Edit Floor"
    >
      <FloorForm
        buildings={buildingsQuery.data ?? []}
        cancelHref="/master-data/floors"
        initialValues={recordQuery.data}
        isSubmitting={mutation.isPending}
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
        }}
        submitLabel="Save floor"
        tenants={tenantsQuery.data ?? []}
      />
    </FormPageLayout>
  );
}

export function AreaCreatePageContent() {
  const tenantsQuery = useListResultsQuery("tenants", getTenants);
  const buildingsQuery = useListResultsQuery("buildings", getBuildings);
  const floorsQuery = useListResultsQuery("floors", getFloors);
  const mutation = useMasterDataMutation<AreaFormValues, unknown>(
    "areas",
    "/master-data/areas",
    createArea,
  );

  if (tenantsQuery.isPending || buildingsQuery.isPending || floorsQuery.isPending) {
    return <RelatedDataLoadingState title="Loading area form" />;
  }

  if (tenantsQuery.isError || buildingsQuery.isError || floorsQuery.isError) {
    return (
      <RelatedDataErrorState
        message={getFirstQueryErrorMessage(
          [tenantsQuery.error, buildingsQuery.error, floorsQuery.error],
          "Related area options could not be loaded.",
        )}
        title="Unable to load area form"
      />
    );
  }

  return (
    <FormPageLayout
      description="Create an area record and associate it with a building and floor."
      errorMessage={
        mutation.isError
          ? extractErrorMessage(mutation.error, "Area could not be created.")
          : null
      }
      title="New Area"
    >
      <AreaForm
        buildings={buildingsQuery.data ?? []}
        cancelHref="/master-data/areas"
        floors={floorsQuery.data ?? []}
        isSubmitting={mutation.isPending}
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
        }}
        submitLabel="Create area"
        tenants={tenantsQuery.data ?? []}
      />
    </FormPageLayout>
  );
}

export function AreaEditPageContent({ id }: { id: string }) {
  const recordQuery = useQuery({
    queryKey: masterDataQueryKeys.detail("areas", id),
    queryFn: () => getArea(id),
  });
  const tenantsQuery = useListResultsQuery("tenants", getTenants);
  const buildingsQuery = useListResultsQuery("buildings", getBuildings);
  const floorsQuery = useListResultsQuery("floors", getFloors);
  const mutation = useMasterDataMutation<AreaFormValues, unknown>(
    "areas",
    "/master-data/areas",
    (values) => updateArea(id, values),
  );

  if (recordQuery.isPending || tenantsQuery.isPending || buildingsQuery.isPending || floorsQuery.isPending) {
    return <RelatedDataLoadingState title="Loading area" />;
  }

  if (recordQuery.isError || tenantsQuery.isError || buildingsQuery.isError || floorsQuery.isError || !recordQuery.data) {
    return (
      <RelatedDataErrorState
        message={getFirstQueryErrorMessage(
          [recordQuery.error, tenantsQuery.error, buildingsQuery.error, floorsQuery.error],
          "Area data could not be loaded.",
        )}
        title="Unable to load area"
      />
    );
  }

  return (
    <FormPageLayout
      description="Update the selected area record."
      errorMessage={
        mutation.isError
          ? extractErrorMessage(mutation.error, "Area could not be updated.")
          : null
      }
      title="Edit Area"
    >
      <AreaForm
        buildings={buildingsQuery.data ?? []}
        cancelHref="/master-data/areas"
        floors={floorsQuery.data ?? []}
        initialValues={recordQuery.data}
        isSubmitting={mutation.isPending}
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
        }}
        submitLabel="Save area"
        tenants={tenantsQuery.data ?? []}
      />
    </FormPageLayout>
  );
}

export function AssetTypeCreatePageContent() {
  const tenantsQuery = useListResultsQuery("tenants", getTenants);
  const mutation = useMasterDataMutation<AssetTypeFormValues, unknown>(
    "asset-types",
    "/master-data/asset-types",
    createAssetType,
  );

  if (tenantsQuery.isPending) {
    return <RelatedDataLoadingState title="Loading asset type form" />;
  }

  if (tenantsQuery.isError) {
    return (
      <RelatedDataErrorState
        message={extractErrorMessage(tenantsQuery.error, "Tenant options could not be loaded.")}
        title="Unable to load asset type form"
      />
    );
  }

  return (
    <FormPageLayout
      description="Create an asset type classification under an existing tenant."
      errorMessage={
        mutation.isError
          ? extractErrorMessage(mutation.error, "Asset type could not be created.")
          : null
      }
      title="New Asset Type"
    >
      <AssetTypeForm
        cancelHref="/master-data/asset-types"
        isSubmitting={mutation.isPending}
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
        }}
        submitLabel="Create asset type"
        tenants={tenantsQuery.data ?? []}
      />
    </FormPageLayout>
  );
}

export function AssetTypeEditPageContent({ id }: { id: string }) {
  const recordQuery = useQuery({
    queryKey: masterDataQueryKeys.detail("asset-types", id),
    queryFn: () => getAssetType(id),
  });
  const tenantsQuery = useListResultsQuery("tenants", getTenants);
  const mutation = useMasterDataMutation<AssetTypeFormValues, unknown>(
    "asset-types",
    "/master-data/asset-types",
    (values) => updateAssetType(id, values),
  );

  if (recordQuery.isPending || tenantsQuery.isPending) {
    return <RelatedDataLoadingState title="Loading asset type" />;
  }

  if (recordQuery.isError || tenantsQuery.isError || !recordQuery.data) {
    return (
      <RelatedDataErrorState
        message={getFirstQueryErrorMessage(
          [recordQuery.error, tenantsQuery.error],
          "Asset type data could not be loaded.",
        )}
        title="Unable to load asset type"
      />
    );
  }

  return (
    <FormPageLayout
      description="Update the selected asset type record."
      errorMessage={
        mutation.isError
          ? extractErrorMessage(mutation.error, "Asset type could not be updated.")
          : null
      }
      title="Edit Asset Type"
    >
      <AssetTypeForm
        cancelHref="/master-data/asset-types"
        initialValues={recordQuery.data}
        isSubmitting={mutation.isPending}
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
        }}
        submitLabel="Save asset type"
        tenants={tenantsQuery.data ?? []}
      />
    </FormPageLayout>
  );
}

export function AssetCreatePageContent() {
  const tenantsQuery = useListResultsQuery("tenants", getTenants);
  const organizationsQuery = useListResultsQuery("organizations", getOrganizations);
  const buildingsQuery = useListResultsQuery("buildings", getBuildings);
  const floorsQuery = useListResultsQuery("floors", getFloors);
  const areasQuery = useListResultsQuery("areas", getAreas);
  const assetTypesQuery = useListResultsQuery("asset-types", getAssetTypes);
  const mutation = useMasterDataMutation<AssetFormValues, unknown>(
    "assets",
    "/master-data/assets",
    (values) =>
      createAsset({
        ...values,
        floor: values.floor || null,
        area: values.area || null,
      }),
  );

  if (
    tenantsQuery.isPending ||
    organizationsQuery.isPending ||
    buildingsQuery.isPending ||
    floorsQuery.isPending ||
    areasQuery.isPending ||
    assetTypesQuery.isPending
  ) {
    return <RelatedDataLoadingState title="Loading asset form" />;
  }

  if (
    tenantsQuery.isError ||
    organizationsQuery.isError ||
    buildingsQuery.isError ||
    floorsQuery.isError ||
    areasQuery.isError ||
    assetTypesQuery.isError
  ) {
    return (
      <RelatedDataErrorState
        message={getFirstQueryErrorMessage(
          [
            tenantsQuery.error,
            organizationsQuery.error,
            buildingsQuery.error,
            floorsQuery.error,
            areasQuery.error,
            assetTypesQuery.error,
          ],
          "Related asset options could not be loaded.",
        )}
        title="Unable to load asset form"
      />
    );
  }

  return (
    <FormPageLayout
      description="Create an asset and associate it with tenant, organization, type, and location records."
      errorMessage={
        mutation.isError
          ? extractErrorMessage(mutation.error, "Asset could not be created.")
          : null
      }
      title="New Asset"
    >
      <AssetForm
        areas={areasQuery.data ?? []}
        assetTypes={assetTypesQuery.data ?? []}
        buildings={buildingsQuery.data ?? []}
        cancelHref="/master-data/assets"
        floors={floorsQuery.data ?? []}
        isSubmitting={mutation.isPending}
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
        }}
        organizations={organizationsQuery.data ?? []}
        submitLabel="Create asset"
        tenants={tenantsQuery.data ?? []}
      />
    </FormPageLayout>
  );
}

export function AssetEditPageContent({ id }: { id: string }) {
  const recordQuery = useQuery({
    queryKey: masterDataQueryKeys.detail("assets", id),
    queryFn: () => getAsset(id),
  });
  const tenantsQuery = useListResultsQuery("tenants", getTenants);
  const organizationsQuery = useListResultsQuery("organizations", getOrganizations);
  const buildingsQuery = useListResultsQuery("buildings", getBuildings);
  const floorsQuery = useListResultsQuery("floors", getFloors);
  const areasQuery = useListResultsQuery("areas", getAreas);
  const assetTypesQuery = useListResultsQuery("asset-types", getAssetTypes);
  const mutation = useMasterDataMutation<AssetFormValues, unknown>(
    "assets",
    "/master-data/assets",
    (values) =>
      updateAsset(id, {
        ...values,
        floor: values.floor || null,
        area: values.area || null,
      }),
  );

  if (
    recordQuery.isPending ||
    tenantsQuery.isPending ||
    organizationsQuery.isPending ||
    buildingsQuery.isPending ||
    floorsQuery.isPending ||
    areasQuery.isPending ||
    assetTypesQuery.isPending
  ) {
    return <RelatedDataLoadingState title="Loading asset" />;
  }

  if (
    recordQuery.isError ||
    tenantsQuery.isError ||
    organizationsQuery.isError ||
    buildingsQuery.isError ||
    floorsQuery.isError ||
    areasQuery.isError ||
    assetTypesQuery.isError ||
    !recordQuery.data
  ) {
    return (
      <RelatedDataErrorState
        message={getFirstQueryErrorMessage(
          [
            recordQuery.error,
            tenantsQuery.error,
            organizationsQuery.error,
            buildingsQuery.error,
            floorsQuery.error,
            areasQuery.error,
            assetTypesQuery.error,
          ],
          "Asset data could not be loaded.",
        )}
        title="Unable to load asset"
      />
    );
  }

  return (
    <FormPageLayout
      description="Update the selected asset record."
      errorMessage={
        mutation.isError
          ? extractErrorMessage(mutation.error, "Asset could not be updated.")
          : null
      }
      title="Edit Asset"
    >
      <AssetForm
        areas={areasQuery.data ?? []}
        assetTypes={assetTypesQuery.data ?? []}
        buildings={buildingsQuery.data ?? []}
        cancelHref="/master-data/assets"
        floors={floorsQuery.data ?? []}
        initialValues={{
          ...recordQuery.data,
          floor: recordQuery.data.floor ?? "",
          area: recordQuery.data.area ?? "",
        }}
        isSubmitting={mutation.isPending}
        onSubmit={async (values) => {
          await mutation.mutateAsync(values);
        }}
        organizations={organizationsQuery.data ?? []}
        submitLabel="Save asset"
        tenants={tenantsQuery.data ?? []}
      />
    </FormPageLayout>
  );
}
