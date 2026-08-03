import { Bell, Search } from "lucide-react";

import { LIVE_PLATFORM_PREVIEW } from "@/lib/landing/live-platform-preview";

import { PreviewActivityList } from "./preview-activity-list";
import { PreviewMetricCard } from "./preview-metric-card";
import { PreviewSidebar } from "./preview-sidebar";
import { PreviewTrendChart } from "./preview-trend-chart";
import { PreviewWorkQueue } from "./preview-work-queue";

export function LivePlatformPreview() {
  const preview = LIVE_PLATFORM_PREVIEW;

  return (
    <section
      id="live-preview"
      className="relative z-10 -mt-10 pb-16 sm:-mt-16 sm:pb-20 lg:-mt-20"
      aria-labelledby="live-platform-preview-heading"
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="landing-fade-up mb-6 max-w-2xl sm:mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">
            {preview.eyebrow}
          </p>
          <h2
            id="live-platform-preview-heading"
            className="mt-2 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl"
          >
            {preview.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
            {preview.description}
          </p>
        </div>

        {/* Browser / application window frame */}
        <div
          className="landing-fade-up overflow-hidden rounded-2xl border border-white/15 bg-[#0b1528]/90 shadow-2xl shadow-black/40 backdrop-blur-xl sm:rounded-3xl"
          style={{ animationDelay: "120ms" }}
        >
          {/* Window chrome — decorative only */}
          <div
            className="flex items-center gap-2 border-b border-white/10 bg-white/[0.04] px-4 py-2.5"
            aria-hidden="true"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            <span className="ml-3 truncate rounded-md border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-400">
              app.facilityops.demo / operations
            </span>
            <span className="ml-auto hidden rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-0.5 text-[10px] font-medium text-sky-200 sm:inline-flex">
              {preview.demoBadge}
            </span>
          </div>

          <div className="flex min-h-[28rem] bg-slate-100 text-slate-950">
            <PreviewSidebar />

            <div className="flex min-w-0 flex-1 flex-col">
              {/* Top bar — decorative controls (not interactive) */}
              <div
                className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4"
                aria-hidden="true"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-950 sm:text-sm">
                    {preview.shell.workspace}
                  </p>
                  <p className="truncate text-[10px] text-slate-500 lg:hidden">
                    {preview.shell.brand}
                  </p>
                </div>
                <div className="hidden max-w-xs flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-400 md:flex">
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{preview.shell.searchPlaceholder}</span>
                </div>
                <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500">
                  <Bell className="h-3.5 w-3.5" />
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[9px] font-semibold text-white">
                    {preview.shell.notificationCount}
                  </span>
                </span>
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white"
                  title={preview.shell.userLabel}
                >
                  {preview.shell.userInitials}
                </span>
              </div>

              {/* Compact mobile module strip */}
              <div
                className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 lg:hidden"
                aria-hidden="true"
              >
                {preview.sidebar.map((item) => (
                  <span
                    key={item.id}
                    className={[
                      "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium",
                      item.active
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-500",
                    ].join(" ")}
                  >
                    {item.label}
                  </span>
                ))}
              </div>

              <div className="flex-1 space-y-3 overflow-hidden p-3 sm:space-y-4 sm:p-4">
                <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
                  {preview.metrics.map((metric) => (
                    <PreviewMetricCard
                      key={metric.id}
                      label={metric.label}
                      value={metric.value}
                      delta={metric.delta}
                      tone={metric.tone}
                    />
                  ))}
                </div>

                <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="hidden sm:block">
                    <PreviewTrendChart
                      title={preview.trend.title}
                      summary={preview.trend.summary}
                      points={preview.trend.points}
                      labels={preview.trend.labels}
                    />
                  </div>
                  <PreviewActivityList items={preview.activity} />
                </div>

                <PreviewWorkQueue items={preview.workQueue} />

                <div className="hidden gap-2 sm:grid sm:grid-cols-2 xl:grid-cols-4">
                  {preview.moduleInsights.map((insight) => (
                    <article
                      key={insight.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
                    >
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        {insight.title}
                      </p>
                      <p className="mt-1 font-display text-sm font-semibold text-slate-950">
                        {insight.value}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {insight.note}
                      </p>
                    </article>
                  ))}
                </div>

                <aside
                  className="rounded-xl border border-dashed border-sky-200 bg-gradient-to-r from-sky-50/90 to-teal-50/70 p-3 sm:p-4"
                  aria-label="Future capability preview"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-sky-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
                      {preview.aiInsight.label}
                    </span>
                    <p className="font-display text-sm font-semibold text-slate-950">
                      {preview.aiInsight.title}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{preview.aiInsight.text}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {preview.aiInsight.disclaimer}
                  </p>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
