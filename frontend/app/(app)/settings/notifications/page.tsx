"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationPreferencesScreen } from "@/features/notifications/components/notification-preferences-screen";

export default function NotificationPreferencesPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <NotificationPreferencesScreen />
      </AppShell>
    </ProtectedRoute>
  );
}
