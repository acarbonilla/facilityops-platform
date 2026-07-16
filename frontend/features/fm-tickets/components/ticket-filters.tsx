import { FormField } from "@/components/common/form-field";
import {
  SelectField,
  type SelectOption,
} from "@/components/common/select-field";
import type {
  FmTicketCategory,
  FmTicketPriority,
  FmTicketStatus,
} from "@/types/fm-tickets";

export interface TicketFilterValues {
  search: string;
  status: FmTicketStatus | "";
  priority: FmTicketPriority | "";
  category: FmTicketCategory | "";
  organization: string;
  building: string;
  assignee: string;
}

export interface TicketFiltersProps {
  values: TicketFilterValues;
  buildingOptions: SelectOption[];
  assigneeOptions: SelectOption[];
  onChange: (values: TicketFilterValues) => void;
  onReset: () => void;
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
  { value: "hvac", label: "HVAC" },
  { value: "civil", label: "Civil" },
  { value: "safety", label: "Safety" },
  { value: "cleaning", label: "Cleaning" },
  { value: "security", label: "Security" },
  { value: "other", label: "Other" },
];

export function TicketFilters({
  values,
  buildingOptions,
  assigneeOptions,
  onChange,
  onReset,
}: TicketFiltersProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Filters</h2>
          <p className="mt-1 text-sm text-slate-600">
            Status, priority, category, building, and assignee are sent to the backend
            when selected. Ticket number and title search filters the currently loaded
            page only.
          </p>
        </div>
        <button
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={onReset}
          type="button"
        >
          Reset filters
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FormField
          description="Client-side search across the visible page only."
          htmlFor="fm-ticket-search"
          label="Ticket number or title"
        >
          <input
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            id="fm-ticket-search"
            onChange={(event) =>
              onChange({
                ...values,
                search: event.target.value,
              })
            }
            placeholder="Search visible tickets"
            type="search"
            value={values.search}
          />
        </FormField>

        <SelectField
          label="Status"
          name="status"
          onChange={(event) =>
            onChange({
              ...values,
              status: event.target.value as TicketFilterValues["status"],
            })
          }
          options={STATUS_OPTIONS}
          value={values.status}
        />

        <SelectField
          label="Priority"
          name="priority"
          onChange={(event) =>
            onChange({
              ...values,
              priority: event.target.value as TicketFilterValues["priority"],
            })
          }
          options={PRIORITY_OPTIONS}
          value={values.priority}
        />

        <SelectField
          label="Category"
          name="category"
          onChange={(event) =>
            onChange({
              ...values,
              category: event.target.value as TicketFilterValues["category"],
            })
          }
          options={CATEGORY_OPTIONS}
          value={values.category}
        />

        <SelectField
          label="Building"
          name="building"
          onChange={(event) =>
            onChange({
              ...values,
              building: event.target.value,
            })
          }
          options={buildingOptions}
          placeholder="All buildings"
          value={values.building}
        />

        <SelectField
          label="Assignee"
          name="assignee"
          onChange={(event) =>
            onChange({
              ...values,
              assignee: event.target.value,
            })
          }
          options={assigneeOptions}
          placeholder="All assignees"
          value={values.assignee}
        />
      </div>
    </section>
  );
}
