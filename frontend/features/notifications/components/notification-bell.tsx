"use client";

import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useNotificationUnreadCount } from "@/hooks/use-notifications";
import { formatUnreadBadgeCount } from "@/lib/notifications/display";

import { NotificationPreview, NOTIFICATION_PREVIEW_ID } from "./notification-preview";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const unreadCountQuery = useNotificationUnreadCount();
  const badgeLabel = formatUnreadBadgeCount(
    unreadCountQuery.data?.unread_count ?? 0,
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-controls={NOTIFICATION_PREVIEW_ID}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Notifications"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <Bell aria-hidden="true" className="h-5 w-5" />
        <span className="pointer-events-none absolute -right-0.5 -top-0.5 inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center">
          {badgeLabel ? (
            <span className="rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white">
              {badgeLabel}
            </span>
          ) : null}
        </span>
      </button>

      {isOpen ? <NotificationPreview onClose={() => setIsOpen(false)} /> : null}
    </div>
  );
}
