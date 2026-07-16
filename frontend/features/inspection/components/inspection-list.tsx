"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { DetailField } from "@/components/common/detail-field";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { useInspectionList } from "@/hooks/use-inspection-list";
import { usePermissions } from "@/hooks/use-permissions";
import {
  hydrateInspectionListFilters,
  isReportingReturnParam,
} from "@/lib/reporting/list-hydration";
import {
  getAreas,
  getBuildings,
  getDepartments,
  getFloors,
} from "@/services/api/master-data";
import { masterDataQueryKeys } from "@/services/api/query-keys";
import type { SelectOption } from "@/components/common/select-field";
import type { Area, Building, Department, Floor } from "@/types/master-data";
import type {
  InspectionListFilters,
  InspectionListItem,
  InspectionListParams,
} from "@/types/inspection";

import { InspectionFilters } from "./inspection-filters";
import { InspectionLoadingSkeleton } from "./inspection-loading-skeleton";
import { InspectionPagination } from "./inspection-pagination";
import { InspectionPriorityBadge } from "./inspection-priority-badge";
import { InspectionStatusBadge } from "./inspection-status-badge";

const DEFAULT_FILTERS: InspectionListFilters = {
  search: "",
  status: "",
  priority: "",
  fiveSCategory: "",
  inspectionType: "",
  department: "",
  organization: "",
  building: "",
  floor: "",
  area: "",
  sort: "-updated",
  pageSize: 20,
};

function readWindowSearchParams(): URLSearchParams {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
}

