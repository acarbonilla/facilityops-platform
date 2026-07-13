"use client";

import { useEffect, useRef, useState } from "react";

import { formatNotificationError, formatNotificationMutationSuccess } from "@/lib/notifications/display";

export interface NotificationMarkAllReadProps {
  disabled?: boolean;
  isPending?: boolean;
  onConfirm: () => Promise<{ updated_count: number }>;
}

export function NotificationMarkAllRead({
  disabled = false,
  isPending = false,
  onConfirm,
}: NotificationMarkAllReadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    cancelRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending]);

  async function handleConfirm() {
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await onConfirm();
      setSuccessMessage(
        formatNotificationMutationSuccess(
          "All unread notifications marked as read.",
          result.updated_count,
        ),
      );
      setIsOpen(false);
    } catch (mutationError) {
      setError(
        formatNotificationError(
          mutationError,
          "Could not mark all notifications as read.",
        ),
      );
    }
  }

  return (
    <div className="mt-4">
      <button
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || isPending}
        onClick={() => {
          setError(null);
          setSuccessMessage(null);
          setIsOpen(true);
        }}
        type="button"
      >
        {isPending ? "Updating..." : "Mark all as read"}
      </button>

      {successMessage ? (
        <p className="mt-3 text-sm text-emerald-800" role="status">
          {successMessage}
        </p>
      ) : null}

      {error && !isOpen ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {isOpen ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-950">
            Mark all notifications as read?
          </h3>
          <p className="mt-2 text-sm text-slate-600" id="mark-all-read-description">
            This updates every unread notification for your account. Already-read
            notifications are left unchanged.
          </p>
          {error ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              onClick={() => void handleConfirm()}
              type="button"
            >
              {isPending ? "Updating..." : "Confirm mark all as read"}
            </button>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              onClick={() => setIsOpen(false)}
              ref={cancelRef}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
