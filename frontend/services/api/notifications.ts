import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import type { PaginatedResponse } from "@/services/api/types";
import type {
  Notification,
  NotificationBulkStatePayload,
  NotificationBulkStateResponse,
  NotificationListParams,
  NotificationPreferencesResponse,
  NotificationPreferencesUpdatePayload,
  NotificationUnreadCountResponse,
  NotificationUpdatedCountResponse,
} from "@/types/notifications";

export type NotificationListResponse = PaginatedResponse<Notification>;

export function getNotifications(
  params?: NotificationListParams,
): Promise<NotificationListResponse> {
  return apiClient<NotificationListResponse>(API_ENDPOINTS.notifications.list, {
    method: "GET",
    query: params,
  });
}

export function getNotification(id: string): Promise<Notification> {
  return apiClient<Notification>(API_ENDPOINTS.notifications.detail(id), {
    method: "GET",
  });
}

export function getNotificationUnreadCount(): Promise<NotificationUnreadCountResponse> {
  return apiClient<NotificationUnreadCountResponse>(
    API_ENDPOINTS.notifications.unreadCount,
    { method: "GET" },
  );
}

export function markNotificationRead(id: string): Promise<Notification> {
  return apiClient<Notification>(API_ENDPOINTS.notifications.markRead(id), {
    method: "POST",
  });
}

export function markNotificationUnread(id: string): Promise<Notification> {
  return apiClient<Notification>(API_ENDPOINTS.notifications.markUnread(id), {
    method: "POST",
  });
}

export function markAllNotificationsRead(): Promise<NotificationUpdatedCountResponse> {
  return apiClient<NotificationUpdatedCountResponse>(
    API_ENDPOINTS.notifications.markAllRead,
    { method: "POST" },
  );
}

export function bulkUpdateNotificationState(
  payload: NotificationBulkStatePayload,
): Promise<NotificationBulkStateResponse> {
  return apiClient<NotificationBulkStateResponse>(
    API_ENDPOINTS.notifications.bulkState,
    {
      method: "POST",
      body: payload,
    },
  );
}

export function getNotificationPreferences(): Promise<NotificationPreferencesResponse> {
  return apiClient<NotificationPreferencesResponse>(
    API_ENDPOINTS.notifications.preferences,
    { method: "GET" },
  );
}

export function updateNotificationPreferences(
  payload: NotificationPreferencesUpdatePayload,
): Promise<NotificationPreferencesResponse> {
  return apiClient<NotificationPreferencesResponse>(
    API_ENDPOINTS.notifications.preferences,
    {
      method: "PUT",
      body: payload,
    },
  );
}
