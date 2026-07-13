"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import {
  bulkUpdateNotificationState,
  getNotification,
  getNotifications,
  getNotificationUnreadCount,
  getNotificationPreferences,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
  updateNotificationPreferences,
} from "@/services/api/notifications";
import { notificationQueryKeys } from "@/services/api/query-keys";
import type {
  NotificationBulkStatePayload,
  NotificationListParams,
  NotificationPreferencesUpdatePayload,
} from "@/types/notifications";

function useNotificationsEnabled() {
  const { isAuthenticated, isLoading } = useAuth();
  return !isLoading && isAuthenticated;
}

async function invalidateNotificationCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  detailId?: string,
) {
  await queryClient.invalidateQueries({
    queryKey: notificationQueryKeys.lists(),
  });
  await queryClient.invalidateQueries({
    queryKey: notificationQueryKeys.unreadCount(),
  });

  if (detailId) {
    await queryClient.invalidateQueries({
      queryKey: notificationQueryKeys.detail(detailId),
    });
  }
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

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: async (notification) => {
      queryClient.setQueryData(
        notificationQueryKeys.detail(notification.id),
        notification,
      );
      await invalidateNotificationCaches(queryClient, notification.id);
    },
  });
}

export function useMarkNotificationUnread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markNotificationUnread(id),
    onSuccess: async (notification) => {
      queryClient.setQueryData(
        notificationQueryKeys.detail(notification.id),
        notification,
      );
      await invalidateNotificationCaches(queryClient, notification.id);
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      await invalidateNotificationCaches(queryClient);
    },
  });
}

export function useBulkUpdateNotificationState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: NotificationBulkStatePayload) =>
      bulkUpdateNotificationState(payload),
    onSuccess: async () => {
      await invalidateNotificationCaches(queryClient);
    },
  });
}

export function useNotificationPreferences() {
  const enabled = useNotificationsEnabled();

  return useQuery({
    queryKey: notificationQueryKeys.preferences(),
    queryFn: getNotificationPreferences,
    enabled,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: NotificationPreferencesUpdatePayload) =>
      updateNotificationPreferences(payload),
    onSuccess: async (response) => {
      queryClient.setQueryData(notificationQueryKeys.preferences(), response);
      await queryClient.invalidateQueries({
        queryKey: notificationQueryKeys.preferences(),
      });
    },
  });
}
