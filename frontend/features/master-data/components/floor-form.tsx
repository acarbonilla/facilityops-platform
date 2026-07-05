"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { FormActions } from "@/components/common/form-actions";
import { SelectField } from "@/components/common/select-field";
import { SwitchField } from "@/components/common/switch-field";
import { floorSchema } from "@/lib/validations/master-data";
import type { Building, FloorFormValues, Tenant } from "@/types/master-data";

import {
  buildRecordOptions,
  filterBuildingsByTenant,
  getDefaultTenantValues,
  getFieldErrorMessage,
  MasterDataFormProps,
  TextAreaField,
  TextInputField,
} from "./shared";

export interface FloorFormProps extends MasterDataFormProps<FloorFormValues> {
  tenants: Tenant[];
  buildings: Building[];
}

export function FloorForm({
  buildings,
  cancelHref,
  initialValues,
  isSubmitting,
  onSubmit,
  submitLabel,
  tenants,
}: FloorFormProps) {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<FloorFormValues>({
    resolver: zodResolver(floorSchema),
    defaultValues: {
      ...getDefaultTenantValues(initialValues),
      tenant: initialValues?.tenant ?? "",
      building: initialValues?.building ?? "",
      level_number: initialValues?.level_number ?? 0,
    },
  });
  const selectedTenant = useWatch({ control, name: "tenant" });

  return (
    <form className="space-y-5" onSubmit={handleSubmit(async (values) => {
      await onSubmit(values);
    })}>
      <SelectField error={getFieldErrorMessage(errors.tenant?.message)} label="Tenant" options={buildRecordOptions(tenants)} {...register("tenant")} />
      <SelectField error={getFieldErrorMessage(errors.building?.message)} label="Building" options={buildRecordOptions(filterBuildingsByTenant(buildings, selectedTenant))} {...register("building")} />
      <TextInputField error={getFieldErrorMessage(errors.name?.message)} id="floor-name" inputProps={register("name")} label="Name" />
      <TextInputField error={getFieldErrorMessage(errors.code?.message)} id="floor-code" inputProps={register("code")} label="Code" />
      <TextInputField error={getFieldErrorMessage(errors.level_number?.message)} id="floor-level-number" inputProps={register("level_number", { valueAsNumber: true })} label="Level number" type="number" />
      <TextAreaField error={getFieldErrorMessage(errors.description?.message)} id="floor-description" label="Description" textAreaProps={register("description")} />
      <SwitchField error={getFieldErrorMessage(errors.is_active?.message)} label="Active" {...register("is_active")} />
      <FormActions cancelHref={cancelHref} isSubmitting={isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
