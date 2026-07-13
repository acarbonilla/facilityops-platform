"use client";

import Link from "next/link";

import type { Notification } from "@/types/notifications";
import {
  formatNotificationSourceModule,
  formatNotificationTimestamp,
  getIndividualNotificationActionLabel,
  getSafeNotificationTargetUrl,
} from "@/lib/notifications/display";

import { NotificationSeverityBadge } from "./notification-severity-badge";

export interface NotificationItemProps {
  notification: Notification;
  compact?: boolean;
  onNavigate?: () => void;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onToggleSelected?: (notificationId: string, selected: boolean) => void;
  showStateActions?: boolean;
  previewActionsOnly?: boolean;
  isActionPending?: boolean;
  onMarkRead?: () => void;
  onMarkUnread?: () => void;
  actionError?: string | null;
}

function NotificationItemContent({
  notification,
  compact = false,
}: {
  notification: Notification;
  compact?: boolean;
}) {
  const sourceModuleLabel = formatNotificationSourceModule(
    notification.source_module,
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p
          className={[
            "text-sm text-slate-950",
            notification.is_read ? "font-medium" : "font-semibold",
          ].join(" ")}
        >
          {notification.title}
        </p>
        <NotificationSeverityBadge severity={notification.severity} />
      </div>
      <p
        className={[
          "mt-1 text-slate-600",
          compact ? "line-clamp-2 text-xs" : "text-sm",
        ].join(" ")}
      >
        {notification.message}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <time dateTime={notification.created_at}>
          {formatNotificationTimestamp(notification.created_at)}
        </time>
        {sourceModuleLabel ? <span>{sourceModuleLabel}</span> : null}
      </div>
    </>
  );
}

export function NotificationItem({
  notification,
  compact = false,
  onNavigate,
  showCheckbox = false,
  isSelected = false,
  onToggleSelected,
  showStateActions = false,
  previewActionsOnly = false,
  isActionPending = false,
  onMarkRead,
  onMarkUnread,
  actionError,
}: NotificationItemProps) {
  const safeTargetUrl = getSafeNotificationTargetUrl(notification.target_url);
  const showMarkRead =
    showStateActions && !notification.is_read && Boolean(onMarkRead);
  const showMarkUnread =
    showStateActions &&
    notification.is_read &&
    Boolean(onMarkUnread) &&
    !previewActionsOnly;

  return (
    <article
      className={[
        "rounded-lg border border-slate-200 bg-white p-4 transition",
        notification.is_read ? "" : "border-l-4 border-l-blue-600",
      ].join(" ")}
    >
      <div className="flex gap-3">
        {showCheckbox ? (
          <div className="pt-1">
            <input
              aria-label={`Select notification: ${notification.title}`}
              checked={isSelected}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              disabled={isActionPending}
              onChange={(event) =>
                onToggleSelected?.(notification.id, event.target.checked)
              }
              type="checkbox"
            />
          </div>
        ) : (
          <span
            aria-hidden="true"
            className={[
              "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
              notification.is_read ? "bg-transparent" : "bg-blue-600",
            ].join(" ")}
          />
        )}

        <div className="min-w-0 flex-1">
          <NotificationItemContent compact={compact} notification={notification} />

          {safeTargetUrl ? (
            <Link
              className="mt-3 inline-flex text-sm font-medium text-blue-700 hover:text-blue-800"
              href={safeTargetUrl}
              onClick={onNavigate}
            >
              Open notification
            </Link>
          ) : null}

          {showMarkRead || showMarkUnread ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {showMarkRead ? (
                <button
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isActionPending}
                  onClick={onMarkRead}
                  type="button"
                >
                  {isActionPending
                    ? "Updating..."
                    : getIndividualNotificationActionLabel(notification.is_read)}
                </button>
              ) : null}
              {showMarkUnread ? (
                <button
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isActionPending}
                  onClick={onMarkUnread}
                  type="button"
                >
                  {isActionPending
                    ? "Updating..."
                    : getIndividualNotificationActionLabel(notification.is_read)}
                </button>
              ) : null}
            </div>
          ) : null}

          {actionError ? (
            <p className="mt-2 text-xs text-red-700" role="alert">
              {actionError}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
