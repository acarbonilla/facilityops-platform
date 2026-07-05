import type { InputHTMLAttributes } from "react";

export interface SwitchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  description?: string;
  error?: string;
}

export function SwitchField({
  description,
  error,
  id,
  label,
  ...props
}: SwitchFieldProps) {
  const fieldId = id ?? props.name ?? label;

  return (
    <div>
      <label
        className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
        htmlFor={fieldId}
      >
        <input
          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
          id={fieldId}
          type="checkbox"
          {...props}
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-700">{label}</span>
          {description ? (
            <span className="mt-1 block text-xs text-slate-500">{description}</span>
          ) : null}
        </span>
      </label>
      {error ? <p className="mt-1 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
