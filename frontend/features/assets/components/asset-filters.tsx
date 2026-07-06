import type { ChangeEvent } from "react";

import { SelectField, type SelectOption } from "@/components/common/select-field";
import { TextInputField } from "@/features/master-data/components/shared";

export interface AssetFilterValues {
  search: string;
  assetType: string;
  building: string;
  status: "all" | "active" | "inactive";
}

export interface AssetFiltersProps {
  values: AssetFilterValues;
  assetTypeOptions: SelectOption[];
  buildingOptions: SelectOption[];
  onChange: (values: AssetFilterValues) => void;
  onReset: () => void;
}

function updateField<T extends keyof AssetFilterValues>(
  current: AssetFilterValues,
  field: T,
  value: AssetFilterValues[T],
): AssetFilterValues {
  return {
    ...current,
    [field]: value,
  };
}

export function AssetFilters({
  assetTypeOptions,
  buildingOptions,
  onChange,
  onReset,
  values,
}: AssetFiltersProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            Asset filters
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Simple client-side filtering for the current loaded page of asset
            results.
          </p>
        </div>
        <button
          className="inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={onReset}
          type="button"
        >
          Reset filters
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TextInputField
          description="Search by asset name or code."
          id="asset-filter-search"
          inputProps={{
            value: values.search,
            onChange: (event: ChangeEvent<HTMLInputElement>) =>
              onChange(updateField(values, "search", event.target.value)),
            placeholder: "Search assets",
          }}
          label="Search"
        />
        <SelectField
          description="Filter the current page by asset type."
          id="asset-filter-type"
          label="Asset type"
          onChange={(event) =>
            onChange(updateField(values, "assetType", event.target.value))
          }
          options={assetTypeOptions}
          value={values.assetType}
        />
        <SelectField
          description="Filter the current page by building."
          id="asset-filter-building"
          label="Building"
          onChange={(event) =>
            onChange(updateField(values, "building", event.target.value))
          }
          options={buildingOptions}
          value={values.building}
        />
        <SelectField
          description="Filter by current active status."
          id="asset-filter-status"
          label="Status"
          onChange={(event) =>
            onChange(
              updateField(
                values,
                "status",
                event.target.value as AssetFilterValues["status"],
              ),
            )
          }
          options={[
            { value: "all", label: "All statuses" },
            { value: "active", label: "Active only" },
            { value: "inactive", label: "Inactive only" },
          ]}
          placeholder="All statuses"
          value={values.status}
        />
      </div>
    </section>
  );
}
