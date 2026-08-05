"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  fieldIndicatorClass,
  formatFieldIndicatorLabel,
  type FmReviewFieldIndicator,
} from "@/lib/fm-tickets/fm-review-experience";

export function FmReviewFieldBadge({
  indicator,
}: {
  indicator: FmReviewFieldIndicator;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        fieldIndicatorClass(indicator),
      )}
      role="status"
    >
      {formatFieldIndicatorLabel(indicator)}
    </span>
  );
}

export function FmReviewSection({
  step,
  title,
  description,
  children,
  className,
}: {
  step?: number;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm",
        className,
      )}
      aria-labelledby={step ? `fm-review-step-${step}` : undefined}
    >
      <div className="flex flex-wrap items-start gap-3">
        {typeof step === "number" ? (
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white"
            aria-hidden
          >
            {step}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2
            className="text-xl font-semibold tracking-tight text-slate-950"
            id={step ? `fm-review-step-${step}` : undefined}
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function FmReviewGuidanceStrip({
  steps,
}: {
  steps: Array<{
    id: string;
    label: string;
    status: "current" | "done" | "upcoming";
  }>;
}) {
  return (
    <nav
      aria-label="Facility Manager review guidance"
      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <ol className="flex flex-wrap gap-2">
        {steps.map((step, index) => (
          <li key={step.id}>
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset",
                step.status === "current" &&
                  "bg-slate-900 text-white ring-slate-900",
                step.status === "done" &&
                  "bg-emerald-50 text-emerald-900 ring-emerald-200",
                step.status === "upcoming" &&
                  "bg-white text-slate-600 ring-slate-200",
              )}
            >
              <span aria-hidden>{index + 1}</span>
              <span>{step.label}</span>
              <span className="sr-only">
                {step.status === "current"
                  ? "current step"
                  : step.status === "done"
                    ? "completed"
                    : "upcoming"}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
