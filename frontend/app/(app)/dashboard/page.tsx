"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/hooks/use-auth";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <AppShell>
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
            Stage 1 — Foundation
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            FacilityOps Dashboard
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            Authentication connected successfully
          </p>
          {user ? (
            <p className="mt-6 text-sm text-slate-500">
              Signed in as <span className="font-medium">{user.email}</span>
            </p>
          ) : null}
        </section>
      </AppShell>
    </ProtectedRoute>
  );
}
