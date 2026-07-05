"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { FormActions } from "@/components/common/form-actions";
import { SelectField } from "@/components/common/select-field";
import { SwitchField } from "@/components/common/switch-field";
import { buildingSchema } from "@/lib/validations/master-data";
import type {
  BuildingFormValues,
  Organization,
  Tenant,
} from "@/types/master-data";

import {
  buildRecordOptions,
  filterOrganizationsByTenant,
  getDefaultTenantValues,
  getFieldErrorMessage,
  MasterDataFormProps,
  TextAreaField,
  TextInputField,
} from "./shared";

export interface BuildingFormProps
  extends MasterDataFormProps<BuildingFormValues> {
  tenants: Tenant[];
  organizations: Organization[];
}

export function BuildingForm({
  cancelHref,
  initialValues,
  isSubmitting,
  onSubmit,
  organizations,
  submitLabel,
  tenants,
}: BuildingFormProps) {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<BuildingFormValues>({
    resolver: zodResolver(buildingSchema),
    defaultValues: {
      ...getDefaultTenantValues(initialValues),
      tenant: initialValues?.tenant ?? "",
      organization: initialValues?.organization ?? "",
      address: initialValues?.address ?? "",
    },
  });
  const selectedTenant = useWatch({ control, name: "tenant" });

  return (
    <form className="space-y-5" onSubmit={handleSubmit(async (values) => {
      await onSubmit(values);
    })}>
      <SelectField error={getFieldErrorMessage(errors.tenant?.message)} label="Tenant" options={buildRecordOptions(tenants)} {...register("tenant")} />
      <SelectField
        error={getFieldErrorMessage(errors.organization?.message)}
        label="Organization"
        options={buildRecordOptions(filterOrganizationsByTenant(organizations, selectedTenant))}
        {...register("organization")}
      />
      <TextInputField error={getFieldErrorMessage(errors.name?.message)} id="building-name" inputProps={register("name")} label="Name" />
      <TextInputField error={getFieldErrorMessage(errors.code?.message)} id="building-code" inputProps={register("code")} label="Code" />
      <TextAreaField error={getFieldErrorMessage(errors.address?.message)} id="building-address" label="Address" textAreaProps={register("address")} />
      <TextAreaField error={getFieldErrorMessage(errors.description?.message)} id="building-description" label="Description" textAreaProps={register("description")} />
      <SwitchField error={getFieldErrorMessage(errors.is_active?.message)} label="Active" {...register("is_active")} />
      <FormActions cancelHref={cancelHref} isSubmitting={isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
