import type { SelectHTMLAttributes } from "react";

import {
  FormField,
  getFormFieldAccessibilityProps,
} from "./form-field";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label: string;
  error?: string;
  description?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function SelectField({
  description,
  error,
  id,
  label,
  options,
  placeholder = "Select an option",
  ...props
}: SelectFieldProps) {
  const fieldId = id ?? props.name ?? label;
  return (
    <FormField
      description={description}
      error={error}
      htmlFor={fieldId}
      label={label}
    >
      <select
        className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
        id={fieldId}
        {...props}
        {...getFormFieldAccessibilityProps(fieldId, description, error)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}
