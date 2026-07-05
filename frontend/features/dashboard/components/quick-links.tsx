"use client";

import Link from "next/link";

const DASHBOARD_LINKS = [
  { href: "/master-data", label: "Master Data" },
  { href: "/master-data/tenants", label: "Tenants" },
  { href: "/master-data/organizations", label: "Organizations" },
  { href: "/master-data/buildings", label: "Buildings" },
  { href: "/master-data/assets", label: "Assets" },
];

export function QuickLinks() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Quick links</h2>
      <p className="mt-1 text-sm text-slate-600">
        Jump directly into the foundation master data screens.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        {DASHBOARD_LINKS.map((link) => (
          <Link
            key={link.href}
            className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            href={link.href}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
