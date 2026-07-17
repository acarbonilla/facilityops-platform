"use client";

import Link from "next/link";

import { usePermissions } from "@/hooks/use-permissions";
import {
  getVisibleDashboardQuickLinks,
  MASTER_DATA_QUICK_LINK_PERMISSION,
  REPORTING_PERMISSION,
} from "@/lib/dashboard/navigation";

export function QuickLinks() {
  const {
    hasPermission,
    permissionsError,
    permissionsLoading,
  } = usePermissions();

  const links = getVisibleDashboardQuickLinks({
    permissionsLoading,
    permissionsError: Boolean(permissionsError),
    canViewMasterData: hasPermission(MASTER_DATA_QUICK_LINK_PERMISSION),
    canViewReporting: hasPermission(REPORTING_PERMISSION),
  });

  return (
    <section
      aria-label="Dashboard quick links"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-950">Quick links</h2>
      <p className="mt-1 text-sm text-slate-600">
        Open related administrative areas available to your account.
      </p>

      {permissionsLoading ? (
        <p className="mt-5 text-sm text-slate-500" role="status">
          Loading available links…
        </p>
      ) : null}

      {!permissionsLoading && permissionsError ? (
        <p className="mt-5 text-sm text-slate-500" role="status">
          Administrative links are hidden until access can be confirmed.
        </p>
      ) : null}

      {!permissionsLoading && !permissionsError && links.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500" role="status">
          No administrative links are available for your account.
        </p>
      ) : null}

      {links.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-3">
          {links.map((link) => (
            <Link
              key={link.href}
              aria-label={link.accessibleName ?? link.label}
              className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
              href={link.href}
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
