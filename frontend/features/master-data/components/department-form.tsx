"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FormActions } from "@/components/common/form-actions";
import { SelectField } from "@/components/common/select-field";
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
  TenantSelectField,
  TextAreaField,
  TextInputField,
  useTenantDefault,
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
  const defaultTenant = useTenantDefault(initialValues?.tenant);
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      ...getDefaultTenantValues(initialValues),
      tenant: defaultTenant,
      organization: initialValues?.organization ?? "",
    },
  });
  const selectedTenant = useWatch({ control, name: "tenant" });
  const previousTenant = useRef(selectedTenant);
  useEffect(() => {
    if (previousTenant.current !== selectedTenant) {
      setValue("organization", "");
      previousTenant.current = selectedTenant;
    }
  }, [selectedTenant, setValue]);
  const organizationOptions = buildRecordOptions(
    filterOrganizationsByTenant(organizations, selectedTenant),
    initialValues?.organization,
  );

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
      <SelectField
        error={getFieldErrorMessage(errors.organization?.message)}
        label="Organization"
        options={organizationOptions}
        {...register("organization")}
      />
      <TextInputField error={getFieldErrorMessage(errors.name?.message)} id="department-name" inputProps={register("name")} label="Name" />
      <TextInputField error={getFieldErrorMessage(errors.code?.message)} id="department-code" inputProps={register("code")} label="Code" />
      <TextAreaField error={getFieldErrorMessage(errors.description?.message)} id="department-description" label="Description" textAreaProps={register("description")} />
      <FormActions cancelHref={cancelHref} isSubmitting={isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
