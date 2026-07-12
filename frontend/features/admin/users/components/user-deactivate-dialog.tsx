"use client";

import type { UserRecord } from "@/types/users";

import { getUserDisplayName } from "@/lib/users/form";

export function UserDeactivateDialog({
  error,
  isPending,
  onClose,
  onConfirm,
  user,
}: {
  error?: string | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  user: UserRecord;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div
        aria-labelledby="deactivate-user-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <h2
          className="text-xl font-semibold tracking-tight text-slate-950"
          id="deactivate-user-title"
        >
          Deactivate user
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Deactivate {getUserDisplayName(user)}? The account will remain in the
          system and can be reactivated by an authorized update. It will not be
          permanently deleted.
        </p>
        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            disabled={isPending}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            disabled={isPending}
            onClick={() => void onConfirm()}
            type="button"
          >
            {isPending ? "Deactivating..." : "Deactivate account"}
          </button>
        </div>
      </div>
    </div>
  );
}