function toOptions<T extends Department | Building | Floor | Area>(items: T[]): SelectOption[] {
  return items.map((item) => ({
    value: item.id,
    label: item.name,
  }));
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatLocationLabel(parts: Array<string | null | undefined>) {
  const filtered = parts.filter(Boolean);
  return filtered.length > 0 ? filtered.join(" / ") : "Not assigned";
}

function formatLabel(value?: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPersonLabel(value?: string | null) {
  return value || "Not assigned";
}

function formatInspectionError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function buildQueryParams(
  filters: InspectionListFilters,
  page: number,
  debouncedSearch: string,
): InspectionListParams {
  return {
    page,
    page_size: filters.pageSize,
    search: debouncedSearch || undefined,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    five_s_category: filters.fiveSCategory || undefined,
    inspection_type: filters.inspectionType || undefined,
    department: filters.department || undefined,
    organization: filters.organization || undefined,
    building: filters.building || undefined,
    floor: filters.floor || undefined,
    area: filters.area || undefined,
    ordering: filters.sort || undefined,
  };
}

export function InspectionListScreen() {
  const { hasPermission, permissionsLoading } = usePermissions();
  const [filters, setFilters] = useState<InspectionListFilters>(() =>
    hydrateInspectionListFilters(readWindowSearchParams(), DEFAULT_FILTERS),
  );
  const fromReporting = isReportingReturnParam(readWindowSearchParams());
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(filters.search.trim());

  const queryParams = buildQueryParams(filters, page, deferredSearch);
  const listQuery = useInspectionList(queryParams);
  const departmentsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("departments", { page_size: 100 }),
    queryFn: () => getDepartments({ page_size: 100 }),
  });
  const buildingsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("buildings", { page_size: 100 }),
    queryFn: () => getBuildings({ page_size: 100 }),
  });
  const floorsQuery = useQuery({
    queryKey: masterDataQueryKeys.list("floors", { page_size: 100 }),
    queryFn: () => getFloors({ page_size: 100 }),
  });
  const areasQuery = useQuery({
    queryKey: masterDataQueryKeys.list("areas", { page_size: 100 }),
    queryFn: () => getAreas({ page_size: 100 }),
  });

  const rows = listQuery.data?.results ?? [];
  const departmentOptions = toOptions(departmentsQuery.data?.results ?? []);
  const buildingOptions = toOptions(buildingsQuery.data?.results ?? []);
  const floorOptions = toOptions(floorsQuery.data?.results ?? []);
  const areaOptions = toOptions(areasQuery.data?.results ?? []);

  const columns: DataTableColumn<InspectionListItem>[] = [
    {
      header: "Inspection No",
      cell: (item) => item.inspection_number,
      className: "min-w-44",
    },
    {
      header: "Title",
      cell: (item) => (
        <div className="min-w-0 whitespace-normal">
          <p className="font-medium text-slate-900">{item.title}</p>
          <p className="mt-1 text-xs text-slate-500">{item.organization_name}</p>
        </div>
      ),
      className: "min-w-72 whitespace-normal",
    },
    {
      header: "Location",
      cell: (item) =>
        formatLocationLabel([item.building_name, item.floor_name, item.area_name]),
      className: "min-w-56 whitespace-normal",
    },
    {
      header: "5S Category",
      cell: (item) => formatLabel(item.five_s_category),
      className: "min-w-32 whitespace-normal",
    },
    {
      header: "Type",
      cell: (item) => formatLabel(item.inspection_type),
      className: "min-w-32 whitespace-normal",
    },
    {
      header: "Priority",
      cell: (item) => <InspectionPriorityBadge priority={item.priority} />,
    },
    {
      header: "Status",
      cell: (item) => <InspectionStatusBadge status={item.status} />,
    },
    {
      header: "Inspector",
      cell: (item) => formatPersonLabel(item.inspector_email),
      className: "min-w-48 whitespace-normal",
    },
    {
      header: "Scheduled",
      cell: (item) => formatDateTime(item.scheduled_date),
      className: "min-w-40 whitespace-normal",
    },
    {
      header: "Score",
      cell: (item) => item.score || "Not scored",
    },
    {
      header: "Actions",
      cell: (item) => (
        <Link
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href={`/inspection/inspections/${item.id}`}
        >
          View detail
        </Link>
      ),
      className: "min-w-36 whitespace-normal",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        description="Protected, server-driven inspection list with backend search, filters, sorting, and pagination. This screen stays read-only and links directly into the inspection detail view."
        eyebrow="5S Inspection"
        title="Inspections"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid gap-4 sm:grid-cols-3">
            <DetailField label="Visible rows" value={rows.length} />
            <DetailField label="Current page" value={page} />
            <DetailField label="Total records" value={listQuery.data?.count ?? 0} />
          </div>
          <div className="flex flex-wrap gap-3">
            {fromReporting ? (
              <Link
                className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href="/reporting"
              >
                Back to Reporting
              </Link>
            ) : null}
            {!permissionsLoading &&
            (hasPermission("inspection.create") ||
              hasPermission("inspection.manage")) ? (
              <Link
                className="inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                href="/inspection/inspections/new"
              >
                New Inspection
              </Link>
            ) : null}
          </div>
        </div>
        {filters.organization ? (
          <p
            className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900"
            role="status"
          >
            Organization filter from Reporting is active for this list.
          </p>
        ) : null}
      </PageHeader>

      <InspectionFilters
        areaOptions={areaOptions}
        buildingOptions={buildingOptions}
        departmentOptions={departmentOptions}
        floorOptions={floorOptions}
        onChange={(nextValues) => {
          setPage(1);
          setFilters(nextValues);
        }}
        onReset={() => {
          setPage(1);
          setFilters(DEFAULT_FILTERS);
        }}
        values={filters}
      />

      {listQuery.isPending ? <InspectionLoadingSkeleton cards={3} rows={8} /> : null}

      {!listQuery.isPending && listQuery.isError ? (
        <ErrorState
          title="Unable to load inspections"
          message={formatInspectionError(
            listQuery.error,
            "Inspection records could not be loaded.",
          )}
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => void listQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          }
        />
      ) : null}

      {!listQuery.isPending && !listQuery.isError && rows.length === 0 ? (
        <EmptyState
          title="No inspections found"
          message="No inspection records matched the current search and filter combination."
        />
      ) : null}

      {!listQuery.isPending && !listQuery.isError && rows.length > 0 ? (
        <>
          <DataTable
            caption="Inspection list"
            columns={columns}
            getRowKey={(item) => item.id}
            rows={rows}
          />
          <InspectionPagination
            isDisabled={listQuery.isFetching}
            onPageChange={setPage}
            onPageSizeChange={(pageSize) => {
              setPage(1);
              setFilters((current) => ({
                ...current,
                pageSize,
              }));
            }}
            page={page}
            pageSize={filters.pageSize}
            totalCount={listQuery.data?.count ?? 0}
          />
        </>
      ) : null}
    </div>
  );
}
