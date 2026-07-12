"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildReplaceRolePermissionsPayload,
  clearAllVisible,
  groupPermissionsByModule,
  initializeAssignedPermissionSelection,
  searchPermissions,
  selectAllVisible,
} from "@/lib/rbac/permissions-assignment";
import { ApiError } from "@/services/api/types";
import type { Permission, Role } from "@/types/rbac";

function summarizeError(error: unknown): string {
  if (error instanceof ApiError && error.details?.errors) {
    const messages = Object.entries(error.details.errors)
      .flatMap(([field, fieldMessages]) =>
        fieldMessages.map((message) =>
          field === "non_field_errors" ? message : `${field}: ${message}`,
        ),
      )
      .filter(Boolean);
    if (messages.length > 0) {
      return messages.join(" ");
    }
  }

  if (error instanceof ApiError && error.details?.message) {
    return error.details.message;
  }

  if (!(error instanceof Error)) {
    return "Permissions could not be saved.";
  }
  return error.message || "Permissions could not be saved.";
}

export function RolePermissionDialog({
  assignedPermissions,
  availablePermissions,
  isPending,
  onClose,
  onSave,
  role,
}: {
  assignedPermissions: Permission[];
  availablePermissions: Permission[];
  isPending: boolean;
  onClose: () => void;
  onSave: (permissionIds: string[]) => Promise<void>;
  role: Role;
}) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() =>
    initializeAssignedPermissionSelection(assignedPermissions),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isPending) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isPending, onClose]);

  useEffect(() => {
    setSelectedIds(initializeAssignedPermissionSelection(assignedPermissions));
  }, [assignedPermissions]);

  const visiblePermissions = useMemo(
    () => searchPermissions(availablePermissions, search),
    [availablePermissions, search],
  );
  const groups = useMemo(
    () => groupPermissionsByModule(visiblePermissions),
    [visiblePermissions],
  );

  const emptySelection = selectedIds.size === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div
        aria-describedby="manage-permissions-description"
        aria-labelledby="manage-permissions-title"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl"
        role="dialog"
      >
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-950" id="manage-permissions-title">
            Manage Permissions
          </h2>
          <p className="mt-2 text-sm text-slate-600" id="manage-permissions-description">
            Replace active permissions for {role.name}. Saving applies the full selected set.
          </p>
        </div>

        <div className="space-y-4 overflow-y-auto p-6">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
            <label className="text-sm text-slate-700" htmlFor="permission-search">
              Search permissions by name, code, module, action, or description
            </label>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
              disabled={isPending}
              onClick={() =>
                setSelectedIds((current) =>
                  selectAllVisible(current, visiblePermissions),
                )
              }
              type="button"
            >
              Select all visible
            </button>
            <button
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
              disabled={isPending}
              onClick={() =>
                setSelectedIds((current) =>
                  clearAllVisible(current, visiblePermissions),
                )
              }
              type="button"
            >
              Clear all visible
            </button>
          </div>

          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            id="permission-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search permissions"
            type="search"
            value={search}
          />

          {formError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
              {formError}
            </p>
          ) : null}

          {emptySelection ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              You are about to save an empty permission set. This removes all active assignments from the role.
            </p>
          ) : null}

          <p className="text-sm text-slate-600">
            Selected: {selectedIds.size} of {availablePermissions.length} available active permissions.
          </p>

          {groups.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No permissions match the current search.
            </p>
          ) : (
            groups.map((group) => (
              <section
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                key={group.module}
              >
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  {group.module}
                </h3>
                <ul className="mt-3 space-y-2">
                  {group.permissions.map((permission) => {
                    const checked = selectedIds.has(permission.id);
                    return (
                      <li
                        className="rounded-md border border-slate-200 bg-white p-3"
                        key={permission.id}
                      >
                        <label className="flex cursor-pointer items-start gap-3">
                          <input
                            checked={checked}
                            className="mt-1 h-4 w-4"
                            disabled={isPending}
                            onChange={(event) => {
                              const isChecked = event.target.checked;
                              setSelectedIds((current) => {
                                const next = new Set(current);
                                if (isChecked) {
                                  next.add(permission.id);
                                } else {
                                  next.delete(permission.id);
                                }
                                return next;
                              });
                            }}
                            type="checkbox"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-900">
                              {permission.name}
                            </span>
                            <span className="block font-mono text-xs text-slate-700">
                              {permission.code}
                            </span>
                            <span className="block text-xs text-slate-600">
                              Action: {permission.action}
                            </span>
                            {permission.description ? (
                              <span className="block text-xs text-slate-500">
                                {permission.description}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 p-6 sm:flex-row sm:justify-end">
          <button
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
            disabled={isPending}
            onClick={onClose}
            ref={cancelRef}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            disabled={isPending}
            onClick={async () => {
              setFormError(null);
              try {
                await onSave(
                  buildReplaceRolePermissionsPayload(selectedIds).permission_ids,
                );
              } catch (error) {
                setFormError(summarizeError(error));
              }
            }}
            type="button"
          >
            {isPending ? "Saving..." : "Save permissions"}
          </button>
        </div>
      </div>
    </div>
  );
}
