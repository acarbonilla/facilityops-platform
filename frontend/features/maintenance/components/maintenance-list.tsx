"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { DetailField } from "@/components/common/detail-field";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { useMaintenanceList } from "@/hooks/use-maintenance-list";
import { usePermissions } from "@/hooks/use-permissions";
import {
  getAreas,
  getBuildings,
  getDepartments,
  getFloors,
} from "@/services/api/master-data";
import { masterDataQueryKeys } from "@/services/api/query-keys";
import { formatDateTime, formatLocationLabel, formatMaintenanceError, formatPersonLabel } from "@/lib/maintenance/display";
import type { SelectOption } from "@/components/common/select-field";
import type { Area, Building, Department, Floor } from "@/types/master-data";
import type {
  MaintenanceListFilters,
  MaintenanceListParams,
  MaintenanceWorkOrderListItem,
} from "@/types/maintenance";

import { MaintenanceFilters } from "./maintenance-filters";
import { MaintenanceLoadingSkeleton } from "./maintenance-loading-skeleton";
import { MaintenancePagination } from "./maintenance-pagination";
import { MaintenancePriorityBadge } from "./maintenance-priority-badge";
import { MaintenanceStatusBadge } from "./maintenance-status-badge";
import {
  MaintenanceEscalationBadge,
  MaintenanceOverdueBadge,
  MaintenanceSLAStatusBadge,
} from "./maintenance-sla-badges";

const DEFAULT_FILTERS: MaintenanceListFilters = {
  search: "",
  status: "",
  priority: "",
  department: "",
  building: "",
  floor: "",
  area: "",
  assigneeEmail: "",
  requesterEmail: "",
  overdue: false,
  slaStatus: "",
  hasActiveEscalation: false,
  hasAttachments: false,
  createdFrom: "",
  createdTo: "",
  sort: "-updated",
  pageSize: 20,
};

function toOptions<T extends Department | Building | Floor | Area>(items: T[]): SelectOption[] {
  return items.map((item) => ({
    value: item.id,
    label: item.name,
  }));
}

function buildQueryParams(
  filters: MaintenanceListFilters,
  page: number,
  debouncedSearch: string,
): MaintenanceListParams {
  return {
    page,
    page_size: filters.pageSize,
    search: debouncedSearch || undefined,
    status: filters.status || undefined,
    priority: filters.priority || undefined,
    department: filters.department || undefined,
    building: filters.building || undefined,
    floor: filters.floor || undefined,
    area: filters.area || undefined,
    assignee_email: filters.assigneeEmail || undefined,
    requester_email: filters.requesterEmail || undefined,
    is_overdue: filters.overdue ? true : undefined,
    sla_status: filters.slaStatus || undefined,
    has_active_escalation: filters.hasActiveEscalation ? true : undefined,
    has_attachments: filters.hasAttachments ? true : undefined,
    created_from: filters.createdFrom || undefined,
    created_to: filters.createdTo || undefined,
    ordering: filters.sort || undefined,
  };
}

export function MaintenanceListScreen() {
  const { hasPermission, permissionsLoading } = usePermissions();
  const [filters, setFilters] = useState<MaintenanceListFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(filters.search.trim());

  const queryParams = buildQueryParams(filters, page, deferredSearch);
  const listQuery = useMaintenanceList(queryParams);
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

  const columns: DataTableColumn<MaintenanceWorkOrderListItem>[] = [
    {
      header: "Work Order No",
      cell: (item) => item.work_order_number,
      className: "min-w-40",
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
      header: "Asset",
      cell: (item) => (
        <div className="min-w-0 whitespace-normal">
          <p className="font-medium text-slate-900">{item.asset_name}</p>
          <p className="mt-1 text-xs text-slate-500">{item.asset_code}</p>
        </div>
      ),
      className: "min-w-56 whitespace-normal",
    },
    {
      header: "Location",
      cell: (item) =>
        formatLocationLabel([item.building_name, item.floor_name, item.area_name]),
      className: "min-w-56 whitespace-normal",
    },
    {
      header: "Priority",
      cell: (item) => <MaintenancePriorityBadge priority={item.priority} />,
    },
    {
      header: "Status",
      cell: (item) => <MaintenanceStatusBadge status={item.status} />,
    },
    {
      header: "SLA",
      cell: (item) => (
        <div className="flex min-w-32 flex-col items-start gap-1.5">
          <MaintenanceSLAStatusBadge status={item.sla_status} />
          {item.sla_is_overdue ? <MaintenanceOverdueBadge /> : null}
          {item.has_active_escalation ? <MaintenanceEscalationBadge /> : null}
        </div>
      ),
    },
    {
      header: "Assigned To",
      cell: (item) => formatPersonLabel(item.assignee_email),
      className: "min-w-48 whitespace-normal",
    },
    {
      header: "Due Date",
      cell: (item) => formatDateTime(item.due_at),
      className: "min-w-40 whitespace-normal",
    },
    {
      header: "Created By",
      cell: (item) => formatPersonLabel(item.requester_email, "Unavailable"),
      className: "min-w-48 whitespace-normal",
    },
    {
      header: "Updated Date",
      cell: (item) => formatDateTime(item.updated_at),
      className: "min-w-40 whitespace-normal",
    },
    {
      header: "Actions",
      cell: (item) => (
        <Link
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          href={`/maintenance/work-orders/${item.id}`}
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
        description="Server-driven maintenance work order list with backend search, advanced filters, sorting, and pagination. Read-only actions stay limited to inspection and navigation."
        eyebrow="Maintenance"
        title="Maintenance Work Orders"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <dl className="grid gap-4 sm:grid-cols-3">
            <DetailField label="Visible rows" value={rows.length} />
            <DetailField label="Current page" value={page} />
            <DetailField label="Total records" value={listQuery.data?.count ?? 0} />
          </dl>
          {!permissionsLoading &&
          (hasPermission("maintenance.create") ||
            hasPermission("maintenance.work_order.create")) ? (
            <Link
              className="inline-flex items-center justify-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              href="/maintenance/work-orders/new"
            >
              Create Standalone Work Order
            </Link>
          ) : null}
        </div>
      </PageHeader>

      <MaintenanceFilters
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

      {listQuery.isPending ? <MaintenanceLoadingSkeleton cards={3} rows={8} /> : null}

      {!listQuery.isPending && listQuery.isError ? (
        <ErrorState
          title="Unable to load maintenance work orders"
          message={formatMaintenanceError(
            listQuery.error,
            "Maintenance work orders could not be loaded.",
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
          title="No work orders found"
          message="No maintenance work orders matched the current search and filter combination."
        />
      ) : null}

      {!listQuery.isPending && !listQuery.isError && rows.length > 0 ? (
        <>
          <DataTable
            caption="Maintenance work order list"
            columns={columns}
            getRowKey={(item) => item.id}
            rows={rows}
          />
          <MaintenancePagination
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
