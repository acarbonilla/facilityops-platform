"use client";

import { useEffect, useMemo, useState } from "react";

import { ApiError } from "@/services/api/types";
import type { UserAssignedRole } from "@/types/users";

import {
  buildReplaceUserRolesPayload,
  getInitialAssignedRoleIds,
} from "@/lib/users/roles";

export function UserRoleAssignmentDialog({
  assignedRoles,
  availableRoles,
  isPending,
  onClose,
  onSubmit,
}: {
  assignedRoles: UserAssignedRole[];
  availableRoles: UserAssignedRole[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (roleIds: string[]) => Promise<void>;
}) {
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(() =>
    getInitialAssignedRoleIds(assignedRoles),
  );
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedRoleIds(getInitialAssignedRoleIds(assignedRoles));
  }, [assignedRoles]);

  const hasSystemRoles = useMemo(
    () => availableRoles.some((role) => role.is_system_role),
    [availableRoles],
  );

  function toggleRole(roleId: string) {
    setSelectedRoleIds((current) =>
      current.includes(roleId)
        ? current.filter((item) => item !== roleId)
        : [...current, roleId],
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div
        aria-labelledby="manage-user-roles-title"
        aria-modal="true"
        className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl"
        role="dialog"
      >
        <h2
          className="text-xl font-semibold tracking-tight text-slate-950"
          id="manage-user-roles-title"
        >
          Manage roles
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Replace the active role set for this user. Unselected manageable roles
          will be deactivated but preserved historically.
        </p>

        {hasSystemRoles ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            System-role changes affect high-privilege access. Review these
            assignments carefully before saving.
          </p>
        ) : null}

        {fieldError ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {fieldError}
          </p>
        ) : null}
        {formError ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="mt-6 space-y-3">
          {availableRoles.length > 0 ? (
            availableRoles.map((role) => {
              const checked = selectedRoleIds.includes(role.id);
              return (
                <label
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
                  key={role.id}
                >
                  <input
                    checked={checked}
                    className="mt-1 h-4 w-4"
                    disabled={isPending}
                    onChange={() => toggleRole(role.id)}
                    type="checkbox"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-950">{role.name}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {role.code}
                      </span>
                      {role.is_system_role ? (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                          System role
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {role.description || "No description provided."}
                    </p>
                  </div>
                </label>
              );
            })
          ) : (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No assignable roles are available for this session.
            </p>
          )}
        </div>

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
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            disabled={isPending}
            onClick={async () => {
              setFieldError(null);
              setFormError(null);
              try {
                await onSubmit(buildReplaceUserRolesPayload(selectedRoleIds).role_ids);
              } catch (error) {
                if (error instanceof ApiError) {
                  const roleFieldMessages = error.details?.errors?.role_ids ?? [];
                  const otherMessages = Object.entries(error.details?.errors ?? {})
                    .filter(([field]) => field !== "role_ids")
                    .flatMap(([, messages]) => messages);
                  setFieldError(roleFieldMessages[0] ?? null);
                  setFormError(
                    otherMessages[0] ??
                      error.details?.message ??
                      error.message ??
                      "Roles could not be updated.",
                  );
                  return;
                }

                setFormError(
                  error instanceof Error && error.message
                    ? error.message
                    : "Roles could not be updated.",
                );
              }
            }}
            type="button"
          >
            {isPending ? "Saving..." : "Save roles"}
          </button>
        </div>
      </div>
    </div>
  );
}