"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormActions } from "@/components/common/form-actions";
import { SelectField } from "@/components/common/select-field";
import { SwitchField } from "@/components/common/switch-field";
import { organizationSchema } from "@/lib/validations/master-data";
import type { OrganizationFormValues, Tenant } from "@/types/master-data";

import {
  buildRecordOptions,
  getDefaultTenantValues,
  getFieldErrorMessage,
  MasterDataFormProps,
  TextAreaField,
  TextInputField,
} from "./shared";

export interface OrganizationFormProps
  extends MasterDataFormProps<OrganizationFormValues> {
  tenants: Tenant[];
}

export function OrganizationForm({
  cancelHref,
  initialValues,
  isSubmitting,
  onSubmit,
  submitLabel,
  tenants,
}: OrganizationFormProps) {
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      ...getDefaultTenantValues(initialValues),
      tenant: initialValues?.tenant ?? "",
    },
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit(async (values) => {
      await onSubmit(values);
    })}>
      <SelectField
        error={getFieldErrorMessage(errors.tenant?.message)}
        label="Tenant"
        options={buildRecordOptions(tenants)}
        {...register("tenant")}
      />
      <TextInputField
        error={getFieldErrorMessage(errors.name?.message)}
        id="organization-name"
        inputProps={register("name")}
        label="Name"
      />
      <TextInputField
        error={getFieldErrorMessage(errors.code?.message)}
        id="organization-code"
        inputProps={register("code")}
        label="Code"
      />
      <TextAreaField
        error={getFieldErrorMessage(errors.description?.message)}
        id="organization-description"
        label="Description"
        textAreaProps={register("description")}
      />
      <SwitchField
        error={getFieldErrorMessage(errors.is_active?.message)}
        label="Active"
        {...register("is_active")}
      />
      <FormActions cancelHref={cancelHref} isSubmitting={isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
