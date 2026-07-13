"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import {
  getNotification,
  getNotifications,
  getNotificationUnreadCount,
} from "@/services/api/notifications";
import { notificationQueryKeys } from "@/services/api/query-keys";
import type { NotificationListParams } from "@/types/notifications";

function useNotificationsEnabled() {
  const { isAuthenticated, isLoading } = useAuth();
  return !isLoading && isAuthenticated;
}

export function useNotifications(params?: NotificationListParams) {
  const enabled = useNotificationsEnabled();

  return useQuery({
    queryKey: notificationQueryKeys.list(params),
    queryFn: () => getNotifications(params),
    enabled,
  });
}

export function useNotification(id: string) {
  const enabled = useNotificationsEnabled() && Boolean(id);

  return useQuery({
    queryKey: notificationQueryKeys.detail(id),
    queryFn: () => getNotification(id),
    enabled,
  });
}

export function useNotificationUnreadCount() {
  const enabled = useNotificationsEnabled();

  return useQuery({
    queryKey: notificationQueryKeys.unreadCount(),
    queryFn: getNotificationUnreadCount,
    enabled,
  });
}
