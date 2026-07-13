"use client";

import type { Notification } from "@/types/notifications";
import {
  getBulkNotificationActionLabel,
  getMaximumNotificationSelectionStatus,
  MAX_NOTIFICATION_BULK_SELECTION,
} from "@/lib/notifications/display";

export interface NotificationBulkActionsProps {
  selectedCount: number;
  visibleCount: number;
  isDisabled?: boolean;
  isPending?: boolean;
  error?: string | null;
  successMessage?: string | null;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onBulkRead: () => void;
  onBulkUnread: () => void;
}

export function NotificationBulkActions({
  selectedCount,
  visibleCount,
  isDisabled = false,
  isPending = false,
  error,
  successMessage,
  onSelectAllVisible,
  onClearSelection,
  onBulkRead,
  onBulkUnread,
}: NotificationBulkActionsProps) {
  const maximumSelectionReached =
    selectedCount === MAX_NOTIFICATION_BULK_SELECTION;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Bulk actions</h2>
          <p className="mt-1 text-sm text-slate-600">
            {selectedCount} selected on this page. Maximum{" "}
            {MAX_NOTIFICATION_BULK_SELECTION} notifications per bulk request.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDisabled || isPending || visibleCount === 0}
            onClick={onSelectAllVisible}
            type="button"
          >
            Select all visible
          </button>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDisabled || isPending || selectedCount === 0}
            onClick={onClearSelection}
            type="button"
          >
            Clear selection
          </button>
          <button
            className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDisabled || isPending || selectedCount === 0}
            onClick={onBulkRead}
            type="button"
          >
            {isPending ? "Updating..." : getBulkNotificationActionLabel(true)}
          </button>
          <button
            className="rounded-md border border-blue-700 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDisabled || isPending || selectedCount === 0}
            onClick={onBulkUnread}
            type="button"
          >
            {isPending ? "Updating..." : getBulkNotificationActionLabel(false)}
          </button>
        </div>
      </div>

      {maximumSelectionReached ? (
        <p className="mt-3 text-sm text-slate-600" role="status">
          {getMaximumNotificationSelectionStatus()}
        </p>
      ) : null}

      {successMessage ? (
        <p className="mt-3 text-sm text-emerald-800" role="status">
          {successMessage}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

export function toggleNotificationSelection(
  selectedIds: string[],
  notificationId: string,
  selected: boolean,
): string[] {
  if (!selected) {
    return selectedIds.filter((id) => id !== notificationId);
  }

  if (selectedIds.includes(notificationId)) {
    return selectedIds;
  }

  if (selectedIds.length >= MAX_NOTIFICATION_BULK_SELECTION) {
    return selectedIds;
  }

  return [...selectedIds, notificationId];
}

export function selectAllVisibleNotifications(
  notifications: Notification[],
  selectedIds: string[],
): string[] {
  const merged = [...selectedIds];

  for (const notification of notifications) {
    if (merged.length >= MAX_NOTIFICATION_BULK_SELECTION) {
      break;
    }

    if (!merged.includes(notification.id)) {
      merged.push(notification.id);
    }
  }

  return merged;
}
