"use client";

import type { SelectHTMLAttributes } from "react";

import { FormField } from "@/components/common/form-field";
import { SelectField } from "@/components/common/select-field";
import { useAuth } from "@/hooks/use-auth";
import { getTenantOptionState } from "@/lib/master-data/lifecycle";
import type {
  Area,
  AssetType,
  Building,
  Floor,
  Organization,
  Tenant,
} from "@/types/master-data";

export interface MasterDataFormProps<TValues> {
  initialValues?: Partial<TValues>;
  onSubmit: (values: TValues) => void | Promise<void>;
  isSubmitting: boolean;
  submitLabel: string;
  cancelHref: string;
}

export function getFieldErrorMessage(message?: string) {
  return message;
}

export function buildRecordOptions<T extends { id: string; name: string; is_active: boolean }>(
  records: T[],
  currentId?: string | null,
) {
  return records
    .filter((record) => record.is_active || record.id === currentId)
    .map((record) => ({
      value: record.id,
      label: record.name,
    }));
}

export function TenantSelectField({
  currentTenantId,
  error,
  inputProps,
  tenants,
}: {
  currentTenantId?: string | null;
  error?: string;
  inputProps: SelectHTMLAttributes<HTMLSelectElement>;
  tenants: Tenant[];
}) {
  const { user } = useAuth();
  const tenantState = getTenantOptionState(tenants, user?.tenant);
  const options = buildRecordOptions(
    tenantState.records,
    currentTenantId ?? user?.tenant,
  );
  const onChange = inputProps.onChange;

  return (
    <SelectField
      {...inputProps}
      aria-disabled={tenantState.locked}
      description={tenantState.description}
      error={error}
      label="Tenant"
      onChange={(event) => {
        if (tenantState.locked && user?.tenant) {
          event.currentTarget.value = user.tenant;
        }
        onChange?.(event);
      }}
      onKeyDown={(event) => {
        if (
          tenantState.locked &&
          !["Tab", "Shift", "Escape"].includes(event.key)
        ) {
          event.preventDefault();
        }
        inputProps.onKeyDown?.(event);
      }}
      onMouseDown={(event) => {
        if (tenantState.locked) event.preventDefault();
        inputProps.onMouseDown?.(event);
      }}
      options={options}
    />
  );
}

export function useTenantDefault(initialTenant?: string | null): string {
  const { user } = useAuth();
  return initialTenant ?? user?.tenant ?? "";
}

export function filterOrganizationsByTenant(
  organizations: Organization[],
  tenantId: string,
) {
  if (!tenantId) {
    return organizations;
  }

  return organizations.filter((organization) => organization.tenant === tenantId);
}

export function filterBuildingsByTenant(
  buildings: Building[],
  tenantId: string,
) {
  if (!tenantId) {
    return buildings;
  }

  return buildings.filter((building) => building.tenant === tenantId);
}

export function filterBuildingsByOrganization(
  buildings: Building[],
  organizationId: string,
) {
  if (!organizationId) {
    return buildings;
  }

  return buildings.filter((building) => building.organization === organizationId);
}

export function filterFloorsByBuilding(floors: Floor[], buildingId: string) {
  if (!buildingId) {
    return floors;
  }

  return floors.filter((floor) => floor.building === buildingId);
}

export function filterAreasByFloor(areas: Area[], floorId: string) {
  if (!floorId) {
    return areas;
  }

  return areas.filter((area) => area.floor === floorId);
}

export function filterAssetTypesByTenant(
  assetTypes: AssetType[],
  tenantId: string,
) {
  if (!tenantId) {
    return assetTypes;
  }

  return assetTypes.filter((assetType) => assetType.tenant === tenantId);
}

export function getDefaultTenantValues(initialValues?: Partial<{
  name: string;
  code: string;
  description: string;
  is_active: boolean;
}>) {
  return {
    name: initialValues?.name ?? "",
    code: initialValues?.code ?? "",
    description: initialValues?.description ?? "",
    is_active: initialValues?.is_active ?? true,
  };
}

export function TextInputField(props: {
  id: string;
  label: string;
  error?: string;
  description?: string;
  disabled?: boolean;
  type?: string;
  inputProps?: Record<string, unknown>;
}) {
  const { description, disabled, error, id, inputProps, label, type = "text" } =
    props;

  return (
    <FormField
      description={description}
      error={error}
      htmlFor={id}
      label={label}
    >
      <input
        className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
        disabled={disabled}
        id={id}
        type={type}
        {...inputProps}
      />
    </FormField>
  );
}

export function TextAreaField(props: {
  id: string;
  label: string;
  error?: string;
  description?: string;
  disabled?: boolean;
  textAreaProps?: Record<string, unknown>;
}) {
  const { description, disabled, error, id, label, textAreaProps } = props;

  return (
    <FormField
      description={description}
      error={error}
      htmlFor={id}
      label={label}
    >
      <textarea
        className="block min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
        disabled={disabled}
        id={id}
        {...textAreaProps}
      />
    </FormField>
  );
}

export type { Tenant, Organization, Building, Floor, Area, AssetType };
