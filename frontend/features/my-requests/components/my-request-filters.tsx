import {
  SelectField,
  type SelectOption,
} from "@/components/common/select-field";
import type { MyRequestFilterValues } from "@/types/my-requests";
import type { FmTicketCategory, FmTicketStatus } from "@/types/fm-tickets";

export interface MyRequestFiltersProps {
  values: MyRequestFilterValues;
  categoryOptions: SelectOption[];
  onChange: (values: MyRequestFilterValues) => void;
  onReset: () => void;
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: "open", label: "Submitted" },
  { value: "assigned", label: "Assigned to facilities" },
  { value: "in_progress", label: "In progress" },
  { value: "on_hold", label: "On hold" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

export function MyRequestFilters({
  values,
  categoryOptions,
  onChange,
  onReset,
}: MyRequestFiltersProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Filters</h2>
          <p className="mt-1 text-sm text-slate-600">
            Filter your submitted requests by status or category.
          </p>
        </div>
        <button
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
          onClick={onReset}
          type="button"
        >
          Clear filters
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <SelectField
          label="Status"
          name="my-request-status"
          onChange={(event) =>
            onChange({
              ...values,
              status: event.target.value as FmTicketStatus | "",
            })
          }
          options={STATUS_OPTIONS}
          placeholder="All statuses"
          value={values.status}
        />

        <SelectField
          label="Category"
          name="my-request-category"
          onChange={(event) =>
            onChange({
              ...values,
              category: event.target.value as FmTicketCategory | "",
            })
          }
          options={categoryOptions}
          placeholder="All categories"
          value={values.category}
        />
      </div>
    </section>
  );
}
