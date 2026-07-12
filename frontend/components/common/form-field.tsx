import type { ReactNode } from "react";

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  description?: string;
  children: ReactNode;
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
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      ) : null}
      <div className="mt-2">{children}</div>
      {error ? (
        <p className="mt-1 text-sm text-red-700" id={`${htmlFor}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
