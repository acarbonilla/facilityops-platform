"use client";

import type { RequesterTimelineStep } from "@/lib/my-requests/ai-first-submit";

export function RequesterIntakeTimeline({
  steps,
}: {
  steps: RequesterTimelineStep[];
}) {
  return (
    <section
      aria-label="Request progress"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-950">Progress</h2>
      <ol className="mt-4 space-y-3">
        {steps.map((step) => {
          const marker =
            step.state === "complete"
              ? "bg-emerald-600"
              : step.state === "current"
                ? "bg-blue-600"
                : "bg-slate-300";
          const text =
            step.state === "upcoming" ? "text-slate-500" : "text-slate-900";
          return (
            <li className="flex items-start gap-3" key={step.id}>
              <span
                aria-hidden
                className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${marker}`}
              />
              <span className={`text-sm font-medium ${text}`}>
                {step.label}
                <span className="sr-only">
                  {step.state === "complete"
                    ? ", complete"
                    : step.state === "current"
                      ? ", current"
                      : ", upcoming"}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
