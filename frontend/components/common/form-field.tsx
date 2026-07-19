import type { ReactNode } from "react";

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  description?: string;
  children: ReactNode;
}

export function getFormFieldAccessibilityProps(
  fieldId: string,
  description?: string,
  error?: string,
) {
  const describedBy = [
    description ? `${fieldId}-description` : null,
    error ? `${fieldId}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    "aria-describedby": describedBy || undefined,
    "aria-invalid": error ? true : undefined,
  } as const;
}

export function FormField({
  children,
  description,
  error,
  htmlFor,
  label,
}: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700" htmlFor={htmlFor}>
        {label}
      </label>
      {description ? (
        <p
          className="mt-1 text-xs text-slate-500"
          id={`${htmlFor}-description`}
        >
          {description}
        </p>
      ) : null}
      <div className="mt-2">{children}</div>
      {error ? (
        <p
          className="mt-1 text-sm text-red-700"
          id={`${htmlFor}-error`}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
