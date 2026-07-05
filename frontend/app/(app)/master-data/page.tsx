"use client";

import { ProtectedPermissionRoute } from "@/components/auth/protected-permission-route";
import { AppShell } from "@/components/layout/app-shell";

export default function MasterDataPage() {
  return (
    <ProtectedPermissionRoute requiredPermission="settings.view">
      <AppShell>
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
            RBAC foundation
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Master Data
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Permission guard connected successfully.
          </p>
        </section>
      </AppShell>
    </ProtectedPermissionRoute>
  );
}
