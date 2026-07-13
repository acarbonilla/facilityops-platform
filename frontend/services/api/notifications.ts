import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

import type { PaginatedResponse } from "@/services/api/types";
import type {
  Notification,
  NotificationListParams,
  NotificationUnreadCountResponse,
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
