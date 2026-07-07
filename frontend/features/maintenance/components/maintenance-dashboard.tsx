"use client";

import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { useMaintenanceDashboard } from "@/hooks/use-maintenance-dashboard";
import { useMaintenanceList } from "@/hooks/use-maintenance-list";
import { formatMaintenanceError, formatDateTime, formatLocationLabel, formatPersonLabel } from "@/lib/maintenance/display";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import type { MaintenanceDashboard as MaintenanceDashboardSummary, MaintenanceWorkOrderListItem } from "@/types/maintenance";

import { MaintenancePriorityBadge } from "./maintenance-priority-badge";
import { MaintenanceStatusBadge } from "./maintenance-status-badge";
import { MaintenanceLoadingSkeleton } from "./maintenance-loading-skeleton";
import { SectionCard } from "./maintenance-shared";

function toMetricCards(summary: MaintenanceDashboardSummary) {
  return [
    { id: "total", label: "Total Work Orders", value: summary.total_work_orders },
    { id: "open", label: "Open", value: summary.open },
    { id: "assigned", label: "Assigned", value: summary.assigned },
    { id: "in-progress", label: "In Progress", value: summary.in_progress },
    { id: "completed", label: "Completed", value: summary.completed },
    { id: "cancelled", label: "Cancelled", value: summary.cancelled },
    { id: "overdue", label: "Overdue", value: summary.overdue },
    { id: "high-priority", label: "High Priority", value: summary.high_priority },
    { id: "critical", label: "Critical", value: summary.critical },
    { id: "recent", label: "Recently Updated", value: summary.recently_updated },
  ];
}

export function MaintenanceDashboardScreen() {
  const dashboardQuery = useMaintenanceDashboard();
  const recentWorkOrdersQuery = useMaintenanceList({
    page: 1,
    page_size: 5,
    ordering: "-updated",
  });

  if (dashboardQuery.isPending || recentWorkOrdersQuery.isPending) {
    return <MaintenanceLoadingSkeleton cards={8} rows={5} />;
  }

  if (dashboardQuery.isError) {
    return (
      <ErrorState
        title="Unable to load maintenance dashboard"
        message={formatMaintenanceError(
          dashboardQuery.error,
          "The maintenance dashboard could not be loaded.",
        )}
        action={
          <button
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            onClick={() => void dashboardQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        }
      />
    );
  }

  if (recentWorkOrdersQuery.isError) {
    return (
      <ErrorState
        title="Unable to load recent work orders"
        message={formatMaintenanceError(
          recentWorkOrdersQuery.error,
          "Recent work orders could not be loaded.",
        )}
        action={
          <button
            className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
            onClick={() => void recentWorkOrdersQuery.refetch()}
            type="button"
          >
            Retry
          </button>
        }
      />
    );
  }

  const summary = dashboardQuery.data;
  const recentWorkOrders = recentWorkOrdersQuery.data?.results ?? [];
  const columns: DataTableColumn<MaintenanceWorkOrderListItem>[] = [
    {
      header: "Work order",
      cell: (item) => (
        <div className="min-w-0 whitespace-normal">
          <p className="font-medium text-slate-900">{item.work_order_number}</p>
          <p className="mt-1 text-xs text-slate-500">{item.title}</p>
        </div>
      ),
      className: "min-w-64 whitespace-normal",
    },
    {
      header: "Status",
      cell: (item) => <MaintenanceStatusBadge status={item.status} />,
    },
    {
      header: "Priority",
      cell: (item) => <MaintenancePriorityBadge priority={item.priority} />,
    },
    {
      header: "Location",
      cell: (item) =>
        formatLocationLabel([item.building_name, item.floor_name, item.area_name]),
      className: "min-w-52 whitespace-normal",
    },
    {
      header: "Assigned To",
      cell: (item) => formatPersonLabel(item.assignee_email),
      className: "min-w-48 whitespace-normal",
    },
    {
      header: "Updated",
      cell: (item) => formatDateTime(item.updated_at),
      className: "min-w-40 whitespace-normal",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        description="Maintenance dashboard summary for work orders, status mix, overdue load, and recent activity. This screen stays read-only and routes deeper navigation into the work order list and detail views."
        eyebrow="Maintenance"
        title="Maintenance Dashboard"
      >
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex items-center rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            href="/maintenance/work-orders"
          >
            Open work order list
          </Link>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {toMetricCards(summary).map((metric) => (
          <MetricCard key={metric.id} label={metric.label} value={metric.value} />
        ))}
      </div>

      <SectionCard
        title="Recently Updated"
        description="Latest maintenance work orders sorted by backend update time."
      >
        {recentWorkOrders.length === 0 ? (
          <EmptyState
            title="No work orders found"
            message="Seed or create maintenance work orders before using the dashboard."
          />
        ) : (
          <>
            <DataTable
              caption="Recent maintenance work orders"
              columns={columns}
              getRowKey={(item) => item.id}
              rows={recentWorkOrders}
            />
            <div className="flex justify-end">
              <Link
                className="inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href="/maintenance/work-orders"
              >
                View all work orders
              </Link>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}
