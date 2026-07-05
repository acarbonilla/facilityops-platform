"use client";

import { UserAvatar } from "@/components/auth/user-avatar";
import { getUserDisplayName } from "@/lib/auth/user-display";
import type { AuthUser } from "@/types/auth";

export interface CurrentUserCardProps {
  user: AuthUser;
}

export function CurrentUserCard({ user }: CurrentUserCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <UserAvatar size="lg" user={user} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
            Current account
          </p>
          <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-950">
            {getUserDisplayName(user)}
          </h2>
          <p className="mt-2 break-all text-sm text-slate-600">{user.email}</p>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Staff access
          </dt>
          <dd className="mt-2 text-sm font-medium text-slate-900">
            {user.is_staff ? "Enabled" : "Standard account"}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <dt className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Session
          </dt>
          <dd className="mt-2 text-sm font-medium text-slate-900">
            Authenticated
          </dd>
        </div>
      </dl>
    </section>
  );
}
