import { FormField } from "@/components/common/form-field";
import type { SelectOption } from "@/components/common/select-field";
import type { NotificationListFilters } from "@/types/notifications";

export interface NotificationFiltersProps {
  filters: NotificationListFilters;
  isDisabled?: boolean;
  onChange: (filters: NotificationListFilters) => void;
  onReset: () => void;
}

const READ_STATE_OPTIONS: SelectOption[] = [
  { value: "", label: "All notifications" },
  { value: "unread", label: "Unread only" },
  { value: "read", label: "Read only" },
];

const SEVERITY_OPTIONS: SelectOption[] = [
  { value: "", label: "All severities" },
  { value: "info", label: "Info" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
];

export function NotificationFilters({
  filters,
  isDisabled = false,
  onChange,
  onReset,
}: NotificationFiltersProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Filters</h2>
          <p className="mt-1 text-sm text-slate-600">
            Narrow notifications by read state, severity, or source module.
          </p>
        </div>
        <button
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isDisabled}
          onClick={onReset}
          type="button"
        >
          Clear filters
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FormField htmlFor="notification-read-state" label="Read state">
          <select
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            disabled={isDisabled}
            id="notification-read-state"
            onChange={(event) =>
              onChange({
                ...filters,
                readState: event.target.value as NotificationListFilters["readState"],
              })
            }
            value={filters.readState}
          >
            {READ_STATE_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField htmlFor="notification-severity" label="Severity">
          <select
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            disabled={isDisabled}
            id="notification-severity"
            onChange={(event) =>
              onChange({
                ...filters,
                severity: event.target.value as NotificationListFilters["severity"],
              })
            }
            value={filters.severity}
          >
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField htmlFor="notification-source-module" label="Source module">
          <input
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            disabled={isDisabled}
            id="notification-source-module"
            onChange={(event) =>
              onChange({
                ...filters,
                sourceModule: event.target.value,
              })
            }
            placeholder="e.g. maintenance"
            type="text"
            value={filters.sourceModule}
          />
        </FormField>
      </div>
    </section>
  );
}
