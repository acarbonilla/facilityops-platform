"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import { FormActions } from "@/components/common/form-actions";
import { SelectField } from "@/components/common/select-field";
import { SwitchField } from "@/components/common/switch-field";
import { departmentSchema } from "@/lib/validations/master-data";
import type {
  DepartmentFormValues,
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

export interface DepartmentFormProps
  extends MasterDataFormProps<DepartmentFormValues> {
  tenants: Tenant[];
  organizations: Organization[];
}

export function DepartmentForm({
  cancelHref,
  initialValues,
  isSubmitting,
  onSubmit,
  organizations,
  submitLabel,
  tenants,
}: DepartmentFormProps) {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      ...getDefaultTenantValues(initialValues),
      tenant: initialValues?.tenant ?? "",
      organization: initialValues?.organization ?? "",
    },
  });
  const selectedTenant = useWatch({ control, name: "tenant" });
  const organizationOptions = buildRecordOptions(
    filterOrganizationsByTenant(organizations, selectedTenant),
  );

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
      <SelectField
        error={getFieldErrorMessage(errors.organization?.message)}
        label="Organization"
        options={organizationOptions}
        {...register("organization")}
      />
      <TextInputField error={getFieldErrorMessage(errors.name?.message)} id="department-name" inputProps={register("name")} label="Name" />
      <TextInputField error={getFieldErrorMessage(errors.code?.message)} id="department-code" inputProps={register("code")} label="Code" />
      <TextAreaField error={getFieldErrorMessage(errors.description?.message)} id="department-description" label="Description" textAreaProps={register("description")} />
      <SwitchField error={getFieldErrorMessage(errors.is_active?.message)} label="Active" {...register("is_active")} />
      <FormActions cancelHref={cancelHref} isSubmitting={isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
