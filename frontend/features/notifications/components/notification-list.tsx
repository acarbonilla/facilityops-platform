"use client";

import type { Notification } from "@/types/notifications";

import { NotificationItem } from "./notification-item";

export interface NotificationListProps {
  notifications: Notification[];
  showSelection?: boolean;
  selectedIds?: string[];
  onToggleSelected?: (notificationId: string, selected: boolean) => void;
  showStateActions?: boolean;
  pendingNotificationId?: string | null;
  onMarkRead?: (notificationId: string) => void;
  onMarkUnread?: (notificationId: string) => void;
  itemErrors?: Record<string, string | undefined>;
}

export function NotificationList({
  notifications,
  showSelection = false,
  selectedIds = [],
  onToggleSelected,
  showStateActions = false,
  pendingNotificationId = null,
  onMarkRead,
  onMarkUnread,
  itemErrors = {},
}: NotificationListProps) {
  return (
    <ul className="space-y-3">
      {notifications.map((notification) => (
        <li key={notification.id}>
          <NotificationItem
            actionError={itemErrors[notification.id]}
            isActionPending={pendingNotificationId === notification.id}
            isSelected={selectedIds.includes(notification.id)}
            notification={notification}
            onMarkRead={
              onMarkRead ? () => onMarkRead(notification.id) : undefined
            }
            onMarkUnread={
              onMarkUnread ? () => onMarkUnread(notification.id) : undefined
            }
            onToggleSelected={onToggleSelected}
            showCheckbox={showSelection}
            showStateActions={showStateActions}
          />
        </li>
      ))}
    </ul>
  );
}
