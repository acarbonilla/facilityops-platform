"use client";

import Link from "next/link";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { useNotifications } from "@/hooks/use-notifications";
import { formatNotificationError } from "@/lib/notifications/display";

import { NotificationItem } from "./notification-item";

const PREVIEW_PAGE_SIZE = 5;

export interface NotificationPreviewProps {
  onClose: () => void;
}

export function NotificationPreview({ onClose }: NotificationPreviewProps) {
  const previewQuery = useNotifications({
    page: 1,
    page_size: PREVIEW_PAGE_SIZE,
    ordering: "-created_at",
  });

  return (
    <div
      className="absolute right-0 z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white shadow-lg"
      role="region"
      aria-label="Notification preview"
    >
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-950">Notifications</h2>
        <p className="mt-1 text-xs text-slate-500">
          Recent updates for your account.
        </p>
      </div>

      <div className="max-h-[24rem] overflow-y-auto p-3">
        {previewQuery.isPending ? (
          <LoadingState
            message="Loading your latest notifications."
            title="Loading notifications"
          />
        ) : null}

        {previewQuery.isError ? (
          <ErrorState
            message={formatNotificationError(
              previewQuery.error,
              "Notifications could not be loaded.",
            )}
            title="Preview unavailable"
          />
        ) : null}

        {previewQuery.data && previewQuery.data.results.length === 0 ? (
          <EmptyState
            message="You do not have any notifications yet."
            title="No notifications"
          />
        ) : null}

        {previewQuery.data && previewQuery.data.results.length > 0 ? (
          <ul className="space-y-2">
            {previewQuery.data.results.map((notification) => (
              <li key={notification.id}>
                <NotificationItem
                  compact
                  notification={notification}
                  onNavigate={onClose}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="border-t border-slate-200 px-4 py-3">
        <Link
          className="inline-flex text-sm font-medium text-blue-700 hover:text-blue-800"
          href="/notifications"
          onClick={onClose}
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}
