"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FormActions } from "@/components/common/form-actions";
import {
  TextAreaField,
  TextInputField,
} from "@/features/master-data/components/shared";
import { useUnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-prompt";
import { normalizeRoleCode } from "@/lib/rbac/roles";
import { createRoleFormSchema } from "@/lib/validations/roles";
import { ApiError } from "@/services/api/types";
import type { RoleFormMode, RoleFormValues } from "@/types/rbac";

const FIELD_NAMES = new Set<keyof RoleFormValues>([
  "name",
  "code",
  "description",
]);

export function RoleForm({
  cancelHref,
  initialValues,
  isSubmitting,
  mode,
  onSubmit,
  submitLabel,
}: {
  cancelHref: string;
  initialValues: RoleFormValues;
  isSubmitting: boolean;
  mode: RoleFormMode;
  onSubmit: (values: RoleFormValues) => Promise<void>;
  submitLabel: string;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
    setError,
  } = useForm<RoleFormValues>({
    resolver: zodResolver(createRoleFormSchema(mode)),
    defaultValues: initialValues,
  });
  const code = useWatch({ control, name: "code" });
  const codePreview = normalizeRoleCode(code ?? "");
  const codeEditable = mode !== "edit";
  useUnsavedChangesPrompt(isDirty && !isSubmitting);

  return (
    <form
      className="space-y-6"
      onSubmit={handleSubmit(async (values) => {
        setFormError(null);
        try {
          await onSubmit(values);
        } catch (error) {
          if (error instanceof ApiError) {
            const nonFieldMessages: string[] = [];
            for (const [field, messages] of Object.entries(
              error.details?.errors ?? {},
            )) {
              if (FIELD_NAMES.has(field as keyof RoleFormValues)) {
                setError(field as keyof RoleFormValues, {
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
                "The role could not be saved.",
            );
            return;
          }
          setFormError(
            error instanceof Error && error.message
              ? error.message
              : "The role could not be saved.",
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
          <h2 className="text-lg font-semibold text-slate-950">Role metadata</h2>
          <p className="mt-1 text-sm text-slate-600">
            Permission assignment is managed separately from role metadata.
          </p>
        </div>
        <TextInputField
          error={errors.name?.message}
          id="role-name"
          inputProps={{
            ...register("name"),
            "aria-describedby": errors.name ? "role-name-error" : undefined,
            "aria-invalid": Boolean(errors.name),
            autoComplete: "off",
          }}
          label="Role name"
        />
        {codeEditable ? (
          <TextInputField
            description="Letters, numbers, spaces, underscores, and hyphens are accepted."
            error={errors.code?.message}
            id="role-code"
            inputProps={{
              ...register("code"),
              "aria-describedby": errors.code
                ? "role-code-error"
                : "role-code-preview",
              "aria-invalid": Boolean(errors.code),
              autoComplete: "off",
            }}
            label="Role code"
          />
        ) : (
          <TextInputField
            description="Read-only. Role codes cannot change after creation."
            disabled
            id="role-code"
            inputProps={{ value: initialValues.code }}
            label="Role code (read-only)"
          />
        )}
        {codeEditable ? (
          <div
            className="rounded-lg border border-blue-200 bg-blue-50 p-4 md:col-span-2"
            id="role-code-preview"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Saved code preview
            </p>
            <p className="mt-1 font-mono text-sm text-blue-950">
              {codePreview || "Enter a role code to preview its saved slug."}
            </p>
          </div>
        ) : null}
        <div className="md:col-span-2">
          <TextAreaField
            error={errors.description?.message}
            id="role-description"
            label="Description"
            textAreaProps={{
              ...register("description"),
              "aria-describedby": errors.description
                ? "role-description-error"
                : undefined,
              "aria-invalid": Boolean(errors.description),
              rows: 5,
            }}
          />
        </div>
      </section>

      <FormActions
        cancelHref={cancelHref}
        isSubmitting={isSubmitting}
        submitLabel={submitLabel}
      />
    </form>
  );
}
