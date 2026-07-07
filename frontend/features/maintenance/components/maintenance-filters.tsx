import { FormField } from "@/components/common/form-field";
import {
  SelectField,
  type SelectOption,
} from "@/components/common/select-field";
import { SwitchField } from "@/components/common/switch-field";
import type { MaintenanceListFilters } from "@/types/maintenance";

export interface MaintenanceFiltersProps {
  values: MaintenanceListFilters;
  departmentOptions: SelectOption[];
  buildingOptions: SelectOption[];
  floorOptions: SelectOption[];
  areaOptions: SelectOption[];
  onChange: (values: MaintenanceListFilters) => void;
  onReset: () => void;
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const SORT_OPTIONS: SelectOption[] = [
  { value: "-updated", label: "Updated: newest first" },
  { value: "updated", label: "Updated: oldest first" },
  { value: "-created", label: "Created: newest first" },
  { value: "created", label: "Created: oldest first" },
  { value: "title", label: "Title: A to Z" },
  { value: "-title", label: "Title: Z to A" },
  { value: "number", label: "Work order number: ascending" },
  { value: "-number", label: "Work order number: descending" },
  { value: "-priority", label: "Priority: highest first" },
  { value: "priority", label: "Priority: lowest first" },
  { value: "status", label: "Status: workflow order" },
  { value: "-status", label: "Status: reverse workflow order" },
  { value: "due_date", label: "Due date: earliest first" },
  { value: "-due_date", label: "Due date: latest first" },
];

export function MaintenanceFilters({
  values,
  departmentOptions,
  buildingOptions,
  floorOptions,
  areaOptions,
  onChange,
  onReset,
}: MaintenanceFiltersProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Search and filters</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Search is sent to the backend and matches work order number, title,
            asset, assigned user, location, and description. Advanced filters stay
            read-only and narrow the list without exposing workflow actions.
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

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FormField
          description="Search work order number, title, asset, location, description, or assigned user."
          htmlFor="maintenance-search"
          label="Search"
        >
          <input
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            id="maintenance-search"
            onChange={(event) =>
              onChange({
                ...values,
                search: event.target.value,
              })
            }
            placeholder="Search maintenance work orders"
            type="search"
            value={values.search}
          />
        </FormField>

        <SelectField
          label="Status"
          name="maintenance-status"
          onChange={(event) =>
            onChange({
              ...values,
              status: event.target.value as MaintenanceListFilters["status"],
            })
          }
          options={STATUS_OPTIONS}
          placeholder="All statuses"
          value={values.status}
        />

        <SelectField
          label="Priority"
          name="maintenance-priority"
          onChange={(event) =>
            onChange({
              ...values,
              priority: event.target.value as MaintenanceListFilters["priority"],
            })
          }
          options={PRIORITY_OPTIONS}
          placeholder="All priorities"
          value={values.priority}
        />

        <SelectField
          label="Sort"
          name="maintenance-sort"
          onChange={(event) =>
            onChange({
              ...values,
              sort: event.target.value,
            })
          }
          options={SORT_OPTIONS}
          value={values.sort}
        />

        <SelectField
          label="Department"
          name="maintenance-department"
          onChange={(event) =>
            onChange({
              ...values,
              department: event.target.value,
            })
          }
          options={departmentOptions}
          placeholder="All departments"
          value={values.department}
        />

        <SelectField
          label="Building"
          name="maintenance-building"
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
          label="Floor"
          name="maintenance-floor"
          onChange={(event) =>
            onChange({
              ...values,
              floor: event.target.value,
            })
          }
          options={floorOptions}
          placeholder="All floors"
          value={values.floor}
        />

        <SelectField
          label="Area"
          name="maintenance-area"
          onChange={(event) =>
            onChange({
              ...values,
              area: event.target.value,
            })
          }
          options={areaOptions}
          placeholder="All areas"
          value={values.area}
        />

        <FormField
          description="Filter by assignee email fragment."
          htmlFor="maintenance-assignee-email"
          label="Assigned user"
        >
          <input
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            id="maintenance-assignee-email"
            onChange={(event) =>
              onChange({
                ...values,
                assigneeEmail: event.target.value,
              })
            }
            placeholder="technician@example.com"
            type="text"
            value={values.assigneeEmail}
          />
        </FormField>

        <FormField
          description="Filter by requester email fragment."
          htmlFor="maintenance-requester-email"
          label="Created by"
        >
          <input
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            id="maintenance-requester-email"
            onChange={(event) =>
              onChange({
                ...values,
                requesterEmail: event.target.value,
              })
            }
            placeholder="requester@example.com"
            type="text"
            value={values.requesterEmail}
          />
        </FormField>

        <FormField htmlFor="maintenance-created-from" label="Created from">
          <input
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            id="maintenance-created-from"
            onChange={(event) =>
              onChange({
                ...values,
                createdFrom: event.target.value,
              })
            }
            type="date"
            value={values.createdFrom}
          />
        </FormField>

        <FormField htmlFor="maintenance-created-to" label="Created to">
          <input
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            id="maintenance-created-to"
            onChange={(event) =>
              onChange({
                ...values,
                createdTo: event.target.value,
              })
            }
            type="date"
            value={values.createdTo}
          />
        </FormField>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SwitchField
          checked={values.overdue}
          description="Only show work orders that are past due and not yet closed out."
          label="Overdue only"
          name="maintenance-overdue"
          onChange={(event) =>
            onChange({
              ...values,
              overdue: event.target.checked,
            })
          }
        />
        <SwitchField
          checked={values.hasAttachments}
          description="Only show work orders with attachment metadata available."
          label="Has attachments"
          name="maintenance-has-attachments"
          onChange={(event) =>
            onChange({
              ...values,
              hasAttachments: event.target.checked,
            })
          }
        />
      </div>
    </section>
  );
}
