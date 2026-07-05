import type { ReactNode } from "react";

export interface DetailFieldProps {
  label: string;
  value: ReactNode;
}

export function DetailField({ label, value }: DetailFieldProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}
