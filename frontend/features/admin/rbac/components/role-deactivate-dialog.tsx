"use client";

import { useEffect, useRef } from "react";

import type { Role } from "@/types/rbac";

export function RoleDeactivateDialog({
  error,
  isPending,
  onClose,
  onConfirm,
  role,
}: {
  error?: string | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  role: Role;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPending, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div
        aria-describedby="deactivate-role-description"
        aria-labelledby="deactivate-role-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <h2 className="text-xl font-semibold text-slate-950" id="deactivate-role-title">
          Deactivate role
        </h2>
        <div className="mt-2 space-y-2 text-sm text-slate-600" id="deactivate-role-description">
          <p>Deactivate {role.name}?</p>
          <p>
            The role record remains stored, while its user-role and role-permission
            assignments become inactive. Reactivation is not available in this feature.
          </p>
        </div>
        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
            disabled={isPending}
            onClick={onClose}
            ref={cancelRef}
            type="button"
          >
            Cancel deactivation
          </button>
          <button
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            disabled={isPending}
            onClick={() => void onConfirm()}
            type="button"
          >
            {isPending ? "Deactivating role..." : "Deactivate role"}
          </button>
        </div>
      </div>
    </div>
  );
}
