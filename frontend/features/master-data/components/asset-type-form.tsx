"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormActions } from "@/components/common/form-actions";
import { assetTypeSchema } from "@/lib/validations/master-data";
import type { AssetTypeFormValues, Tenant } from "@/types/master-data";

import {
  getDefaultTenantValues,
  getFieldErrorMessage,
  MasterDataFormProps,
  TenantSelectField,
  TextAreaField,
  TextInputField,
  useTenantDefault,
} from "./shared";

export interface AssetTypeFormProps
  extends MasterDataFormProps<AssetTypeFormValues> {
  tenants: Tenant[];
}

export function AssetTypeForm({
  cancelHref,
  initialValues,
  isSubmitting,
  onSubmit,
  submitLabel,
  tenants,
}: AssetTypeFormProps) {
  const defaultTenant = useTenantDefault(initialValues?.tenant);
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<AssetTypeFormValues>({
    resolver: zodResolver(assetTypeSchema),
    defaultValues: {
      ...getDefaultTenantValues(initialValues),
      tenant: defaultTenant,
    },
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit(async (values) => {
      await onSubmit(values);
    })}>
      <TenantSelectField currentTenantId={initialValues?.tenant} error={getFieldErrorMessage(errors.tenant?.message)} inputProps={register("tenant")} tenants={tenants} />
      <TextInputField error={getFieldErrorMessage(errors.name?.message)} id="asset-type-name" inputProps={register("name")} label="Name" />
      <TextInputField error={getFieldErrorMessage(errors.code?.message)} id="asset-type-code" inputProps={register("code")} label="Code" />
      <TextAreaField error={getFieldErrorMessage(errors.description?.message)} id="asset-type-description" label="Description" textAreaProps={register("description")} />
      <FormActions cancelHref={cancelHref} isSubmitting={isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
