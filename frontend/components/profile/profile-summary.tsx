"use client";

import { CurrentUserCard } from "@/components/auth/current-user-card";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { useAuth } from "@/hooks/use-auth";

export function ProfileSummary() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <LoadingState
        title="Loading profile"
        message="Retrieving your current FacilityOps account summary."
      />
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <EmptyState
        title="Profile unavailable"
        message="Current-user information is not available for this session."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
          Account summary
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Profile
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-600">
          This page surfaces the authenticated account summary only. Profile editing,
          password management, and avatar uploads are intentionally deferred.
        </p>
      </section>

      <CurrentUserCard user={user} />
    </div>
  );
}
