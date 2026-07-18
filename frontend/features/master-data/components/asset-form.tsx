"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FormActions } from "@/components/common/form-actions";
import { SelectField } from "@/components/common/select-field";
import { assetSchema } from "@/lib/validations/master-data";
import type {
  Area,
  AssetFormValues,
  AssetType,
  Building,
  Floor,
  Organization,
  Tenant,
} from "@/types/master-data";

import {
  buildRecordOptions,
  filterAreasByFloor,
  filterAssetTypesByTenant,
  filterBuildingsByOrganization,
  filterFloorsByBuilding,
  filterOrganizationsByTenant,
  getDefaultTenantValues,
  getFieldErrorMessage,
  MasterDataFormProps,
  TenantSelectField,
  TextAreaField,
  TextInputField,
  useTenantDefault,
} from "./shared";
import { AssetFormSection } from "@/features/assets/components/asset-form-section";

export interface AssetFormProps extends MasterDataFormProps<AssetFormValues> {
  tenants: Tenant[];
  organizations: Organization[];
  buildings: Building[];
  floors: Floor[];
  areas: Area[];
  assetTypes: AssetType[];
}

export function AssetForm({
  areas,
  assetTypes,
  buildings,
  cancelHref,
  floors,
  initialValues,
  isSubmitting,
  onSubmit,
  organizations,
  submitLabel,
  tenants,
}: AssetFormProps) {
  const defaultTenant = useTenantDefault(initialValues?.tenant);
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = useForm<AssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      ...getDefaultTenantValues(initialValues),
      tenant: defaultTenant,
      organization: initialValues?.organization ?? "",
      building: initialValues?.building ?? "",
      floor: initialValues?.floor ?? "",
      area: initialValues?.area ?? "",
      asset_type: initialValues?.asset_type ?? "",
      serial_number: initialValues?.serial_number ?? "",
    },
  });
  const selectedTenant = useWatch({ control, name: "tenant" });
  const selectedOrganization = useWatch({ control, name: "organization" });
  const selectedBuilding = useWatch({ control, name: "building" });
  const selectedFloor = useWatch({ control, name: "floor" });
  const previousTenant = useRef(selectedTenant);
  const previousOrganization = useRef(selectedOrganization);
  const previousBuilding = useRef(selectedBuilding);
  const previousFloor = useRef(selectedFloor);

  useEffect(() => {
    if (previousTenant.current !== selectedTenant) {
      setValue("organization", "");
      setValue("building", "");
      setValue("floor", "");
      setValue("area", "");
      setValue("asset_type", "");
      previousTenant.current = selectedTenant;
    }
  }, [selectedTenant, setValue]);
  useEffect(() => {
    if (previousOrganization.current !== selectedOrganization) {
      setValue("building", "");
      setValue("floor", "");
      setValue("area", "");
      previousOrganization.current = selectedOrganization;
    }
  }, [selectedOrganization, setValue]);
  useEffect(() => {
    if (previousBuilding.current !== selectedBuilding) {
      setValue("floor", "");
      setValue("area", "");
      previousBuilding.current = selectedBuilding;
    }
  }, [selectedBuilding, setValue]);
  useEffect(() => {
    if (previousFloor.current !== selectedFloor) {
      setValue("area", "");
      previousFloor.current = selectedFloor;
    }
  }, [selectedFloor, setValue]);

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values);
      })}
    >
      <AssetFormSection
        description="Core asset identity, labeling, and status fields."
        title="Asset Information"
      >
        <TextInputField
          description="Primary display name for the asset record."
          error={getFieldErrorMessage(errors.name?.message)}
          id="asset-name"
          inputProps={register("name")}
          label="Name"
        />
        <TextInputField
          description="Short internal code used in lists and references."
          error={getFieldErrorMessage(errors.code?.message)}
          id="asset-code"
          inputProps={register("code")}
          label="Code"
        />
        <TextInputField
          description="Optional manufacturer or internal serial reference."
          error={getFieldErrorMessage(errors.serial_number?.message)}
          id="asset-serial-number"
          inputProps={register("serial_number")}
          label="Serial number"
        />
        <div className="md:col-span-2">
          <TextAreaField
            description="Add operational context or notes for this asset."
            error={getFieldErrorMessage(errors.description?.message)}
            id="asset-description"
            label="Description"
            textAreaProps={register("description")}
          />
        </div>
      </AssetFormSection>

      <AssetFormSection
        description="Categorize the asset using the existing asset-type master data."
        title="Classification"
      >
        <SelectField
          description="Asset types can be filtered by the selected tenant."
          error={getFieldErrorMessage(errors.asset_type?.message)}
          label="Asset type"
          options={buildRecordOptions(
            filterAssetTypesByTenant(assetTypes, selectedTenant),
            initialValues?.asset_type,
          )}
          {...register("asset_type")}
        />
      </AssetFormSection>

      <AssetFormSection
        description="These fields reuse the existing organization structure and narrow progressively based on your selections."
        title="Location"
      >
        <TenantSelectField
          currentTenantId={initialValues?.tenant}
          error={getFieldErrorMessage(errors.tenant?.message)}
          inputProps={register("tenant")}
          tenants={tenants}
        />
        <SelectField
          description="Organizations are filtered by the selected tenant."
          error={getFieldErrorMessage(errors.organization?.message)}
          label="Organization"
          options={buildRecordOptions(
            filterOrganizationsByTenant(organizations, selectedTenant),
            initialValues?.organization,
          )}
          {...register("organization")}
        />
        <SelectField
          description="Buildings are filtered by the selected organization."
          error={getFieldErrorMessage(errors.building?.message)}
          label="Building"
          options={buildRecordOptions(
            filterBuildingsByOrganization(buildings, selectedOrganization),
            initialValues?.building,
          )}
          {...register("building")}
        />
        <SelectField
          description="Optional floor assignment within the selected building."
          error={getFieldErrorMessage(errors.floor?.message)}
          label="Floor"
          options={buildRecordOptions(filterFloorsByBuilding(floors, selectedBuilding), initialValues?.floor)}
          placeholder="Optional floor"
          {...register("floor")}
        />
        <SelectField
          description="Optional area assignment within the selected floor."
          error={getFieldErrorMessage(errors.area?.message)}
          label="Area"
          options={buildRecordOptions(filterAreasByFloor(areas, selectedFloor), initialValues?.area)}
          placeholder="Optional area"
          {...register("area")}
        />
      </AssetFormSection>

      <FormActions cancelHref={cancelHref} isSubmitting={isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
