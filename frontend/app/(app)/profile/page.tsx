"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { ProfileSummary } from "@/components/profile/profile-summary";

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <ProfileSummary />
      </AppShell>
    </ProtectedRoute>
  );
}
