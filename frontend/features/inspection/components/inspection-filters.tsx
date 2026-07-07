import { FormField } from "@/components/common/form-field";
import {
  SelectField,
  type SelectOption,
} from "@/components/common/select-field";
import type { InspectionListFilters } from "@/types/inspection";

export interface InspectionFiltersProps {
  values: InspectionListFilters;
  departmentOptions: SelectOption[];
  buildingOptions: SelectOption[];
  floorOptions: SelectOption[];
  areaOptions: SelectOption[];
  onChange: (values: InspectionListFilters) => void;
  onReset: () => void;
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "verified", label: "Verified" },
  { value: "cancelled", label: "Cancelled" },
  { value: "reopened", label: "Reopened" },
];

const PRIORITY_OPTIONS: SelectOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const FIVE_S_OPTIONS: SelectOption[] = [
  { value: "sort", label: "Sort" },
  { value: "set_in_order", label: "Set In Order" },
  { value: "shine", label: "Shine" },
  { value: "standardize", label: "Standardize" },
  { value: "sustain", label: "Sustain" },
];

const INSPECTION_TYPE_OPTIONS: SelectOption[] = [
  { value: "routine", label: "Routine" },
  { value: "audit", label: "Audit" },
  { value: "spot_check", label: "Spot Check" },
  { value: "follow_up", label: "Follow Up" },
];

const SORT_OPTIONS: SelectOption[] = [
  { value: "-updated", label: "Updated: newest first" },
  { value: "updated", label: "Updated: oldest first" },
  { value: "-scheduled", label: "Scheduled: newest first" },
  { value: "scheduled", label: "Scheduled: oldest first" },
  { value: "title", label: "Title: A to Z" },
  { value: "-title", label: "Title: Z to A" },
  { value: "number", label: "Inspection number: ascending" },
  { value: "-number", label: "Inspection number: descending" },
  { value: "-priority", label: "Priority: highest first" },
  { value: "priority", label: "Priority: lowest first" },
  { value: "status", label: "Status: workflow order" },
  { value: "-status", label: "Status: reverse workflow order" },
  { value: "-score", label: "Score: highest first" },
  { value: "score", label: "Score: lowest first" },
];

export function InspectionFilters({
  values,
  departmentOptions,
  buildingOptions,
  floorOptions,
  areaOptions,
  onChange,
  onReset,
}: InspectionFiltersProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Search and filters</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Search is sent to the backend and matches inspection number, title,
            remarks, location, and inspector emails. All controls remain read-only
            and only narrow what is already visible.
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
          description="Search inspection number, title, remarks, location, or assigned users."
          htmlFor="inspection-search"
          label="Search"
        >
          <input
            className="block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-950 shadow-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            id="inspection-search"
            onChange={(event) =>
              onChange({
                ...values,
                search: event.target.value,
              })
            }
            placeholder="Search inspections"
            type="search"
            value={values.search}
          />
        </FormField>

        <SelectField
          label="Status"
          name="inspection-status"
          onChange={(event) =>
            onChange({
              ...values,
              status: event.target.value as InspectionListFilters["status"],
            })
          }
          options={STATUS_OPTIONS}
          placeholder="All statuses"
          value={values.status}
        />

        <SelectField
          label="Priority"
          name="inspection-priority"
          onChange={(event) =>
            onChange({
              ...values,
              priority: event.target.value as InspectionListFilters["priority"],
            })
          }
          options={PRIORITY_OPTIONS}
          placeholder="All priorities"
          value={values.priority}
        />

        <SelectField
          label="5S Category"
          name="inspection-five-s-category"
          onChange={(event) =>
            onChange({
              ...values,
              fiveSCategory: event.target.value as InspectionListFilters["fiveSCategory"],
            })
          }
          options={FIVE_S_OPTIONS}
          placeholder="All 5S categories"
          value={values.fiveSCategory}
        />

        <SelectField
          label="Inspection Type"
          name="inspection-type"
          onChange={(event) =>
            onChange({
              ...values,
              inspectionType: event.target.value as InspectionListFilters["inspectionType"],
            })
          }
          options={INSPECTION_TYPE_OPTIONS}
          placeholder="All inspection types"
          value={values.inspectionType}
        />

        <SelectField
          label="Sort"
          name="inspection-sort"
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
          name="inspection-department"
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
          name="inspection-building"
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
          name="inspection-floor"
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
          name="inspection-area"
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
      </div>
    </section>
  );
}
