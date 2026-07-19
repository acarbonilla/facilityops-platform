"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FormActions } from "@/components/common/form-actions";
import { SelectField } from "@/components/common/select-field";
import { areaSchema } from "@/lib/validations/master-data";
import type { AreaFormValues, Building, Floor, Tenant } from "@/types/master-data";

import {
  buildRecordOptions,
  filterBuildingsByTenant,
  filterFloorsByBuilding,
  getDefaultTenantValues,
  getFieldErrorMessage,
  MasterDataFormProps,
  TenantSelectField,
  TextAreaField,
  TextInputField,
  useTenantDefault,
} from "./shared";

export interface AreaFormProps extends MasterDataFormProps<AreaFormValues> {
  tenants: Tenant[];
  buildings: Building[];
  floors: Floor[];
}

export function AreaForm({
  buildings,
  cancelHref,
  floors,
  initialValues,
  isSubmitting,
  onSubmit,
  submitLabel,
  tenants,
}: AreaFormProps) {
  const defaultTenant = useTenantDefault(initialValues?.tenant);
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = useForm<AreaFormValues>({
    resolver: zodResolver(areaSchema),
    defaultValues: {
      ...getDefaultTenantValues(initialValues),
      tenant: defaultTenant,
      building: initialValues?.building ?? "",
      floor: initialValues?.floor ?? "",
    },
  });
  const selectedTenant = useWatch({ control, name: "tenant" });
  const selectedBuilding = useWatch({ control, name: "building" });
  const previousTenant = useRef(selectedTenant);
  const previousBuilding = useRef(selectedBuilding);
  useEffect(() => {
    if (previousTenant.current !== selectedTenant) {
      setValue("building", "");
      setValue("floor", "");
      previousTenant.current = selectedTenant;
    }
  }, [selectedTenant, setValue]);
  useEffect(() => {
    if (previousBuilding.current !== selectedBuilding) {
      setValue("floor", "");
      previousBuilding.current = selectedBuilding;
    }
  }, [selectedBuilding, setValue]);

  return (
    <form className="space-y-5" onSubmit={handleSubmit(async (values) => {
      await onSubmit(values);
    })}>
      <TenantSelectField currentTenantId={initialValues?.tenant} error={getFieldErrorMessage(errors.tenant?.message)} inputProps={register("tenant")} tenants={tenants} />
      <SelectField error={getFieldErrorMessage(errors.building?.message)} label="Building" options={buildRecordOptions(filterBuildingsByTenant(buildings, selectedTenant), initialValues?.building)} {...register("building")} />
      <SelectField error={getFieldErrorMessage(errors.floor?.message)} label="Floor" options={buildRecordOptions(filterFloorsByBuilding(floors, selectedBuilding), initialValues?.floor)} {...register("floor")} />
      <TextInputField error={getFieldErrorMessage(errors.name?.message)} id="area-name" inputProps={register("name")} label="Name" />
      <TextInputField error={getFieldErrorMessage(errors.code?.message)} id="area-code" inputProps={register("code")} label="Code" />
      <TextAreaField error={getFieldErrorMessage(errors.description?.message)} id="area-description" label="Description" textAreaProps={register("description")} />
      <FormActions cancelHref={cancelHref} isSubmitting={isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
