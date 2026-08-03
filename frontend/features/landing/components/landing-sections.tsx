import Link from "next/link";
import {
  Bell,
  ChartColumn,
  ClipboardCheck,
  Paperclip,
  Settings2,
  Sparkles,
  Ticket,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import {
  LANDING_BENEFITS,
  LANDING_FUTURE_AI,
  LANDING_MODULES,
  LANDING_SECURITY,
  LANDING_TRUST_ITEMS,
  LANDING_WORKFLOW,
} from "@/lib/landing/content";
import {
  getPublicApplicationStatusLabel,
  PUBLIC_APPLICATIONS,
  type PublicApplication,
} from "@/lib/landing/public-applications";
import { APP_VERSION } from "@/lib/constants";

const MODULE_ICONS: Record<(typeof LANDING_MODULES)[number]["icon"], LucideIcon> = {
  ticket: Ticket,
  wrench: Wrench,
  clipboard: ClipboardCheck,
  bell: Bell,
  paperclip: Paperclip,
  chart: ChartColumn,
  settings: Settings2,
  spark: Sparkles,
};

function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string;
  title: string;
  description: string;
  id: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
        {eyebrow}
      </p>
      <h2 id={id} className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
        {description}
      </p>
    </div>
  );
}

export function TrustSection() {
  return (
    <section className="border-b border-slate-200 bg-white py-14 sm:py-16" aria-labelledby="trust-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 id="trust-heading" className="sr-only">
          Platform foundations
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {LANDING_TRUST_ITEMS.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition duration-300 hover:-translate-y-1 hover:border-sky-200 hover:bg-white hover:shadow-lg hover:shadow-slate-200/70"
            >
              <h3 className="font-display text-sm font-semibold text-slate-950">
                {item.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ModulesSection() {
  return (
    <section id="modules" className="bg-slate-50 py-20 sm:py-24" aria-labelledby="modules-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Modules"
          title="Everything operations teams need in one platform"
          description="FacilityOps connects the workflows your teams already run—without forcing them into a generic admin template."
          id="modules-heading"
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {LANDING_MODULES.map((item) => {
            const Icon = MODULE_ICONS[item.icon];
            return (
              <article
                key={item.id}
                className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-xl hover:shadow-sky-100/60"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sky-300 transition group-hover:scale-105">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {item.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function WorkflowSection() {
  return (
    <section className="bg-white py-20 sm:py-24" aria-labelledby="workflow-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Workflow"
          title="From request to insight without losing the thread"
          description="A clear operational path keeps employees, facilities teams, and leadership aligned."
          id="workflow-heading"
        />
        <ol className="mt-12 grid gap-3 md:grid-cols-7">
          {LANDING_WORKFLOW.map((step, index) => (
            <li
              key={step.id}
              className="relative rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-center"
            >
              <span className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="mt-3 font-display text-sm font-semibold text-slate-950">
                {step.label}
              </p>
              {index < LANDING_WORKFLOW.length - 1 ? (
                <span className="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 text-slate-300 md:block" aria-hidden="true">
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function BenefitsSection() {
  return (
    <section className="bg-[#07111f] py-20 sm:py-24" aria-labelledby="benefits-heading">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">
            Business value
          </p>
          <h2 id="benefits-heading" className="mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Built for measurable facility performance
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            FacilityOps helps organizations replace fragmented spreadsheets and
            disconnected tools with governed digital workflows.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {LANDING_BENEFITS.map((benefit) => (
            <article
              key={benefit.id}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm transition hover:border-sky-300/30 hover:bg-white/[0.07]"
            >
              <h3 className="font-display text-lg font-semibold text-white">
                {benefit.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                {benefit.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ApplicationCard({ app }: { app: PublicApplication }) {
  const className =
    "group flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-xl hover:shadow-sky-100/50";

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 font-display text-lg font-bold text-sky-300">
          F
        </span>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          {getPublicApplicationStatusLabel(app.status)}
        </span>
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold text-slate-950">
        {app.name}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
        {app.description}
      </p>
      <span className="mt-5 text-sm font-semibold text-sky-700 group-hover:text-sky-800">
        {app.external ? "Open application" : "Open FacilityOps"} →
      </span>
    </>
  );

  if (app.external) {
    return (
      <a
        href={app.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        aria-label={`${app.name} (opens in a new tab)`}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={app.href} className={className} aria-label={`Open ${app.name}`}>
      {content}
    </Link>
  );
}

export function ApplicationsSection() {
  return (
    <section id="applications" className="bg-slate-50 py-20 sm:py-24" aria-labelledby="applications-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Applications"
          title="Our applications"
          description="Start with FacilityOps today. Additional applications can be published through the same configurable catalog."
          id="applications-heading"
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PUBLIC_APPLICATIONS.map((app) => (
            <ApplicationCard key={app.id} app={app} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function SecuritySection() {
  return (
    <section id="security" className="bg-white py-20 sm:py-24" aria-labelledby="security-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Security"
          title="Enterprise controls without marketing exaggeration"
          description="FacilityOps emphasizes practical safeguards already present in the platform: permissions, tenant scope, workflow checks, and secure evidence handling."
          id="security-heading"
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_SECURITY.map((item) => (
            <article
              key={item.id}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-6"
            >
              <h3 className="font-display text-lg font-semibold text-slate-950">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FutureAiSection() {
  return (
    <section className="bg-slate-50 py-20 sm:py-24" aria-labelledby="future-ai-heading">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <p className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
            Future Capabilities
          </p>
          <h2 id="future-ai-heading" className="mt-4 font-display text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            AI roadmap for assisted facility operations
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">
            These capabilities are planned. They are not current product features
            and should not be treated as available functionality today.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {LANDING_FUTURE_AI.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5"
              >
                <h3 className="font-display text-base font-semibold text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCtaSection() {
  return (
    <section className="bg-[#07111f] py-20 sm:py-24" aria-labelledby="final-cta-heading">
      <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        <h2 id="final-cta-heading" className="font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Ready to modernize your facility operations?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
          Open FacilityOps to explore the connected platform for tickets,
          maintenance, inspections, and administration.
        </p>
        <a
          href="/login"
          className="mt-8 inline-flex rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
        >
          Open FacilityOps
        </a>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer id="contact" className="border-t border-slate-800 bg-[#050b16] py-14 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
        <div>
          <p className="font-display text-lg font-semibold text-white">FacilityOps</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
            Enterprise facility operations platform for modern service teams.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Navigation</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><a className="hover:text-white" href="#platform">Platform</a></li>
            <li><a className="hover:text-white" href="#modules">Modules</a></li>
            <li><a className="hover:text-white" href="#applications">Applications</a></li>
            <li><a className="hover:text-white" href="#security">About</a></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Applications</p>
          <ul className="mt-3 space-y-2 text-sm">
            {PUBLIC_APPLICATIONS.map((app) => (
              <li key={app.id}>
                <a className="hover:text-white" href={app.href}>
                  {app.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-2 border-t border-white/10 px-4 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} FacilityOps. All rights reserved.</p>
        <p className="flex flex-wrap gap-4">
          <span>Privacy placeholder</span>
          <span>Contact placeholder</span>
          <span>Version {APP_VERSION}</span>
        </p>
      </div>
    </footer>
  );
}
