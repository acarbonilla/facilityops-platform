import Link from "next/link";

import type { Notification } from "@/types/notifications";
import {
  formatNotificationSourceModule,
  formatNotificationTimestamp,
  getSafeNotificationTargetUrl,
} from "@/lib/notifications/display";

import { NotificationSeverityBadge } from "./notification-severity-badge";

export interface NotificationItemProps {
  notification: Notification;
  compact?: boolean;
  onNavigate?: () => void;
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
    <div className="flex gap-3">
      <span
        aria-hidden="true"
        className={[
          "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
          notification.is_read ? "bg-transparent" : "bg-blue-600",
        ].join(" ")}
      />
      <div className="min-w-0 flex-1">
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
      </div>
    </div>
  );
}

export function NotificationItem({
  notification,
  compact = false,
  onNavigate,
}: NotificationItemProps) {
  const safeTargetUrl = getSafeNotificationTargetUrl(notification.target_url);
  const className = [
    "block rounded-lg border border-slate-200 bg-white p-4 transition",
    safeTargetUrl ? "hover:border-slate-300 hover:bg-slate-50" : "",
    notification.is_read ? "" : "border-l-4 border-l-blue-600",
  ].join(" ");

  if (!safeTargetUrl) {
    return (
      <article className={className}>
        <NotificationItemContent compact={compact} notification={notification} />
      </article>
    );
  }

  return (
    <article className={className}>
      <Link className="block" href={safeTargetUrl} onClick={onNavigate}>
        <NotificationItemContent compact={compact} notification={notification} />
      </Link>
    </article>
  );
}
