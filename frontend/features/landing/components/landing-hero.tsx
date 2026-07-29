import Link from "next/link";

import { LANDING_BRAND, LANDING_HERO_STATS } from "@/lib/landing/content";

function HeroDashboardMock() {
  return (
    <div
      className="landing-fade-up relative mx-auto w-full max-w-xl lg:max-w-none"
      aria-hidden="true"
      style={{ animationDelay: "180ms" }}
    >
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-sky-500/20 via-teal-400/10 to-transparent blur-2xl" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0b1528]/80 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-300/80">
              Operations Overview
            </p>
            <p className="mt-1 font-display text-lg font-semibold text-white">
              Live Facility Pulse
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
            Online
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {LANDING_HERO_STATS.map((stat) => (
            <div
              key={stat.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition duration-300 hover:-translate-y-0.5 hover:border-sky-300/30 hover:bg-white/[0.07]"
            >
              <p className="text-xs text-slate-400">{stat.label}</p>
              <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-white">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-sky-200/80">{stat.trend}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-sky-500/10 to-transparent p-4">
            <p className="text-xs font-medium text-slate-300">Performance</p>
            <div className="mt-3 flex h-16 items-end gap-1.5">
              {[40, 58, 46, 72, 64, 88, 76].map((height, index) => (
                <span
                  key={index}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-sky-600 to-teal-300 opacity-90"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-medium text-slate-300">Upcoming Work</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              <li className="flex items-center justify-between gap-2">
                <span>HVAC Zone B</span>
                <span className="text-xs text-slate-400">Today</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>5S Floor Audit</span>
                <span className="text-xs text-slate-400">Tomorrow</span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span>Access Panel Check</span>
                <span className="text-xs text-slate-400">Thu</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingHero() {
  return (
    <section
      id="platform"
      className="relative overflow-hidden bg-[#07111f] pb-20 pt-28 sm:pb-28 sm:pt-32"
      aria-labelledby="landing-hero-heading"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.18),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(45,212,191,0.12),_transparent_45%)]" />
        <div className="absolute inset-0 opacity-[0.15] [background-image:linear-gradient(rgba(148,163,184,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.15)_1px,transparent_1px)] [background-size:64px_64px]" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8">
        <div className="landing-fade-up max-w-2xl">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.22em] text-sky-300">
            {LANDING_BRAND.name}
          </p>
          <h1
            id="landing-hero-heading"
            className="mt-4 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl"
          >
            {LANDING_BRAND.tagline}
            <span className="mt-2 block text-sky-200">
              {LANDING_BRAND.taglineSecondary}
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            {LANDING_BRAND.description}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              Open Platform
            </Link>
            <a
              href="#modules"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
            >
              Explore Features
            </a>
          </div>
        </div>

        <HeroDashboardMock />
      </div>
    </section>
  );
}
