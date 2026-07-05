"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormActions } from "@/components/common/form-actions";
import { SelectField } from "@/components/common/select-field";
import { SwitchField } from "@/components/common/switch-field";
import { assetTypeSchema } from "@/lib/validations/master-data";
import type { AssetTypeFormValues, Tenant } from "@/types/master-data";

import {
  buildRecordOptions,
  getDefaultTenantValues,
  getFieldErrorMessage,
  MasterDataFormProps,
  TextAreaField,
  TextInputField,
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
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<AssetTypeFormValues>({
    resolver: zodResolver(assetTypeSchema),
    defaultValues: {
      ...getDefaultTenantValues(initialValues),
      tenant: initialValues?.tenant ?? "",
    },
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit(async (values) => {
      await onSubmit(values);
    })}>
      <SelectField error={getFieldErrorMessage(errors.tenant?.message)} label="Tenant" options={buildRecordOptions(tenants)} {...register("tenant")} />
      <TextInputField error={getFieldErrorMessage(errors.name?.message)} id="asset-type-name" inputProps={register("name")} label="Name" />
      <TextInputField error={getFieldErrorMessage(errors.code?.message)} id="asset-type-code" inputProps={register("code")} label="Code" />
      <TextAreaField error={getFieldErrorMessage(errors.description?.message)} id="asset-type-description" label="Description" textAreaProps={register("description")} />
      <SwitchField error={getFieldErrorMessage(errors.is_active?.message)} label="Active" {...register("is_active")} />
      <FormActions cancelHref={cancelHref} isSubmitting={isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
