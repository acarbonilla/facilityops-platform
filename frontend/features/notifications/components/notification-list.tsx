"use client";

import type { Notification } from "@/types/notifications";

import { NotificationItem } from "./notification-item";

export interface NotificationListProps {
  notifications: Notification[];
}

export function NotificationList({ notifications }: NotificationListProps) {
  return (
    <ul className="space-y-3">
      {notifications.map((notification) => (
        <li key={notification.id}>
          <NotificationItem notification={notification} />
        </li>
      ))}
    </ul>
  );
}
