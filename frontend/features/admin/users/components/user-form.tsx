"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FormActions } from "@/components/common/form-actions";
import { SelectField, type SelectOption } from "@/components/common/select-field";
import { SwitchField } from "@/components/common/switch-field";
import { TextInputField } from "@/features/master-data/components/shared";
import { canManageStaffStatus } from "@/lib/users/form";
import { createUserFormSchema } from "@/lib/validations/users";
import { ApiError } from "@/services/api/types";
import type { AuthUser } from "@/types/auth";
import type { Organization, Tenant } from "@/types/master-data";
import type { UserFormMode, UserFormValues } from "@/types/users";

const FIELD_NAMES = new Set<keyof UserFormValues>([
  "email",
  "first_name",
  "last_name",
  "tenant",
  "organization",
  "password",
  "confirm_password",
  "is_active",
  "is_staff",
]);

function addFallbackOption(
  options: SelectOption[],
  value: string,
  label: string,
) {
  if (!value || options.some((option) => option.value === value)) {
    return options;
  }
  return [...options, { value, label }];
}

export function UserForm({
  cancelHref,
  currentUser,
  initialValues,
  isSubmitting,
  mode,
  onSubmit,
  organizations,
  submitLabel,
  tenants,
}: {
  cancelHref: string;
  currentUser: AuthUser | null;
  initialValues: UserFormValues;
  isSubmitting: boolean;
  mode: UserFormMode;
  onSubmit: (values: UserFormValues) => Promise<void>;
  organizations: Organization[];
  submitLabel: string;
  tenants: Tenant[];
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setError,
    setValue,
  } = useForm<UserFormValues>({
    resolver: zodResolver(createUserFormSchema(mode)),
    defaultValues: initialValues,
  });
  const selectedTenant = useWatch({ control, name: "tenant" });
  const selectedOrganization = useWatch({ control, name: "organization" });
  const mayChooseTenant = !currentUser?.tenant;
  const mayManageStaff = canManageStaffStatus(currentUser);

  const tenantOptions = useMemo(() => {
    const visible = currentUser?.tenant
      ? tenants.filter((tenant) => tenant.id === currentUser.tenant)
      : tenants;
    return addFallbackOption(
      visible.map((tenant) => ({ value: tenant.id, label: tenant.name })),
      selectedTenant,
      currentUser?.tenant === selectedTenant ? "Current tenant" : selectedTenant,
    );
  }, [currentUser?.tenant, selectedTenant, tenants]);
  const organizationOptions = useMemo(() => {
    const visible = organizations.filter(
      (organization) => !selectedTenant || organization.tenant === selectedTenant,
    );
    return addFallbackOption(
      visible.map((organization) => ({
        value: organization.id,
        label: organization.name,
      })),
      selectedOrganization,
      selectedOrganization,
    );
  }, [organizations, selectedOrganization, selectedTenant]);

  useEffect(() => {
    if (
      selectedOrganization &&
      organizations.some((item) => item.id === selectedOrganization) &&
      !organizations.some(
        (item) =>
          item.id === selectedOrganization && item.tenant === selectedTenant,
      )
    ) {
      setValue("organization", "", { shouldDirty: true });
    }
  }, [organizations, selectedOrganization, selectedTenant, setValue]);

  return (
    <form
      className="space-y-6"
      onSubmit={handleSubmit(async (values) => {
        setFormError(null);
        try {
          await onSubmit({
            ...values,
            is_staff: mayManageStaff ? values.is_staff : initialValues.is_staff,
          });
        } catch (error) {
          if (error instanceof ApiError) {
            const nonFieldMessages: string[] = [];

            for (const [field, messages] of Object.entries(
              error.details?.errors ?? {},
            )) {
              if (FIELD_NAMES.has(field as keyof UserFormValues)) {
                setError(field as keyof UserFormValues, {
                  message: messages[0],
                  type: "server",
                });
              } else {
                nonFieldMessages.push(...messages);
              }
            }

            setFormError(
              nonFieldMessages[0] ??
                error.details?.message ??
                error.message ??
                "The user could not be saved.",
            );
            return;
          }

          setFormError(
            error instanceof Error && error.message
              ? error.message
              : "The user could not be saved.",
          );
        }
      })}
    >
      {formError ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <section className="grid gap-5 rounded-xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <h2 className="text-lg font-semibold text-slate-950">Profile</h2>
          <p className="mt-1 text-sm text-slate-600">
            Enter the account identity fields used by FacilityOps.
          </p>
        </div>
        <TextInputField error={errors.email?.message} id="user-email" inputProps={{ ...register("email"), autoComplete: "email" }} label="Email" type="email" />
        <div />
        <TextInputField error={errors.first_name?.message} id="user-first-name" inputProps={{ ...register("first_name"), autoComplete: "given-name" }} label="First name" />
        <TextInputField error={errors.last_name?.message} id="user-last-name" inputProps={{ ...register("last_name"), autoComplete: "family-name" }} label="Last name" />
      </section>

      <section className="grid gap-5 rounded-xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2">
        <div className="md:col-span-2"><h2 className="text-lg font-semibold text-slate-950">Tenant scope</h2><p className="mt-1 text-sm text-slate-600">Organization choices follow the selected tenant. Tenant-bound administrators keep their current tenant.</p></div>
        <SelectField disabled={!mayChooseTenant} error={errors.tenant?.message} label="Tenant" options={tenantOptions} placeholder="No tenant" {...register("tenant")} />
        <SelectField error={errors.organization?.message} label="Organization" options={organizationOptions} placeholder="No organization" {...register("organization")} />
      </section>

      <section className="grid gap-5 rounded-xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2">
        <div className="md:col-span-2"><h2 className="text-lg font-semibold text-slate-950">Password</h2><p className="mt-1 text-sm text-slate-600">{mode === "create" ? "A password is required. Backend password policy remains authoritative." : "Leave both fields blank to keep the current password."}</p></div>
        <TextInputField error={errors.password?.message} id="user-password" inputProps={{ ...register("password"), autoComplete: "new-password" }} label={mode === "create" ? "Password" : "New password"} type="password" />
        <TextInputField error={errors.confirm_password?.message} id="user-confirm-password" inputProps={{ ...register("confirm_password"), autoComplete: "new-password" }} label="Confirm password" type="password" />
      </section>

      <section className="grid gap-5 rounded-xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2">
        <div className="md:col-span-2"><h2 className="text-lg font-semibold text-slate-950">Account status</h2><p className="mt-1 text-sm text-slate-600">Activation changes require users.update. Staff status is shown only for an explicitly global staff session.</p></div>
        <SwitchField description="Inactive accounts cannot authenticate and do not appear in the assignment directory." error={errors.is_active?.message} label="Active account" {...register("is_active")} />
        {mayManageStaff ? <SwitchField description="Staff access is restricted by the backend to globally scoped administrators." error={errors.is_staff?.message} label="Staff account" {...register("is_staff")} /> : null}
      </section>

      <FormActions cancelHref={cancelHref} isSubmitting={isSubmitting} submitLabel={submitLabel} />
    </form>
  );
}
