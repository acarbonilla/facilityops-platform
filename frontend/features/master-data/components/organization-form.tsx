"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormActions } from "@/components/common/form-actions";
import { organizationSchema } from "@/lib/validations/master-data";
import type { OrganizationFormValues, Tenant } from "@/types/master-data";

import {
  getDefaultTenantValues,
  getFieldErrorMessage,
  MasterDataFormProps,
  TenantSelectField,
  TextAreaField,
  TextInputField,
  useTenantDefault,
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
  const defaultTenant = useTenantDefault(initialValues?.tenant);
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      ...getDefaultTenantValues(initialValues),
      tenant: defaultTenant,
    },
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit(async (values) => {
      await onSubmit(values);
    })}>
      <TenantSelectField
        currentTenantId={initialValues?.tenant}
        error={getFieldErrorMessage(errors.tenant?.message)}
        inputProps={register("tenant")}
        tenants={tenants}
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
      <FormActions cancelHref={cancelHref} isSubmitting={isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
