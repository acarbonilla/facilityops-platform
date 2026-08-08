"use client";

/**
 * FO-115C role-scoped assignment picker (Project Manager / Task PIC).
 */

import { useEffect, useId, useMemo, useState } from "react";

import {
  formatAssignmentOptionLabel,
  mergeAssignmentOptions,
  type ProjectAssignmentOption,
} from "@/lib/projects/assignment-options";
import { normalizeOptionalUserId } from "@/lib/users/directory";

export interface ProjectAssignmentPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
  options: ProjectAssignmentOption[];
  loading?: boolean;
  error?: string;
  description?: string;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  search: string;
  onSearchChange: (value: string) => void;
  selectedOption?: ProjectAssignmentOption | null;
  statusMessage?: string;
}

export function ProjectAssignmentPicker({
  allowClear = true,
  description,
  disabled = false,
  emptyMessage = "No eligible users found.",
  error,
  label,
  loading = false,
  onChange,
  onSearchChange,
  options,
  placeholder = "Select a user",
  required = false,
  search,
  selectedOption,
  statusMessage,
  value,
}: ProjectAssignmentPickerProps) {
  const generatedId = useId();
  const selectId = `project-assignment-${generatedId}`;
  const descriptionId = `${selectId}-description`;
  const errorId = `${selectId}-error`;
  const statusId = `${selectId}-status`;
  const [knownSelection, setKnownSelection] =
    useState<ProjectAssignmentOption | null>(selectedOption ?? null);

  useEffect(() => {
    if (!value) {
      setKnownSelection(null);
    } else if (selectedOption?.id === value) {
      setKnownSelection(selectedOption);
    }
  }, [selectedOption, value]);

  const merged = useMemo(
    () =>
      mergeAssignmentOptions(
        options,
        knownSelection?.id === value ? knownSelection : selectedOption,
      ),
    [knownSelection, options, selectedOption, value],
  );

  const describedBy =
    [description ? descriptionId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div>
      <label
        className="block text-sm font-medium text-slate-700"
        htmlFor={selectId}
      >
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
          disabled={disabled}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name or email"
          type="search"
          value={search}
        />
        <select
          aria-describedby={describedBy}
          aria-invalid={Boolean(error)}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
          disabled={disabled || loading}
          id={selectId}
          onChange={(event) => {
            const nextValue = normalizeOptionalUserId(event.target.value);
            const selected =
              merged.find((item) => item.id === nextValue) ?? null;
            setKnownSelection(selected);
            onChange(nextValue);
          }}
          required={required}
          value={value ?? ""}
        >
          <option value="">
            {allowClear && !required ? "Unassigned" : placeholder}
          </option>
          {merged.map((option) => (
            <option key={option.id} value={option.id}>
              {formatAssignmentOptionLabel(option)}
            </option>
          ))}
        </select>
        {allowClear && value ? (
          <button
            className="text-sm font-medium text-blue-700 hover:text-blue-800 disabled:text-slate-400"
            disabled={disabled}
            onClick={() => {
              setKnownSelection(null);
              onChange(null);
            }}
            type="button"
          >
            Clear selection
          </button>
        ) : null}
        <div
          aria-live="polite"
          className="text-xs text-slate-600"
          id={statusId}
        >
          {statusMessage
            ? statusMessage
            : loading
              ? "Loading eligible users..."
              : merged.length === 0
                ? emptyMessage
                : `${merged.length} eligible user${merged.length === 1 ? "" : "s"} available.`}
        </div>
        {error ? (
          <p className="text-sm text-red-700" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
