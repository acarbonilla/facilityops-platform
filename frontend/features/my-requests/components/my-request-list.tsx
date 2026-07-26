"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { PageHeader } from "@/components/common/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { useMyRequestList } from "@/hooks/use-my-requests";
import {
  formatRequesterCategoryLabel,
  formatRequesterDateTime,
  formatRequesterLocation,
} from "@/lib/my-requests/display";
import {
  hasActiveMyRequestFilters,
  normalizeMyRequestFilters,
} from "@/lib/my-requests/form";
import type { MyRequestFilterValues, MyRequestListItem } from "@/types/my-requests";
import { InspectionPagination } from "@/features/inspection/components/inspection-pagination";

import { MyRequestFilters } from "./my-request-filters";
import { RequesterStatusBadge } from "./requester-status-badge";

const DEFAULT_FILTERS: MyRequestFilterValues = {
  status: "",
  category: "",
};

function CellStack({
  primary,
  secondary,
}: {
  primary: string;
  secondary?: string;
}) {
  return (
    <div className="min-w-0 whitespace-normal break-words">
      <p className="font-medium text-slate-900">{primary}</p>
      {secondary ? <p className="mt-1 text-xs text-slate-500">{secondary}</p> : null}
    </div>
  );
}

export function MyRequestListScreen() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("fm_tickets.create");
  const [filters, setFilters] = useState<MyRequestFilterValues>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const queryParams = useMemo(
    () => ({
      ...normalizeMyRequestFilters(filters),
      page,
      page_size: pageSize,
    }),
    [filters, page, pageSize],
  );

  const listQuery = useMyRequestList(queryParams);
  const requests = useMemo(
    () => listQuery.data?.results ?? [],
    [listQuery.data?.results],
  );
  const totalCount = listQuery.data?.count ?? 0;

  const categoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const options = [];
    for (const request of requests) {
      if (seen.has(request.category)) {
        continue;
      }
      seen.add(request.category);
      options.push({
        value: request.category,
        label: formatRequesterCategoryLabel(request.category),
      });
    }
    return options.sort((left, right) => left.label.localeCompare(right.label));
  }, [requests]);

  const columns: DataTableColumn<MyRequestListItem>[] = [
    {
      header: "Request number",
      cell: (request) => request.ticket_number,
    },
    {
      header: "Title",
      cell: (request) => (
        <CellStack
          primary={request.title}
          secondary={request.organization_name}
        />
      ),
      className: "min-w-56 whitespace-normal",
    },
    {
      header: "Status",
      cell: (request) => <RequesterStatusBadge status={request.status} />,
    },
    {
      header: "Category",
      cell: (request) => formatRequesterCategoryLabel(request.category),
    },
    {
      header: "Location",
      cell: (request) =>
        formatRequesterLocation([
          request.building_name,
          request.floor_name,
          request.area_name,
          request.asset_name,
        ]),
      className: "min-w-56 whitespace-normal break-words",
    },
    {
      header: "Reported date",
      cell: (request) => formatRequesterDateTime(request.reported_at),
      className: "min-w-44 whitespace-normal",
    },
    {
      header: "Actions",
      cell: (request) => (
        <Link
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
          href={`/my-requests/${request.id}`}
        >
          View request
        </Link>
      ),
      className: "min-w-40 whitespace-normal",
    },
  ];

  const hasFilters = hasActiveMyRequestFilters(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Track the facility requests you have submitted. Status updates are managed by the facilities team."
        title="My Requests"
      >
        {canCreate ? (
          <Link
            className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            href="/my-requests/new"
          >
            Submit a Request
          </Link>
        ) : null}
      </PageHeader>

      <MyRequestFilters
        categoryOptions={categoryOptions}
        onChange={(next) => {
          setFilters(next);
          setPage(1);
        }}
        onReset={() => {
          setFilters(DEFAULT_FILTERS);
          setPage(1);
        }}
        values={filters}
      />

      {listQuery.isLoading ? (
        <LoadingState
          message="Loading your submitted requests."
          title="Loading My Requests"
        />
      ) : null}

      {listQuery.isError ? (
        <ErrorState
          action={
            <button
              className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              onClick={() => void listQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          }
          message="Your requests could not be loaded. Retry to refresh the list."
          title="Unable to load requests"
        />
      ) : null}

      {!listQuery.isLoading && !listQuery.isError && requests.length === 0 ? (
        <EmptyState
          message={
            hasFilters
              ? "No requests match the selected filters. Clear filters or submit a new request."
              : "You have not submitted any facility requests yet."
          }
          title={hasFilters ? "No matching requests" : "No requests yet"}
        />
      ) : null}

      {!listQuery.isLoading && !listQuery.isError && requests.length > 0 ? (
        <>
          <DataTable
            columns={columns}
            getRowKey={(request) => request.id}
            rows={requests}
          />
          <InspectionPagination
            isDisabled={listQuery.isFetching}
            onPageChange={setPage}
            onPageSizeChange={(nextSize) => {
              setPageSize(nextSize);
              setPage(1);
            }}
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
          />
        </>
      ) : null}
    </div>
  );
}
