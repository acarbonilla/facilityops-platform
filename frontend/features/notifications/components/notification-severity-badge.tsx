import type { NotificationSeverity } from "@/types/notifications";
import {
  formatNotificationSeverityLabel,
  getNotificationSeverityStyles,
} from "@/lib/notifications/display";

export function NotificationSeverityBadge({
  severity,
}: {
  severity: NotificationSeverity;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        getNotificationSeverityStyles(severity),
      ].join(" ")}
    >
      {formatNotificationSeverityLabel(severity)}
    </span>
  );
}
