"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationCenterScreen } from "@/features/notifications/components/notification-center";

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <NotificationCenterScreen />
      </AppShell>
    </ProtectedRoute>
  );
}
