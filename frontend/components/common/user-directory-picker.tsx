"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { useUserDirectory } from "@/hooks/use-users";
import {
  isUserDirectoryQueryEnabled,
  isUserInDirectoryScope,
  mergeUserDirectoryOptions,
  normalizeOptionalUserId,
} from "@/lib/users/directory";
import type { UserDirectoryItem } from "@/types/users";

export interface UserDirectoryPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
  error?: string;
  description?: string;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  placeholder?: string;
  tenant?: string | null;
  organization?: string | null;
  selectedUser?: UserDirectoryItem | null;
  permissionEnabled?: boolean;
}

const DIRECTORY_PAGE_SIZE = 20;

export function UserDirectoryPicker({
  allowClear = true,
  description,
  disabled = false,
  error,
  label,
  onChange,
  organization,
  permissionEnabled = false,
  placeholder = "Select a user",
  required = false,
  selectedUser,
  tenant,
  value,
}: UserDirectoryPickerProps) {
  const generatedId = useId();
  const selectId = `user-directory-${generatedId}`;
  const descriptionId = `${selectId}-description`;
  const errorId = `${selectId}-error`;
  const statusId = `${selectId}-status`;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [knownSelection, setKnownSelection] = useState<UserDirectoryItem | null>(
    selectedUser ?? null,
  );
  const queryEnabled = isUserDirectoryQueryEnabled(
    permissionEnabled,
    disabled,
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, organization, tenant]);

  useEffect(() => {
    if (!value) {
      setKnownSelection(null);
    } else if (selectedUser?.id === value) {
      setKnownSelection(selectedUser);
    }
  }, [selectedUser, value]);

  useEffect(() => {
    if (
      value &&
      knownSelection?.id === value &&
      !isUserInDirectoryScope(knownSelection, tenant, organization)
    ) {
      onChange(null);
      setKnownSelection(null);
    }
  }, [knownSelection, onChange, organization, tenant, value]);

  const directoryQuery = useUserDirectory(
    {
      search: debouncedSearch || undefined,
      tenant: tenant || undefined,
      organization: organization || undefined,
      page,
      page_size: DIRECTORY_PAGE_SIZE,
      ordering: "email",
    },
    queryEnabled,
  );
  const options = useMemo(
    () =>
      mergeUserDirectoryOptions(
        directoryQuery.data?.results ?? [],
        knownSelection?.id === value ? knownSelection : selectedUser,
      ),
    [directoryQuery.data?.results, knownSelection, selectedUser, value],
  );
  const describedBy = [description ? descriptionId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700" htmlFor={selectId}>
        {label}
      </label>
      {description ? (
        <p className="mt-1 text-xs text-slate-500" id={descriptionId}>
          {description}
        </p>
      ) : null}
      <div className="mt-2 space-y-2">
        <input
          aria-label={`Search ${label.toLowerCase()}`}
          className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          disabled={!queryEnabled}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or email"
          type="search"
          value={search}
        />
        <select
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          disabled={!queryEnabled || directoryQuery.isPending}
          id={selectId}
          onChange={(event) => {
            const nextValue = normalizeOptionalUserId(event.target.value);
            const selected = directoryQuery.data?.results.find(
              (item) => item.id === nextValue,
            );
            setKnownSelection(selected ?? null);
            onChange(nextValue);
          }}
          required={required}
          value={value ?? ""}
        >
          <option value="">
            {allowClear && !required ? "Not assigned" : placeholder}
          </option>
          {options.map((option) => (
            <option key={option.id} value={option.value}>
              {option.label === option.email
                ? option.label
                : `${option.label} — ${option.email}`}
            </option>
          ))}
        </select>
        {allowClear && value ? (
          <button
            className="text-sm font-medium text-blue-700 hover:text-blue-800 disabled:text-slate-400"
            disabled={!queryEnabled}
            onClick={() => {
              setKnownSelection(null);
              onChange(null);
            }}
            type="button"
          >
            Clear selection
          </button>
        ) : null}
        <div aria-live="polite" className="text-xs text-slate-600" id={statusId}>
          {!permissionEnabled
            ? "User directory access is unavailable."
            : directoryQuery.isPending
              ? "Loading users..."
              : directoryQuery.isError
                ? "User directory could not be loaded."
                : directoryQuery.data?.results.length === 0
                  ? "No matching users found."
                  : `${directoryQuery.data?.count ?? 0} active users available.`}
        </div>
        {directoryQuery.isError ? (
          <p className="text-sm text-red-700" role="alert">
            {directoryQuery.error instanceof Error
              ? directoryQuery.error.message
              : "Try searching again."}
          </p>
        ) : null}
        {directoryQuery.data &&
        (directoryQuery.data.previous || directoryQuery.data.next) ? (
          <div className="flex items-center gap-3">
            <button
              className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
              disabled={!directoryQuery.data.previous || directoryQuery.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              Previous users
            </button>
            <span className="text-xs text-slate-600">Page {page}</span>
            <button
              className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-50"
              disabled={!directoryQuery.data.next || directoryQuery.isFetching}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Next users
            </button>
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1 text-sm text-red-700" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
