"use client";

import { useEffect, useRef } from "react";

import type { FormValidationResult } from "@/lib/api/form-validation";

export function FormValidationSummary({
  result,
  focusOnMount = true,
}: {
  result: FormValidationResult | null;
  focusOnMount?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!result || !focusOnMount) return;
    ref.current?.focus();
  }, [result, focusOnMount]);

  if (!result) return null;

  return (
    <div
      ref={ref}
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-950"
      role="alert"
      tabIndex={-1}
    >
      <p className="font-medium">{result.title}</p>
      <p className="mt-1 text-sm text-red-800">{result.message}</p>
      {result.nonFieldErrors.length > 1 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800">
          {result.nonFieldErrors.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
