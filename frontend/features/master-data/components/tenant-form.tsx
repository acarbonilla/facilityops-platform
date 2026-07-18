"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormActions } from "@/components/common/form-actions";
import { tenantSchema } from "@/lib/validations/master-data";
import type { TenantFormValues } from "@/types/master-data";

import {
  getDefaultTenantValues,
  getFieldErrorMessage,
  MasterDataFormProps,
  TextAreaField,
  TextInputField,
} from "./shared";

export function TenantForm({
  cancelHref,
  initialValues,
  isSubmitting,
  onSubmit,
  submitLabel,
}: MasterDataFormProps<TenantFormValues>) {
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: getDefaultTenantValues(initialValues),
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit(async (values) => {
      await onSubmit(values);
    })}>
      <TextInputField
        error={getFieldErrorMessage(errors.name?.message)}
        id="tenant-name"
        inputProps={register("name")}
        label="Name"
      />
      <TextInputField
        error={getFieldErrorMessage(errors.code?.message)}
        id="tenant-code"
        inputProps={register("code")}
        label="Code"
      />
      <TextAreaField
        error={getFieldErrorMessage(errors.description?.message)}
        id="tenant-description"
        label="Description"
        textAreaProps={register("description")}
      />
      <FormActions
        cancelHref={cancelHref}
        isSubmitting={isSubmitting}
        submitLabel={submitLabel}
      />
    </form>
  );
}
