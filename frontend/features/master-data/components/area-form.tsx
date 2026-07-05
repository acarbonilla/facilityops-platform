"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { FormActions } from "@/components/common/form-actions";
import { SelectField } from "@/components/common/select-field";
import { SwitchField } from "@/components/common/switch-field";
import { areaSchema } from "@/lib/validations/master-data";
import type { AreaFormValues, Building, Floor, Tenant } from "@/types/master-data";

import {
  buildRecordOptions,
  filterBuildingsByTenant,
  filterFloorsByBuilding,
  getDefaultTenantValues,
  getFieldErrorMessage,
  MasterDataFormProps,
  TextAreaField,
  TextInputField,
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
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<AreaFormValues>({
    resolver: zodResolver(areaSchema),
    defaultValues: {
      ...getDefaultTenantValues(initialValues),
      tenant: initialValues?.tenant ?? "",
      building: initialValues?.building ?? "",
      floor: initialValues?.floor ?? "",
    },
  });
  const selectedTenant = useWatch({ control, name: "tenant" });
  const selectedBuilding = useWatch({ control, name: "building" });

  return (
    <form className="space-y-5" onSubmit={handleSubmit(async (values) => {
      await onSubmit(values);
    })}>
      <SelectField error={getFieldErrorMessage(errors.tenant?.message)} label="Tenant" options={buildRecordOptions(tenants)} {...register("tenant")} />
      <SelectField error={getFieldErrorMessage(errors.building?.message)} label="Building" options={buildRecordOptions(filterBuildingsByTenant(buildings, selectedTenant))} {...register("building")} />
      <SelectField error={getFieldErrorMessage(errors.floor?.message)} label="Floor" options={buildRecordOptions(filterFloorsByBuilding(floors, selectedBuilding))} {...register("floor")} />
      <TextInputField error={getFieldErrorMessage(errors.name?.message)} id="area-name" inputProps={register("name")} label="Name" />
      <TextInputField error={getFieldErrorMessage(errors.code?.message)} id="area-code" inputProps={register("code")} label="Code" />
      <TextAreaField error={getFieldErrorMessage(errors.description?.message)} id="area-description" label="Description" textAreaProps={register("description")} />
      <SwitchField error={getFieldErrorMessage(errors.is_active?.message)} label="Active" {...register("is_active")} />
      <FormActions cancelHref={cancelHref} isSubmitting={isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
